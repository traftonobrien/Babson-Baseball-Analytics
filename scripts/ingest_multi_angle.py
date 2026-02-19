#!/usr/bin/env python3
"""
Multi-angle ingest:
  - detect angle segments from hard cuts
  - classify segment camera angle
  - split each segment into pitch clips
  - write per-clip files + ingest index.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest.angle_classify import classify_segment
from src.ingest.cut_detection import detect_segments
from src.ingest.ffmpeg_utils import cut_clip
from src.ingest.pitch_split import detect_pitch_windows_in_segment
from src.ingest.schema import IngestIndex, PitchClip, Segment
from src.ingest.selection import build_pitch_groups
from src.mechanics.utils import slugify
from src.mechanics.video_io import read_video_meta

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_MULTI_ANGLE_VIDEO = REPO_ROOT / "Mechanics Analysis" / "Trafton OBrien" / "All Angles Test.mov"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Ingest one all-angles video into angle segments + per-pitch clips.",
    )
    p.add_argument(
        "--video",
        default=str(DEFAULT_MULTI_ANGLE_VIDEO),
        help="Path to all-angles source video.",
    )
    p.add_argument("--player", default=None, help="Player name override (slugified for output path).")
    p.add_argument("--session", default=None, help="Session name override (slugified for output path).")
    p.add_argument("--hand", default="R", choices=["R", "L"], help="Pitcher hand for recommendation ordering.")
    p.add_argument("--outdir", default="output/ingest", help="Output root directory.")
    p.add_argument("--dry-run", action="store_true", help="Do everything except writing clip files.")
    p.add_argument("--verbose", action="store_true", help="Verbose progress logging.")
    p.add_argument("--sample-step", type=int, default=1, help="Frame step for cut detection (speed vs precision).")
    p.add_argument("--min-segment-s", type=float, default=0.9, help="Minimum segment duration in seconds.")
    p.add_argument("--min-pitch-s", type=float, default=1.3, help="Minimum pitch clip duration in seconds.")
    p.add_argument("--max-pitch-s", type=float, default=6.0, help="Maximum pitch clip duration in seconds.")
    p.add_argument("--group-gap-s", type=float, default=8.0, help="Gap threshold for grouping candidate clips as one pitch.")
    return p.parse_args()


def _resolve_path(path_arg: str) -> Path:
    raw = Path(path_arg).expanduser()
    if raw.is_absolute():
        return raw
    cwd_resolved = (Path.cwd() / raw).resolve()
    if cwd_resolved.exists():
        return cwd_resolved
    return (REPO_ROOT / raw).resolve()


def run_ingest(
    video_path: Path,
    player: Optional[str],
    session: Optional[str],
    hand: str,
    outdir: Path,
    dry_run: bool = False,
    verbose: bool = False,
    sample_step: int = 1,
    min_segment_s: float = 0.9,
    min_pitch_s: float = 1.3,
    max_pitch_s: float = 6.0,
    group_gap_s: float = 8.0,
) -> Path:
    if not video_path.exists():
        raise FileNotFoundError(f"Video not found: {video_path}")

    meta = read_video_meta(video_path)
    player_slug = slugify(player if player else video_path.parent.name)
    session_slug = slugify(session if session else video_path.stem)
    session_dir = outdir / player_slug / session_slug
    session_dir.mkdir(parents=True, exist_ok=True)

    if verbose:
        print(f"[ingest] video={video_path}")
        print(f"[ingest] fps={meta.fps:.2f} frames={meta.frame_count} size={meta.width}x{meta.height}")

    detected = detect_segments(
        video_path,
        min_segment_s=min_segment_s,
        sample_step=max(1, int(sample_step)),
    )
    if not detected:
        detected = [
            # Fallback: entire clip is one segment.
            type("FallbackSeg", (), {
                "start_frame": 0,
                "end_frame": max(0, meta.frame_count - 1),
                "start_s": 0.0,
                "end_s": meta.duration_s,
            })()
        ]

    segments: list[Segment] = []
    clips: list[PitchClip] = []
    angle_counts: dict[str, int] = {}

    for i, seg in enumerate(detected, start=1):
        seg_id = f"segment_{i:03d}"
        pred = classify_segment(video_path, seg.start_frame, seg.end_frame, max_samples=14)
        angle = pred.angle_class
        angle_counts[angle] = angle_counts.get(angle, 0) + 1
        if verbose:
            print(
                f"[segment] {seg_id} frames={seg.start_frame}-{seg.end_frame} "
                f"angle={angle} conf={pred.confidence:.2f}"
            )
        segments.append(
            Segment(
                segment_id=seg_id,
                start_s=float(seg.start_s),
                end_s=float(seg.end_s),
                start_frame=int(seg.start_frame),
                end_frame=int(seg.end_frame),
                angle_class=angle,
                angle_confidence=float(pred.confidence),
                angle_cues=list(pred.cues),
                feature_scores=dict(pred.features),
            )
        )

        windows, _energy = detect_pitch_windows_in_segment(
            video_path=video_path,
            segment_start_frame=seg.start_frame,
            segment_end_frame=seg.end_frame,
            fps=meta.fps,
            min_pitch_s=min_pitch_s,
            max_pitch_s=max_pitch_s,
        )
        if verbose:
            print(f"[segment] {seg_id} pitches_detected={len(windows)}")

        for win in windows:
            pitch_num = angle_counts.get(f"{angle}__pitch", 0) + 1
            angle_counts[f"{angle}__pitch"] = pitch_num
            clip_base = f"pitch_{pitch_num:03d}"
            clip_rel = Path(angle) / f"{clip_base}.mp4"
            clip_abs = session_dir / clip_rel
            meta_rel = Path(angle) / f"{clip_base}.json"
            meta_abs = session_dir / meta_rel

            clip_start_s = float(win.start_frame) / max(meta.fps, 1e-6)
            clip_end_s = float(win.end_frame + 1) / max(meta.fps, 1e-6)
            clip_id = f"{seg_id}:{clip_base}:{angle}"

            if not dry_run:
                ok = cut_clip(video_path, clip_abs, clip_start_s, clip_end_s)
                if not ok and verbose:
                    print(f"[warn] failed to cut clip: {clip_abs}")

            pitch_clip = PitchClip(
                clip_id=clip_id,
                segment_id=seg_id,
                angle_class=angle,
                start_s=clip_start_s,
                end_s=clip_end_s,
                start_frame=win.start_frame,
                end_frame=win.end_frame,
                duration_s=max(0.0, clip_end_s - clip_start_s),
                set_frame=win.set_frame,
                release_frame=win.release_frame,
                confidence=float(win.confidence),
                clip_path_abs=str(clip_abs.resolve()),
                clip_path_rel=str(clip_rel.as_posix()),
                metadata_path_abs=str(meta_abs.resolve()),
                metadata_path_rel=str(meta_rel.as_posix()),
                fps=float(meta.fps),
                width=int(meta.width),
                height=int(meta.height),
            )
            clips.append(pitch_clip)

            if not dry_run:
                meta_abs.parent.mkdir(parents=True, exist_ok=True)
                with open(meta_abs, "w") as f:
                    json.dump(
                        {
                            "clip": pitch_clip.to_dict(),
                            "segment": segments[-1].to_dict(),
                            "source_video_abs": str(video_path.resolve()),
                            "source_video_rel": str(video_path.resolve().relative_to(REPO_ROOT)) if str(video_path.resolve()).startswith(str(REPO_ROOT)) else str(video_path.resolve()),
                        },
                        f,
                        indent=2,
                    )

    pitch_groups = build_pitch_groups(clips, hand=hand, group_gap_s=group_gap_s)
    clip_to_group: dict[str, str] = {}
    for group in pitch_groups:
        for cid in group.candidate_clip_ids:
            clip_to_group[cid] = group.pitch_id
    for clip in clips:
        clip.pitch_group_id = clip_to_group.get(clip.clip_id)

    index = IngestIndex(
        schema_version=1,
        source_video_abs=str(video_path.resolve()),
        source_video_rel=(
            str(video_path.resolve().relative_to(REPO_ROOT))
            if str(video_path.resolve()).startswith(str(REPO_ROOT))
            else str(video_path.resolve())
        ),
        player_slug=player_slug,
        session_slug=session_slug,
        fps=float(meta.fps),
        frame_count=int(meta.frame_count),
        width=int(meta.width),
        height=int(meta.height),
        segments=segments,
        pitch_clips=clips,
        pitch_groups=pitch_groups,
        angle_summary={k: int(v) for k, v in angle_counts.items() if "__pitch" not in k},
        warnings=[],
    )
    if not clips:
        index.warnings.append("No pitch clips detected; verify min-pitch/max-pitch thresholds.")

    index_path = session_dir / "index.json"
    with open(index_path, "w") as f:
        json.dump(index.to_dict(), f, indent=2)
    return index_path


def main() -> None:
    args = parse_args()
    video_path = _resolve_path(args.video)
    outdir = _resolve_path(args.outdir)
    try:
        index_path = run_ingest(
            video_path=video_path,
            player=args.player,
            session=args.session,
            hand=args.hand,
            outdir=outdir,
            dry_run=args.dry_run,
            verbose=args.verbose,
            sample_step=args.sample_step,
            min_segment_s=args.min_segment_s,
            min_pitch_s=args.min_pitch_s,
            max_pitch_s=args.max_pitch_s,
            group_gap_s=args.group_gap_s,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)

    print(f"Ingest index: {index_path}")


if __name__ == "__main__":
    main()

