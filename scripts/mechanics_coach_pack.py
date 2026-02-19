#!/usr/bin/env python3
"""
Coach Pack Visualizer — rich output bundle for coaching review.

Produces:
  output/mechanics/<player>/<clip>/coach_pack/
    set.png, peak_leg_lift.png, foot_strike.png, release.png
    strip.png           (1x4 horizontal strip)
    set_to_fs.mp4       (SET to FOOT STRIKE cliplet)
    fs_to_release.mp4   (FOOT STRIKE to BALL RELEASE cliplet)
    release.mp4         (BALL RELEASE + 15 frames cliplet)
    notes.json          (metric pass/fail + coaching callouts)

Prerequisites:
  Run mechanics_detect_phases.py first (or let this script auto-detect).
  The pose model will be auto-downloaded to ~/.cache/mediapipe/ on first run.

Usage examples:
  python scripts/mechanics_coach_pack.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --hand R

  python scripts/mechanics_coach_pack.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --phases output/mechanics/jason_finkelstein/pitch_test/phases.json \\
      --hand R
"""

import argparse
import bisect
import json
import math
import sys
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.mechanics.video_io import read_video_meta
from src.mechanics.pose import PoseResult, KP, extract_poses
from src.mechanics.phases import detect_phases, Phase, PitchPhases
from src.mechanics.benchmarks import BenchmarkReport, compute_benchmarks, official_metric_names
from src.mechanics.coach_pack import build_coach_pack
from src.mechanics.utils import slugify

REPO_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Build a coach pack (key frames, strip, cliplets, notes) from a pitching video.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument("--video",
                        help="Path to a single input video file.")
    source.add_argument("--folder",
                        help="Process all .mp4 files under this folder recursively.")
    p.add_argument("--phases",  default=None,
                   help="Path to phases.json (optional; auto-detected if omitted).")
    p.add_argument("--hand",    default="R", choices=["R", "L"],
                   help="Pitcher throwing hand. Default: R.")
    p.add_argument("--view",    default="open_side", choices=["open_side", "front"],
                   help="Camera view mode. Default: open_side.")
    p.add_argument("--slowmo", action="store_true",
                   help="Also write a view-only slow-motion MP4 into coach_pack/ (does not affect metrics).")
    p.add_argument("--hold-review", dest="hold_review", action="store_true",
                   help="Write hold_review.mp4 from slowmo_review.mp4 with 2s phase holds.")
    p.add_argument("--no-hold-review", dest="hold_review", action="store_false",
                   help="Disable hold_review.mp4 generation.")
    p.set_defaults(hold_review=None)
    p.add_argument("--debug-metrics", action="store_true",
                   help="Include debug-only open-side metrics (balance/posture/lift/tilt + legacy trunk/extension) in notes overlays.")
    p.add_argument("--verbose", action="store_true",
                   help="Print per-frame pose detection progress.")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Phases loader (same as mechanics_benchmarks.py)
# ---------------------------------------------------------------------------

def _load_phases(path: Path) -> PitchPhases:
    """Reconstruct PitchPhases from a phases.json file."""
    with open(path) as f:
        data = json.load(f)

    def _phase(d) -> Optional[Phase]:
        if d is None:
            return None
        return Phase(**d)

    pd = data["phases"]
    return PitchPhases(
        set_pos=        _phase(pd.get("set")),
        first_movement= _phase(pd.get("first_movement")),
        peak_leg_lift=  _phase(pd.get("peak_leg_lift")),
        foot_strike=    _phase(pd.get("foot_strike")),
        ball_release=   _phase(pd.get("ball_release")),
        fps=            data["fps"],
    )


def _resolve_path(path_arg: str) -> Path:
    """Resolve absolute path or repo-root-relative path."""
    raw = Path(path_arg).expanduser()
    if raw.is_absolute():
        return raw
    cwd_path = (Path.cwd() / raw).resolve()
    if cwd_path.exists():
        return cwd_path
    return (REPO_ROOT / raw).resolve()


