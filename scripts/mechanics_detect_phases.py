#!/usr/bin/env python3
"""
Step C — Pitch phase detection.

Detects five key moments in a pitch and writes phases.json:
  set           — pitcher in set/windup position
  first_movement — first detectable motion
  peak_leg_lift  — lead knee at maximum height
  foot_strike    — lead foot contacts the ground
  ball_release   — throwing wrist peak velocity

Output bundle is written to:
  output/mechanics/<player_slug>/<clip_slug>/phases.json

Usage examples:
  python scripts/mechanics_detect_phases.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

  python scripts/mechanics_detect_phases.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --hand R --out phases.json --debug-dump
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np

from src.mechanics.video_io import read_video_meta
from src.mechanics.pose import extract_poses
from src.mechanics.phases import detect_phases
from src.mechanics.utils import slugify


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Detect pitch phases from a video and write phases.json.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--video",      required=True,              help="Input video path.")
    p.add_argument("--hand",       default="R", choices=["R","L"],
                   help="Pitcher throwing hand. Default: R.")
    p.add_argument("--out",        default=None,
                   help="Output JSON path. Default: output/mechanics/<player>/<clip>/phases.json.")
    p.add_argument("--debug-dump", action="store_true",
                   help="Also write per-frame keypoint array to debug/keypoints.json.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    video_path = Path(args.video)

    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print(f"Video : {video_path}")
    print(f"        {meta.fps:.1f} fps  |  {meta.frame_count} frames  |  {meta.duration_s:.1f}s")

    player_slug = slugify(video_path.parent.name)
    clip_slug   = slugify(video_path.stem)
    out_dir     = Path("output/mechanics") / player_slug / clip_slug
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path    = Path(args.out) if args.out else out_dir / "phases.json"

    print("\nExtracting poses…")
    poses = extract_poses(video_path, verbose=True)

    valid = sum(1 for p in poses if p.valid)
    print(f"Poses : {valid}/{len(poses)} valid detections")

    if valid == 0:
        print("\nWARNING: No poses detected. Check that the pitcher is visible in the frame.")

    print("\nDetecting phases…")
    phases = detect_phases(poses, fps=meta.fps, hand=args.hand, debug=True)

    result = {
        "video":        str(video_path),
        "fps":          meta.fps,
        "total_frames": meta.frame_count,
        "hand":         args.hand,
        "phases":       phases.to_dict(),
    }

    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nPhases written to: {out_path}")

    # Optional: dump raw keypoints for debugging
    if args.debug_dump:
        debug_path = out_dir / "debug" / "keypoints.json"
        debug_path.parent.mkdir(parents=True, exist_ok=True)
        kp_data = [
            {"frame_idx": p.frame_idx, "landmarks": p.landmarks.tolist()}
            for p in poses
        ]
        with open(debug_path, "w") as f:
            json.dump(kp_data, f)
        print(f"Keypoints dumped  : {debug_path}")


if __name__ == "__main__":
    main()
