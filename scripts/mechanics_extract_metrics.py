#!/usr/bin/env python3
"""
Step D — Mechanics metric extraction.

Computes coaching-style metrics and writes:
  metrics.json  — computed values
  report.png    — 2x2 key-frame collage with skeleton + metric summary strip

Metrics computed:
  stride_length_px     — ankle-to-ankle distance at foot strike
  stride_length_norm   — stride / shoulder_width (body units)
  trunk_lean_deg       — torso angle from vertical at foot strike
  hip_shoulder_sep_deg — hip-axis vs shoulder-axis rotation at foot strike
  arm_slot_deg         — upper arm elevation from horizontal at release

Output bundle:
  output/mechanics/<player_slug>/<clip_slug>/
    metrics.json
    report.png

Usage examples:
  # Run all steps in one go (auto-detects phases internally):
  python scripts/mechanics_extract_metrics.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

  # Use pre-computed phases from Step C:
  python scripts/mechanics_extract_metrics.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --phases output/mechanics/jason_finkelstein/pitch_test/phases.json

  # Custom output paths:
  python scripts/mechanics_extract_metrics.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --out metrics.json --report report.png
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

from src.mechanics.video_io import read_video_meta
from src.mechanics.pose import extract_poses, draw_skeleton, PoseResult
from src.mechanics.phases import detect_phases, Phase, PitchPhases
from src.mechanics.metrics import extract_metrics, Metrics
from src.mechanics.utils import add_text_overlay, phase_color, slugify


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Extract mechanics metrics and build a report image.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--video",   required=True,             help="Input video path.")
    p.add_argument("--phases",  default=None,
                   help="Path to phases.json from Step C (optional; auto-detected if omitted).")
    p.add_argument("--hand",    default="R", choices=["R","L"],
                   help="Pitcher throwing hand. Default: R.")
    p.add_argument("--out",     default=None,              help="Output metrics JSON path.")
    p.add_argument("--report",  default=None,              help="Output report PNG path.")
    return p.parse_args()


# ---------------------------------------------------------------------------
# Report image builder
# ---------------------------------------------------------------------------

def _load_frame(cap: cv2.VideoCapture, frame_idx: int) -> Optional[np.ndarray]:
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    return frame if ret else None


def build_report(
    video_path: Path,
    poses: list[PoseResult],
    phases: PitchPhases,
    metrics: Metrics,
    out_path: Path,
) -> None:
    """
    Build a 2x2 key-frame collage with skeleton overlay and metrics strip.

    Layout:
      [ SET            | PEAK LEG LIFT ]
      [ FOOT STRIKE    | BALL RELEASE  ]
      [         metrics summary        ]
    """
    PANEL_W, PANEL_H = 320, 240
    pose_map = {p.frame_idx: p for p in poses}

    key_phases = [
        ("set",           phases.set_pos),
        ("peak_leg_lift", phases.peak_leg_lift),
        ("foot_strike",   phases.foot_strike),
        ("ball_release",  phases.ball_release),
    ]

    cap = cv2.VideoCapture(str(video_path))
    panels = []

    for phase_name, phase in key_phases:
        color = phase_color(phase_name)
        if phase is None:
            panel = np.zeros((PANEL_H, PANEL_W, 3), dtype=np.uint8)
            panel = add_text_overlay(panel, f"{phase_name.replace('_',' ').upper()}: N/A",
                                     pos=(10, PANEL_H // 2), color=color)
        else:
            frame = _load_frame(cap, phase.frame_idx)
            if frame is None:
                panel = np.zeros((PANEL_H, PANEL_W, 3), dtype=np.uint8)
            else:
                pose = pose_map.get(phase.frame_idx)
                if pose and pose.valid:
                    frame = draw_skeleton(frame, pose, color=color)
                panel = cv2.resize(frame, (PANEL_W, PANEL_H))

            # Top label
            label = phase_name.replace("_", " ").upper()
            panel = add_text_overlay(panel, label, pos=(5, 20), scale=0.55, color=color)
            # Bottom timestamp
            panel = add_text_overlay(panel,
                                     f"t={phase.time_s:.2f}s  f={phase.frame_idx}",
                                     pos=(5, PANEL_H - 8), scale=0.4,
                                     color=(200, 200, 200))
        panels.append(panel)

    cap.release()

    # Ensure we always have 4 panels
    while len(panels) < 4:
        panels.append(np.zeros((PANEL_H, PANEL_W, 3), dtype=np.uint8))

    row1    = np.hstack(panels[0:2])
    row2    = np.hstack(panels[2:4])
    collage = np.vstack([row1, row2])

    # Metrics strip at the bottom
    strip_h = 130
    strip   = np.full((strip_h, collage.shape[1], 3), 15, dtype=np.uint8)  # dark bg
    m = metrics.to_dict()

    def _fmt(key: str, label: str, unit: str = "") -> str:
        v = m.get(key)
        if v is None:
            return f"{label}: N/A"
        return f"{label}: {v}{unit}"

    lines = [
        _fmt("stride_length_px",     "Stride (px)"),
        _fmt("stride_length_norm",   "Stride (x shoulder width)"),
        _fmt("trunk_lean_deg",       "Trunk lean",        "°"),
        _fmt("hip_shoulder_sep_deg", "Hip/shoulder sep",  "°"),
        _fmt("arm_slot_deg",         "Arm slot",          "° (side-view approx)"),
    ]

    for i, line in enumerate(lines):
        add_text_overlay(strip, line, pos=(15, 18 + i * 22),
                         scale=0.5, color=(210, 210, 210), bg=False,
                         thickness=1)
    # Write to strip in-place (add_text_overlay returns copy; use directly)
    strip_out = np.full((strip_h, collage.shape[1], 3), 15, dtype=np.uint8)
    for i, line in enumerate(lines):
        cv2.putText(strip_out, line, (15, 18 + i * 22),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (210, 210, 210), 1, cv2.LINE_AA)

    report = np.vstack([collage, strip_out])
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), report)
    print(f"Report image : {out_path}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _load_phases_from_json(path: Path) -> PitchPhases:
    with open(path) as f:
        data = json.load(f)

    def _phase(d) -> Optional[Phase]:
        if d is None:
            return None
        return Phase(**d)

    pd = data["phases"]
    return PitchPhases(
        set_pos=       _phase(pd.get("set")),
        first_movement=_phase(pd.get("first_movement")),
        peak_leg_lift= _phase(pd.get("peak_leg_lift")),
        most_loaded=   _phase(pd.get("most_loaded")),
        foot_strike=   _phase(pd.get("foot_strike")),
        weight_bearing=_phase(pd.get("weight_bearing")),
        arm_flip_up=   _phase(pd.get("arm_flip_up")),
        ball_release=  _phase(pd.get("ball_release")),
        fps=           data["fps"],
    )


def main() -> None:
    args = parse_args()
    video_path = Path(args.video)

    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print(f"Video : {video_path}")
    print(f"        {meta.fps:.1f} fps  |  {meta.frame_count} frames")

    player_slug = slugify(video_path.parent.name)
    clip_slug   = slugify(video_path.stem)
    out_dir     = Path("output/mechanics") / player_slug / clip_slug
    out_dir.mkdir(parents=True, exist_ok=True)

    out_metrics = Path(args.out)    if args.out    else out_dir / "metrics.json"
    out_report  = Path(args.report) if args.report else out_dir / "report.png"

    print("\nExtracting poses…")
    poses = extract_poses(video_path, verbose=True)

    if args.phases:
        print(f"Loading phases from {args.phases}…")
        phases = _load_phases_from_json(Path(args.phases))
    else:
        print("Detecting phases…")
        phases = detect_phases(poses, fps=meta.fps, hand=args.hand, debug=True)

    print("\nExtracting metrics…")
    metrics = extract_metrics(poses, phases, hand=args.hand)

    # Save metrics JSON
    result = {
        "video": str(video_path),
        "hand":  args.hand,
        "phases_at": {
            k: (getattr(phases, k).frame_idx if getattr(phases, k) else None)
            for k in ("set_pos", "peak_leg_lift", "foot_strike", "ball_release")
        },
        "metrics": metrics.to_dict(),
    }
    with open(out_metrics, "w") as f:
        json.dump(result, f, indent=2)
    print(f"Metrics JSON : {out_metrics}")

    # Print summary table
    print("\n  Metric                       Value")
    print("  " + "-" * 40)
    m = metrics.to_dict()
    rows = [
        ("stride_length_px",     "Stride length (px)"),
        ("stride_length_norm",   "Stride length (x shoulder)"),
        ("trunk_lean_deg",       "Trunk lean at foot strike (deg)"),
        ("hip_shoulder_sep_deg", "Hip/shoulder separation (deg)"),
        ("arm_slot_deg",         "Arm slot (deg, side approx)"),
        ("shoulder_width_px",    "Shoulder width ref (px)"),
    ]
    for key, label in rows:
        v = m.get(key)
        print(f"  {label:<33} {v if v is not None else 'N/A'}")
    if m.get("notes"):
        print(f"\n  Notes: {m['notes']}")

    print("\nBuilding report image…")
    build_report(video_path, poses, phases, metrics, out_report)

    print(f"\nAll outputs in: {out_dir}/")


if __name__ == "__main__":
    main()