def _top_issues(benchmarks: BenchmarkReport, limit: int = 3) -> list[dict]:
    """Return top trusted open-view issues for index summaries."""
    allowed = set(official_metric_names(benchmarks.view_mode))
    candidates = [
        m for m in benchmarks.all_metrics()
        if (
            m.name in allowed
            and m.status == "ok"
            and m.score is not None
            and m.pass_fail is False
            and (m.confidence or 0.0) >= 0.35
        )
    ]
    candidates.sort(
        key=lambda m: (
            (m.score or 10.0) / max(m.confidence or 1.0, 0.05),
            m.score or 10.0,
            -(m.confidence or 0.0),
        )
    )
    issues = []
    for m in candidates[:limit]:
        issues.append({
            "metric": m.name,
            "score": round(m.score, 2) if m.score is not None else None,
            "confidence": round(m.confidence, 2) if m.confidence is not None else None,
            "note": m.note,
        })
    return issues


def _write_manual_template(
    out_dir: Path,
    hand: str,
    view_mode: str,
) -> Path:
    """Write/overwrite manual validation template for coach-entered checkpoints."""
    template = {
        "schema_version": 1,
        "view_mode": view_mode,
        "hand": hand,
        "manual_measurements": {
            "front_knee_flexion_fs_deg": None,
            "front_knee_flexion_rel_deg": None,
            "front_knee_bracing_delta_deg": None,
            "trunk_tilt_rel_deg": None,
            "stride_estimate_pct_height": None,
        },
        "notes": [],
    }
    path = out_dir / "manual_template.json"
    with open(path, "w") as f:
        json.dump(template, f, indent=2)
    return path


