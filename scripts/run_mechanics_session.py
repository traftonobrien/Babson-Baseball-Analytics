#!/usr/bin/env python3
"""
Run mechanics coach-pack generation for a multi-angle ingest session.

Inputs:
  - ingest index.json (preferred), or
  - raw video (ingest will run first)
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.ingest_manual.export import export_manual_clips
from src.ingest_manual.utils import choose_preferred_angle
from scripts.ingest_multi_angle import run_ingest
from scripts.mechanics_coach_pack import _top_issues, _write_hold_review_video, _write_slowmo_video
from src.ingest.selection import candidate_quality_score
from src.mechanics.benchmarks import compute_benchmarks
from src.mechanics.coach_pack import build_coach_pack
from src.mechanics.phases import detect_phases
from src.mechanics.pose import KP, extract_poses
from src.mechanics.utils import slugify
from src.mechanics.video_io import read_video_meta

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SINGLE_CLIP = REPO_ROOT / "Mechanics Analysis" / "Trafton OBrien" / "Trafton Mechanics Test.mov"
DEFAULT_MULTI_ANGLE_VIDEO = REPO_ROOT / "Mechanics Analysis" / "Trafton OBrien" / "All Angles Test.mov"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Run mechanics outputs per pitch from ingest session.")
    p.add_argument("--manual-clips", default=None, help="Path to manual_clips.json.")
    p.add_argument("--ingest-index", default=None, help="Path to ingest index.json.")
    p.add_argument(
        "--video",
        default=None,
        help="Optional source video path. If ingest index is omitted, this video is ingested first.",
    )
    p.add_argument("--player", default=None, help="Player name override when ingesting from video.")
    p.add_argument("--session", default=None, help="Session name override when ingesting from video.")
    p.add_argument("--hand", default="R", choices=["R", "L"], help="Pitcher hand.")
    p.add_argument("--view", default="auto", choices=["auto", "open_side", "front"], help="View mode: auto (default), open_side, or front.")
    p.add_argument("--outdir", default="output/mechanics", help="Mechanics output root.")
    p.add_argument("--ingest-outdir", default="output/ingest", help="Ingest output root when --video is used.")
    p.add_argument("--front-min-visibility", type=float, default=0.52, help="Minimum visibility score to trust front view.")
    p.add_argument("--no-export", action="store_true", help="With --manual-clips, skip export and use existing clips/index.")
    p.add_argument("--slowmo", action="store_true", help="Write slowmo_review.mp4.")
    p.add_argument("--hold-review", action="store_true", help="Write hold_review.mp4.")
    p.add_argument("--debug-metrics", action="store_true", help="Include debug-only metrics in coach-pack notes.")
    p.add_argument("--verbose", action="store_true", help="Verbose logging.")
    return p.parse_args()


def _resolve_path(path_arg: str) -> Path:
    raw = Path(path_arg).expanduser()
    if raw.is_absolute():
        return raw
    cwd_resolved = (Path.cwd() / raw).resolve()
    if cwd_resolved.exists():
        return cwd_resolved
    return (REPO_ROOT / raw).resolve()


def _estimate_visibility_score(clip_path: Path, max_frames: int = 28) -> float:
    """
    Quick clip quality score from sampled pose validity + keypoint visibility.
    """
    try:
        poses = extract_poses(
            clip_path,
            max_frames=max_frames,
            min_detection_confidence=0.4,
            min_tracking_confidence=0.4,
            verbose=False,
        )
    except Exception:
        return 0.0

    if not poses:
        return 0.0
    valid = [p for p in poses if p.valid]
    valid_ratio = len(valid) / len(poses)
    if not valid:
        return max(0.05, valid_ratio * 0.4)

    keypoints = ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP", "LEFT_WRIST", "RIGHT_WRIST"]
    vis_vals: list[float] = []
    for p in valid:
        for kp in keypoints:
            lm = p.landmarks[KP[kp]]
            if lm is None or lm.shape[0] < 3:
                continue
            if lm[2] == lm[2]:  # not NaN
                vis_vals.append(float(lm[2]))
    mean_vis = sum(vis_vals) / len(vis_vals) if vis_vals else 0.0
    return max(0.0, min(1.0, 0.60 * valid_ratio + 0.40 * mean_vis))


def _load_ingest_index(path: Path) -> dict[str, Any]:
    with open(path) as f:
        data = json.load(f)
    if "pitch_clips" not in data:
        raise ValueError(f"Ingest index missing pitch_clips: {path}")
    return data


def _choose_best_candidate(
    candidates: list[dict[str, Any]],
    hand: str,
    front_min_visibility: float,
    forced_view: str = "auto",
    verbose: bool = False,
) -> tuple[dict[str, Any], float, float, str]:
    best: Optional[dict[str, Any]] = None
    best_score = -1.0
    best_vis = 0.0
    best_view = "open_side"
    for c in candidates:
        clip_path = Path(c["clip_path_abs"])
        vis_score = _estimate_visibility_score(clip_path)
        score = candidate_quality_score(
            angle_class=c.get("angle_class", "unknown"),
            hand=hand,
            clip_confidence=float(c.get("confidence", 0.0)),
            fps=float(c.get("fps", 30.0)),
            width=int(c.get("width", 1280)),
            height=int(c.get("height", 720)),
            visibility_score=vis_score,
        )
        angle = c.get("angle_class", "unknown")
        if forced_view in ("open_side", "front"):
            view_mode = forced_view
        else:
            if angle in ("behind_home", "behind_center") and vis_score >= front_min_visibility:
                view_mode = "front"
            else:
                view_mode = "open_side"
        if verbose:
            print(f"  candidate={c.get('clip_id')} angle={angle} vis={vis_score:.2f} score={score:.2f} view={view_mode}")
        if score > best_score:
            best = c
            best_score = score
            best_vis = vis_score
            best_view = view_mode
    if best is None:
        raise ValueError("No valid candidate clips.")
    return best, best_score, best_vis, best_view


def _run_mechanics_for_clip(
    clip_path: Path,
    hand: str,
    view_mode: str,
    out_dir: Path,
    slowmo: bool,
    hold_review: bool,
    debug_metrics: bool,
) -> dict[str, Any]:
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = read_video_meta(clip_path)
    poses = extract_poses(clip_path, verbose=False)
    phases = detect_phases(poses, fps=meta.fps, hand=hand, debug=True)
    benchmarks = compute_benchmarks(poses, phases, hand=hand, view_mode=view_mode)

    bench_json = out_dir / "benchmarks.json"
    with open(bench_json, "w") as f:
        payload = benchmarks.to_dict()
        payload["phases"] = phases.to_dict()
        json.dump(payload, f, indent=2)

    coach_result = build_coach_pack(
        video_path=clip_path,
        poses=poses,
        phases=phases,
        benchmarks=benchmarks,
        out_dir=out_dir,
        include_debug_metrics=debug_metrics,
    )

    slowmo_path = None
    hold_path = None
    if slowmo or hold_review:
        slowmo_path = _write_slowmo_video(
            clip_path,
            coach_result.coach_pack_dir / "slowmo_review.mp4",
            playback_scale=0.5,
        )
    if hold_review and slowmo_path is not None:
        hold_path = _write_hold_review_video(
            slowmo_path=slowmo_path,
            out_path=coach_result.coach_pack_dir / "hold_review.mp4",
            poses=poses,
            phases=phases,
            benchmarks=benchmarks,
            original_total_frames=len(poses),
            original_fps=meta.fps,
            hold_seconds=2.0,
            min_confidence=0.30,
        )

    return {
        "benchmarks": benchmarks,
        "phases": phases,
        "benchmarks_json": str(bench_json.resolve()),
        "coach_pack_dir": str(coach_result.coach_pack_dir.resolve()),
        "notes_json": str(coach_result.notes_json.resolve()) if coach_result.notes_json else None,
        "slowmo_review_mp4": str(slowmo_path.resolve()) if slowmo_path else None,
        "hold_review_mp4": str(hold_path.resolve()) if hold_path else None,
    }


def _ensure_ingest_index(args: argparse.Namespace) -> Path:
    if args.ingest_index:
        return _resolve_path(args.ingest_index)

    video = _resolve_path(args.video) if args.video else DEFAULT_MULTI_ANGLE_VIDEO
    if not video.exists():
        # Fallback default single clip if multi-angle file is not present.
        video = DEFAULT_SINGLE_CLIP if DEFAULT_SINGLE_CLIP.exists() else video
    out = _resolve_path(args.ingest_outdir)
    idx = run_ingest(
        video_path=video,
        player=args.player,
        session=args.session,
        hand=args.hand,
        outdir=out,
        dry_run=False,
        verbose=args.verbose,
    )
    return idx


def _load_manual_index(path: Path) -> dict[str, Any]:
    with open(path) as f:
        data = json.load(f)
    if "clips" not in data:
        raise ValueError(f"Manual index missing clips: {path}")
    return data


def _ensure_manual_index(
    manual_clips_path: Path,
    ingest_outdir: Path,
    no_export: bool,
) -> tuple[Path, Path, dict[str, Any]]:
    manual_path = manual_clips_path.resolve()
    if not manual_path.exists():
        raise FileNotFoundError(f"manual_clips.json not found: {manual_path}")
    index_path = manual_path.parent / "index.json"

    if no_export:
        if not index_path.exists():
            raise FileNotFoundError(
                f"--no-export was set but index.json not found next to manual_clips.json: {index_path}"
            )
    else:
        index_path = export_manual_clips(
            manual_clips_path=manual_path,
            out_root=ingest_outdir,
            overwrite=False,
            keep_audio=False,
        )
    return manual_path, index_path, _load_manual_index(index_path)


def _manual_view_mode_for_angle(
    angle: str,
    clip_path: Path,
    forced_view: str,
    front_min_visibility: float,
) -> tuple[str, float]:
    if forced_view in ("open_side", "front"):
        vis = _estimate_visibility_score(clip_path)
        return forced_view, vis

    vis = _estimate_visibility_score(clip_path)
    if angle in ("front", "back", "behind_home", "center") and vis >= front_min_visibility:
        return "front", vis
    return "open_side", vis


def _resolve_manual_pitch_choice(
    pitch_row: dict[str, Any],
    forced_view: str,
) -> Optional[str]:
    angles = pitch_row.get("angles", {})
    if not angles:
        return None
    if forced_view == "open_side" and "open_side" in angles:
        return "open_side"
    if forced_view == "front":
        for a in ("front", "back", "behind_home", "center"):
            if a in angles:
                return a
    preferred = pitch_row.get("preferred_angle")
    if preferred and preferred in angles:
        return preferred
    ordered = choose_preferred_angle(angles.keys())
    if ordered in angles:
        return ordered
    return sorted(angles.keys())[0]


def _run_from_manual_index(args: argparse.Namespace, manual_index_path: Path, manual_index: dict[str, Any]) -> None:
    out_root = _resolve_path(args.outdir)
    player_slug = slugify(str(manual_index.get("player", "player")))
    session_slug = slugify(str(manual_index.get("session", "session")))
    session_out = out_root / player_slug / session_slug
    session_out.mkdir(parents=True, exist_ok=True)

    session_rows: list[dict[str, Any]] = []
    for pitch_row in sorted(manual_index.get("clips", []), key=lambda r: int(r.get("pitch_idx", 0))):
        pitch_idx = int(pitch_row.get("pitch_idx", 0))
        pitch_id = f"pitch_{pitch_idx:03d}" if pitch_idx > 0 else f"pitch_{len(session_rows) + 1:03d}"
        chosen_angle = _resolve_manual_pitch_choice(pitch_row, forced_view=args.view)
        angles = pitch_row.get("angles", {})
        if chosen_angle is None or chosen_angle not in angles:
            session_rows.append({"pitch_id": pitch_id, "status": "skipped", "reason": "no_angles"})
            continue

        clip_rel = Path(str(angles[chosen_angle]["path"]))
        clip_path = (manual_index_path.parent / clip_rel).resolve()
        if not clip_path.exists():
            session_rows.append(
                {
                    "pitch_id": pitch_id,
                    "status": "skipped",
                    "reason": "clip_missing",
                    "clip_path_abs": str(clip_path),
                }
            )
            continue

        view_mode, vis_score = _manual_view_mode_for_angle(
            angle=chosen_angle,
            clip_path=clip_path,
            forced_view=args.view,
            front_min_visibility=args.front_min_visibility,
        )
        pitch_out = session_out / pitch_id
        run = _run_mechanics_for_clip(
            clip_path=clip_path,
            hand=args.hand,
            view_mode=view_mode,
            out_dir=pitch_out,
            slowmo=args.slowmo or args.hold_review,
            hold_review=args.hold_review or args.slowmo,
            debug_metrics=args.debug_metrics,
        )
        benchmarks = run["benchmarks"]
        top_issues = _top_issues(benchmarks, limit=3)
        session_rows.append(
            {
                "pitch_id": pitch_id,
                "status": "ok",
                "chosen_clip_id": f"manual:{pitch_id}:{chosen_angle}",
                "chosen_angle": chosen_angle,
                "chosen_view_mode": view_mode,
                "selection_score": None,
                "visibility_score": round(vis_score, 3),
                "clip_path_abs": str(clip_path),
                "efficiency_score": benchmarks.efficiency_score,
                "efficiency_low_confidence": benchmarks.efficiency_low_confidence,
                "top_issues": top_issues,
                "outputs": {
                    "pitch_dir": str(pitch_out.resolve()),
                    "benchmarks_json": run["benchmarks_json"],
                    "coach_pack_dir": run["coach_pack_dir"],
                    "notes_json": run["notes_json"],
                    "slowmo_review_mp4": run["slowmo_review_mp4"],
                    "hold_review_mp4": run["hold_review_mp4"],
                },
            }
        )

    session_index = {
        "schema_version": 1,
        "player_slug": player_slug,
        "session_slug": session_slug,
        "hand": args.hand,
        "source_manual_index_abs": str(manual_index_path.resolve()),
        "source_video_abs": manual_index.get("source_video"),
        "pitches": session_rows,
    }
    index_path = session_out / "index.json"
    with open(index_path, "w") as f:
        json.dump(session_index, f, indent=2)
    print(f"Mechanics session index: {index_path}")


def main() -> None:
    args = parse_args()
    if args.manual_clips and args.ingest_index:
        raise SystemExit("ERROR: Use either --manual-clips or --ingest-index, not both.")
    if args.manual_clips and args.video:
        raise SystemExit("ERROR: With --manual-clips, do not pass --video.")

    ingest_outdir = _resolve_path(args.ingest_outdir)
    if args.manual_clips:
        manual_path = _resolve_path(args.manual_clips)
        _manual_path, manual_index_path, manual_index = _ensure_manual_index(
            manual_clips_path=manual_path,
            ingest_outdir=ingest_outdir,
            no_export=args.no_export,
        )
        _run_from_manual_index(args, manual_index_path=manual_index_path, manual_index=manual_index)
        return

    ingest_index_path = _ensure_ingest_index(args)
    ingest = _load_ingest_index(ingest_index_path)

    out_root = _resolve_path(args.outdir)
    player_slug = ingest.get("player_slug") or slugify(args.player or "player")
    session_slug = ingest.get("session_slug") or slugify(args.session or "session")
    session_out = out_root / player_slug / session_slug
    session_out.mkdir(parents=True, exist_ok=True)

    pitch_clips = {c["clip_id"]: c for c in ingest.get("pitch_clips", [])}
    groups = ingest.get("pitch_groups", [])
    if not groups:
        # Fallback: each clip is its own pitch.
        groups = []
        for i, clip in enumerate(sorted(ingest.get("pitch_clips", []), key=lambda c: c.get("start_s", 0.0)), start=1):
            groups.append(
                {
                    "pitch_id": f"pitch_{i:03d}",
                    "candidate_clip_ids": [clip["clip_id"]],
                }
            )

    session_rows: list[dict[str, Any]] = []
    for group in groups:
        pitch_id = group.get("pitch_id") or f"pitch_{len(session_rows) + 1:03d}"
        candidate_ids = group.get("candidate_clip_ids", [])
        candidates = [pitch_clips[cid] for cid in candidate_ids if cid in pitch_clips]
        if not candidates:
            session_rows.append(
                {
                    "pitch_id": pitch_id,
                    "status": "skipped",
                    "reason": "no_candidates",
                }
            )
            continue

        if args.verbose:
            print(f"[pitch] {pitch_id} candidates={len(candidates)}")
        chosen, select_score, vis_score, view_mode = _choose_best_candidate(
            candidates,
            hand=args.hand,
            front_min_visibility=args.front_min_visibility,
            forced_view=args.view,
            verbose=args.verbose,
        )
        clip_path = Path(chosen["clip_path_abs"])
        pitch_out = session_out / pitch_id
        if args.verbose:
            print(
                f"[pitch] {pitch_id} chosen={chosen.get('clip_id')} angle={chosen.get('angle_class')} "
                f"view={view_mode} select_score={select_score:.2f}"
            )

        run = _run_mechanics_for_clip(
            clip_path=clip_path,
            hand=args.hand,
            view_mode=view_mode,
            out_dir=pitch_out,
            slowmo=args.slowmo or args.hold_review,
            hold_review=args.hold_review or args.slowmo,
            debug_metrics=args.debug_metrics,
        )
        benchmarks = run["benchmarks"]
        top_issues = _top_issues(benchmarks, limit=3)

        session_rows.append(
            {
                "pitch_id": pitch_id,
                "status": "ok",
                "chosen_clip_id": chosen.get("clip_id"),
                "chosen_angle": chosen.get("angle_class"),
                "chosen_view_mode": view_mode,
                "selection_score": round(select_score, 3),
                "visibility_score": round(vis_score, 3),
                "clip_path_abs": str(clip_path.resolve()),
                "efficiency_score": benchmarks.efficiency_score,
                "efficiency_low_confidence": benchmarks.efficiency_low_confidence,
                "top_issues": top_issues,
                "outputs": {
                    "pitch_dir": str(pitch_out.resolve()),
                    "benchmarks_json": run["benchmarks_json"],
                    "coach_pack_dir": run["coach_pack_dir"],
                    "notes_json": run["notes_json"],
                    "slowmo_review_mp4": run["slowmo_review_mp4"],
                    "hold_review_mp4": run["hold_review_mp4"],
                },
            }
        )

    session_index = {
        "schema_version": 1,
        "player_slug": player_slug,
        "session_slug": session_slug,
        "hand": args.hand,
        "source_ingest_index_abs": str(ingest_index_path.resolve()),
        "source_video_abs": ingest.get("source_video_abs"),
        "pitches": session_rows,
    }
    index_path = session_out / "index.json"
    with open(index_path, "w") as f:
        json.dump(session_index, f, indent=2)

    print(f"Mechanics session index: {index_path}")


if __name__ == "__main__":
    main()
