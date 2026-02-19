#!/usr/bin/env python3
"""
Step B — Pose estimation overlay (MediaPipe Pose).

Runs MediaPipe Pose on every frame and writes an annotated MP4.
The skeleton (33 landmarks + connections) is drawn in green.
Low-visibility keypoints are skipped.

Usage examples:
  python scripts/mechanics_pose_overlay.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

  python scripts/mechanics_pose_overlay.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --out output/overlay.mp4 --max-frames 60 --debug
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import cv2

from src.mechanics.video_io import read_video_meta, iter_frames
from src.mechanics.pose import extract_poses, draw_skeleton
from src.mechanics.utils import add_text_overlay, slugify


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run MediaPipe Pose on a video and write an annotated MP4.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--video",      required=True, help="Input video path.")
    p.add_argument("--out",        default=None,  help="Output MP4 path (default: auto).")
    p.add_argument("--max-frames", type=int, default=None,
                   help="Process only the first N frames (useful for quick checks).")
    p.add_argument("--debug",      action="store_true",
                   help="Overlay keypoint visibility scores for selected joints.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    video_path = Path(args.video)

    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print(f"Video: {video_path}  |  {meta.fps:.1f} fps  |  {meta.frame_count} frames")

    # Default output path
    if args.out is None:
        out_dir = Path("output/mechanics_debug") / slugify(video_path.stem)
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "pose_overlay.mp4"
    else:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Output : {out_path}")
    print("Extracting poses… (may take a moment on first run)")

    poses = extract_poses(video_path, max_frames=args.max_frames, verbose=args.debug)

    valid = sum(1 for p in poses if p.valid)
    print(f"Poses  : {valid}/{len(poses)} frames with valid detection")

    # Build a frame-index → PoseResult lookup
    pose_map = {p.frame_idx: p for p in poses}
    frame_limit = len(poses)

    print("Writing annotated video…")
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(out_path), fourcc, meta.fps, (meta.width, meta.height))

    debug_joints = ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE", "RIGHT_WRIST"]

    for frame_idx, frame_bgr in iter_frames(video_path, end=frame_limit):
        pose = pose_map.get(frame_idx)

        if pose and pose.valid:
            annotated = draw_skeleton(frame_bgr, pose)
            label_color = (0, 255, 0)
            label = f"Frame {frame_idx} | POSE OK"
        else:
            annotated = frame_bgr.copy()
            label_color = (0, 0, 255)
            label = f"Frame {frame_idx} | NO POSE"

        annotated = add_text_overlay(annotated, label, color=label_color)

        if args.debug and pose and pose.valid:
            for i, jname in enumerate(debug_joints):
                vis = pose.visibility(jname)
                color = (0, 255, 0) if vis > 0.5 else (0, 100, 255)
                annotated = add_text_overlay(
                    annotated,
                    f"{jname}: {vis:.2f}",
                    pos=(10, 60 + i * 25),
                    scale=0.5,
                    color=color,
                )

        writer.write(annotated)

    writer.release()
    print(f"\nDone. Annotated video: {out_path}")


if __name__ == "__main__":
    main()