def _write_slowmo_video(
    video_path: Path,
    out_path: Path,
    playback_scale: float = 0.5,
) -> Optional[Path]:
    """Write a view-only slow-motion copy by reducing output FPS."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None

    fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    out_fps = max(1.0, fps * playback_scale)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(out_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        out_fps,
        (width, height),
    )
    if not writer.isOpened():
        cap.release()
        return None

    while True:
        ok, frame = cap.read()
        if not ok:
            break
        writer.write(frame)

    writer.release()
    cap.release()
    return out_path


_PHASE_ORDER: list[tuple[str, str, str]] = [
    ("set", "SET", "set_pos"),
    ("peak_leg_lift", "PEAK LEG LIFT", "peak_leg_lift"),
    ("foot_strike", "FOOT STRIKE", "foot_strike"),
    ("ball_release", "BALL RELEASE", "ball_release"),
]

_PHASE_CARD_METRICS: dict[str, list[str]] = {
    "set": ["timing"],
    "peak_leg_lift": [],
    "foot_strike": ["timing", "drift_forward", "front_knee_flexion_fs"],
    "ball_release": [
        "front_knee_extension_rel",
        "trunk_stability_v2",
        "release_extension_v2",
        "swivel_stabilize",
    ],
}

_SOFT_CONNECTIONS: list[tuple[str, str]] = [
    ("LEFT_SHOULDER", "RIGHT_SHOULDER"),
    ("LEFT_SHOULDER", "LEFT_ELBOW"),
    ("LEFT_ELBOW", "LEFT_WRIST"),
    ("RIGHT_SHOULDER", "RIGHT_ELBOW"),
    ("RIGHT_ELBOW", "RIGHT_WRIST"),
    ("LEFT_SHOULDER", "LEFT_HIP"),
    ("RIGHT_SHOULDER", "RIGHT_HIP"),
    ("LEFT_HIP", "RIGHT_HIP"),
    ("LEFT_HIP", "LEFT_KNEE"),
    ("LEFT_KNEE", "LEFT_ANKLE"),
    ("RIGHT_HIP", "RIGHT_KNEE"),
    ("RIGHT_KNEE", "RIGHT_ANKLE"),
]

_SOFT_JOINTS: list[str] = [
    "LEFT_SHOULDER",
    "RIGHT_SHOULDER",
    "LEFT_ELBOW",
    "RIGHT_ELBOW",
    "LEFT_WRIST",
    "RIGHT_WRIST",
    "LEFT_HIP",
    "RIGHT_HIP",
    "LEFT_KNEE",
    "RIGHT_KNEE",
    "LEFT_ANKLE",
    "RIGHT_ANKLE",
]

_METRIC_BADGE_LABELS: dict[str, str] = {
    "timing": "Timing",
    "drift_forward": "DriftForward",
    "lift_thrust": "Lift&Thrust",
    "front_knee_flexion_fs": "FrontKnee@FS",
    "front_knee_extension_rel": "KneeBrace FS->REL",
    "trunk_stability_v2": "TrunkStabilityV2",
    "trunk_stability": "TrunkStability",
    "release_extension_v2": "ReleaseExtV2",
    "release_extension_proxy": "ReleaseReach",
    "swivel_stabilize": "GloveContain",
}


def _derive_slowmo_factor(
    original_total_frames: int,
    slowmo_total_frames: int,
    original_fps: float,
    slowmo_fps: float,
) -> float:
    """
    Derive slow-motion frame expansion factor used for frame index mapping.

    Prefers frame-count ratio because some slowmo exports keep all frames and
    only lower FPS metadata (frame ratio ~= 1.0 while fps ratio > 1.0).
    """
    if original_total_frames <= 0 or slowmo_total_frames <= 0:
        return 1.0

    frame_ratio = slowmo_total_frames / float(original_total_frames)
    fps_ratio = (
        (original_fps / slowmo_fps)
        if (original_fps > 0 and slowmo_fps > 0)
        else frame_ratio
    )

    if not math.isfinite(frame_ratio) or frame_ratio <= 0:
        frame_ratio = 1.0
    if not math.isfinite(fps_ratio) or fps_ratio <= 0:
        fps_ratio = frame_ratio

    # Choose ratio that best maps the last original frame into slowmo range.
    target_last = max(0, slowmo_total_frames - 1)
    mapped_last_frame_ratio = round((original_total_frames - 1) * frame_ratio)
    mapped_last_fps_ratio = round((original_total_frames - 1) * fps_ratio)
    err_frame = abs(mapped_last_frame_ratio - target_last)
    err_fps = abs(mapped_last_fps_ratio - target_last)

    factor = frame_ratio if err_frame <= err_fps else fps_ratio
    return float(max(0.25, min(8.0, factor)))


def _phase_entries(phases: PitchPhases) -> list[tuple[str, str, Phase]]:
    entries: list[tuple[str, str, Phase]] = []
    for phase_key, phase_title, attr in _PHASE_ORDER:
        phase = getattr(phases, attr)
        if phase is not None:
            entries.append((phase_key, phase_title, phase))
    return entries


def _slowmo_breakpoints(
    phases: PitchPhases,
    slowmo_factor: float,
    slowmo_total_frames: int,
) -> dict[int, list[tuple[str, str, Phase]]]:
    """
    Map phase breakpoints from original frame indices into slowmo frame indices.
    """
    out: dict[int, list[tuple[str, str, Phase]]] = {}
    if slowmo_total_frames <= 0:
        return out
    for phase_key, phase_title, phase in _phase_entries(phases):
        idx = int(round(phase.frame_idx * slowmo_factor))
        idx = max(0, min(slowmo_total_frames - 1, idx))
        out.setdefault(idx, []).append((phase_key, phase_title, phase))
    return out


def _map_slowmo_to_original(
    slowmo_frame_idx: int,
    slowmo_factor: float,
    original_total_frames: int,
) -> int:
    if original_total_frames <= 0:
        return 0
    factor = max(1e-6, slowmo_factor)
    idx = int(round(slowmo_frame_idx / factor))
    return max(0, min(original_total_frames - 1, idx))


def _pose_lookup(poses: list[PoseResult]) -> tuple[list[int], list[PoseResult]]:
    ordered = sorted(poses, key=lambda p: p.frame_idx)
    return [p.frame_idx for p in ordered], ordered


def _nearest_pose(frame_idx: int, pose_indices: list[int], pose_rows: list[PoseResult]) -> Optional[PoseResult]:
    if not pose_indices:
        return None
    i = bisect.bisect_left(pose_indices, frame_idx)
    if i <= 0:
        return pose_rows[0]
    if i >= len(pose_rows):
        return pose_rows[-1]
    before = pose_rows[i - 1]
    after = pose_rows[i]
    if abs(before.frame_idx - frame_idx) <= abs(after.frame_idx - frame_idx):
        return before
    return after


def _draw_soft_skeleton(frame: np.ndarray, pose: Optional[PoseResult]) -> None:
    if pose is None or not pose.valid:
        return
    h, w = frame.shape[:2]
    overlay = frame.copy()

    def _px(name: str) -> Optional[tuple[int, int]]:
        lm = pose.landmarks[KP[name]]
        if np.isnan(lm[0]) or float(lm[2]) < 0.25:
            return None
        return (int(float(lm[0]) * w), int(float(lm[1]) * h))

    line_color = (190, 220, 255)
    joint_color = (255, 255, 255)
    thickness = max(1, int(round(h / 720.0 * 2.0)))

    for a, b in _SOFT_CONNECTIONS:
        pa = _px(a)
        pb = _px(b)
        if pa and pb:
            cv2.line(overlay, pa, pb, line_color, thickness, cv2.LINE_AA)

    for name in _SOFT_JOINTS:
        p = _px(name)
        if p:
            cv2.circle(overlay, p, max(2, thickness + 1), joint_color, -1, cv2.LINE_AA)

    cv2.addWeighted(overlay, 0.70, frame, 0.30, 0.0, frame)


def _badge_color(score: float) -> tuple[int, int, int]:
    if score >= 8.0:
        return (0, 200, 80)
    if score >= 6.0:
        return (0, 200, 240)
    return (30, 30, 240)


def _phase_metric_badges(
    phase_key: str,
    benchmarks: BenchmarkReport,
    min_confidence: float = 0.30,
) -> list[tuple[str, tuple[int, int, int]]]:
    allowed = set(official_metric_names("open_side"))
    badges: list[tuple[str, tuple[int, int, int]]] = []
    for metric_name in _PHASE_CARD_METRICS.get(phase_key, []):
        if metric_name not in allowed:
            continue
        metric = benchmarks.metric_by_name(metric_name)
        if metric is None or metric.status != "ok" or metric.score is None:
            continue
        conf = 1.0 if metric.confidence is None else float(metric.confidence)
        if conf < min_confidence:
            continue
        label = _METRIC_BADGE_LABELS.get(metric_name, metric_name)
        if metric.raw_value is None:
            value = f"{metric.score:.1f}/10"
        elif metric.unit == "boolean":
            value = "PASS" if metric.pass_fail else "FAIL"
        else:
            value = f"{metric.raw_value:.2f}{metric.unit}"
        badges.append((f"{label}: {value}", _badge_color(float(metric.score))))
    return badges


def _draw_phase_card(
    frame: np.ndarray,
    phase_title: str,
    phase_time_s: float,
    badges: list[tuple[str, tuple[int, int, int]]],
) -> np.ndarray:
    out = frame.copy()
    h, w = out.shape[:2]
    scale = h / 720.0
    margin = max(8, int(round(12 * scale)))
    pad = max(6, int(round(8 * scale)))
    title_font = cv2.FONT_HERSHEY_SIMPLEX
    title_scale = 0.95 * scale
    text_scale = 0.45 * scale
    thickness = max(1, int(round(2 * scale)))

    card_h = max(110, int(round(145 * scale)))
    overlay = out.copy()
    cv2.rectangle(
        overlay,
        (margin, margin),
        (w - margin, margin + card_h),
        (12, 12, 18),
        -1,
    )
    cv2.addWeighted(overlay, 0.78, out, 0.22, 0.0, out)
    cv2.rectangle(
        out,
        (margin, margin),
        (w - margin, margin + card_h),
        (100, 100, 120),
        max(1, int(round(scale))),
    )

    x = margin + pad
    y = margin + pad + max(26, int(round(30 * scale)))
    cv2.putText(out, phase_title, (x, y), title_font, title_scale, (230, 230, 240), thickness, cv2.LINE_AA)
    cv2.putText(
        out,
        f"t={phase_time_s:.2f}s",
        (x, y + max(18, int(round(24 * scale)))),
        title_font,
        text_scale,
        (180, 180, 190),
        max(1, thickness - 1),
        cv2.LINE_AA,
    )

    badge_x = x
    badge_y = y + max(34, int(round(46 * scale)))
    for text, color in badges:
        (tw, th), bl = cv2.getTextSize(text, title_font, text_scale, max(1, thickness - 1))
        box_w = tw + pad * 2
        box_h = th + bl + pad * 2
        if badge_x + box_w > w - margin:
            badge_x = x
            badge_y += box_h + max(4, int(round(6 * scale)))
        cv2.rectangle(out, (badge_x, badge_y - box_h), (badge_x + box_w, badge_y), (0, 0, 0), -1)
        cv2.rectangle(out, (badge_x, badge_y - box_h), (badge_x + box_w, badge_y), color, 1)
        cv2.putText(
            out,
            text,
            (badge_x + pad, badge_y - pad),
            title_font,
            text_scale,
            color,
            max(1, thickness - 1),
            cv2.LINE_AA,
        )
        badge_x += box_w + max(6, int(round(8 * scale)))
    return out


def _write_hold_review_video(
    slowmo_path: Path,
    out_path: Path,
    poses: list[PoseResult],
    phases: PitchPhases,
    benchmarks: BenchmarkReport,
    original_total_frames: int,
    original_fps: float,
    hold_seconds: float = 2.0,
    min_confidence: float = 0.30,
    phase_card_hook: Optional[Callable[[str, int], None]] = None,
) -> Optional[Path]:
    """Render hold_review.mp4 from slowmo_review.mp4 with phase-card holds."""
    cap = cv2.VideoCapture(str(slowmo_path))
    if not cap.isOpened():
        return None

    slowmo_fps = float(cap.get(cv2.CAP_PROP_FPS)) or 30.0
    slowmo_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    writer = cv2.VideoWriter(
        str(out_path),
        cv2.VideoWriter_fourcc(*"mp4v"),
        slowmo_fps,
        (width, height),
    )
    if not writer.isOpened():
        cap.release()
        return None

    hold_frames = max(0, int(round(slowmo_fps * hold_seconds)))
    slowmo_factor = _derive_slowmo_factor(
        original_total_frames=original_total_frames,
        slowmo_total_frames=slowmo_total_frames,
        original_fps=original_fps,
        slowmo_fps=slowmo_fps,
    )
    breakpoint_map = _slowmo_breakpoints(phases, slowmo_factor, slowmo_total_frames)
    pose_indices, pose_rows = _pose_lookup(poses)

    slow_idx = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break

        original_idx = _map_slowmo_to_original(
            slowmo_frame_idx=slow_idx,
            slowmo_factor=slowmo_factor,
            original_total_frames=original_total_frames,
        )
        pose = _nearest_pose(original_idx, pose_indices, pose_rows)
        _draw_soft_skeleton(frame, pose)

        phase_events = breakpoint_map.get(slow_idx, [])
        if not phase_events:
            writer.write(frame)
            slow_idx += 1
            continue

        # Keep playback continuous: write current frame, then hold duplicates.
        for phase_key, phase_title, phase in phase_events:
            badges = _phase_metric_badges(
                phase_key=phase_key,
                benchmarks=benchmarks,
                min_confidence=min_confidence,
            )
            hold_frame = _draw_phase_card(frame, phase_title, phase.time_s, badges)
            writer.write(hold_frame)
            if phase_card_hook is not None:
                phase_card_hook(phase_key, slow_idx)
            for _ in range(hold_frames):
                writer.write(hold_frame)

        slow_idx += 1

    writer.release()
    cap.release()
    return out_path


def _process_single_video(video_path: Path, args: argparse.Namespace) -> BenchmarkReport:
    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print(f"\nVideo : {video_path}")
    print(f"        {meta.fps:.1f} fps  |  {meta.frame_count} frames  |  {meta.duration_s:.1f}s")

    # Output directory
    player_slug = slugify(video_path.parent.name)
    clip_slug   = slugify(video_path.stem)
    out_dir     = Path("output/mechanics") / player_slug / clip_slug

    # ---- Extract poses ----
    print("\nExtracting poses (model auto-downloads ~3 MB on first run)...")
    poses = extract_poses(video_path, verbose=args.verbose)
    valid = sum(1 for p in poses if p.valid)
    print(f"Poses : {valid}/{len(poses)} valid detections")
    if valid == 0:
        print("WARNING: No valid poses detected.", file=sys.stderr)

    # ---- Phases ----
    if args.phases:
        print(f"Loading phases from {args.phases}...")
        phases = _load_phases(Path(args.phases))
    else:
        print("Detecting phases...")
        phases = detect_phases(poses, fps=meta.fps, hand=args.hand, debug=True)

    # ---- Benchmarks ----
    print(f"\nComputing benchmarks (view_mode={args.view})...")
    benchmarks = compute_benchmarks(poses, phases, hand=args.hand, view_mode=args.view)

    hold_review_enabled = args.hold_review
    if hold_review_enabled is None:
        hold_review_enabled = bool(args.slowmo)

    # ---- Coach Pack ----
    print("Building coach pack...")
    result = build_coach_pack(
        video_path,
        poses,
        phases,
        benchmarks,
        out_dir,
        include_debug_metrics=args.debug_metrics,
    )
    manual_template = _write_manual_template(out_dir, hand=args.hand, view_mode=args.view)
    slowmo_path: Optional[Path] = None
    if args.slowmo or hold_review_enabled:
        slowmo_path = _write_slowmo_video(
            video_path,
            result.coach_pack_dir / "slowmo_review.mp4",
            playback_scale=0.5,
        )
    hold_review_path: Optional[Path] = None
    if hold_review_enabled and slowmo_path is not None:
        hold_review_path = _write_hold_review_video(
            slowmo_path=slowmo_path,
            out_path=result.coach_pack_dir / "hold_review.mp4",
            poses=poses,
            phases=phases,
            benchmarks=benchmarks,
            original_total_frames=len(poses),
            original_fps=meta.fps,
            hold_seconds=2.0,
            min_confidence=0.30,
        )

    # ---- Summary ----
    print(f"\nCoach pack output: {result.coach_pack_dir}/")
    for attr in [
        "set_png", "peak_leg_lift_png", "foot_strike_png", "release_png",
        "strip_png", "set_to_fs_mp4", "fs_to_release_mp4", "release_mp4",
        "notes_json",
    ]:
        path = getattr(result, attr)
        status = path.name if path else "SKIPPED"
        print(f"  {attr:<22} {status}")
    print(f"  {'manual_template_json':<22} {manual_template.name}")
    if args.slowmo or hold_review_enabled:
        print(f"  {'slowmo_mp4':<22} {slowmo_path.name if slowmo_path else 'SKIPPED'}")
    if hold_review_enabled:
        hold_status = f"{hold_review_path.name} \u2713" if hold_review_path else "SKIPPED"
        print(f"  {'hold_review_mp4':<22} {hold_status}")

    # Print efficiency score
    if benchmarks.efficiency_score is not None:
        print(f"\nEfficiency Score: {benchmarks.efficiency_score:.1f} / 10")
    print()
    return benchmarks


def _process_folder(folder: Path, args: argparse.Namespace) -> None:
    if not folder.exists():
        print(f"ERROR: folder not found: {folder}", file=sys.stderr)
        sys.exit(1)

    player_summaries: dict[str, list[dict]] = {}
    videos = sorted(folder.rglob("*.mp4"))
    if not videos:
        print("No .mp4 files found in folder.")
        return

    for video_path in videos:
        print("=" * 60)
        player_slug = slugify(video_path.parent.name)
        clip_slug = slugify(video_path.stem)
        benchmarks = _process_single_video(video_path, args)
        player_summaries.setdefault(player_slug, []).append({
            "clip": clip_slug,
            "efficiency_score": benchmarks.efficiency_score,
            "top_issues": _top_issues(benchmarks),
        })

    # Write per-player index.json
    for player_slug, clips in player_summaries.items():
        out_dir = Path("output/mechanics") / player_slug
        out_dir.mkdir(parents=True, exist_ok=True)
        idx_path = out_dir / "index.json"
        with open(idx_path, "w") as f:
            json.dump({"player": player_slug, "clips": clips}, f, indent=2)
        print(f"Wrote summary: {idx_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    args = parse_args()
    if args.video:
        _process_single_video(_resolve_path(args.video), args)
    else:
        _process_folder(_resolve_path(args.folder), args)


if __name__ == "__main__":
    main()
