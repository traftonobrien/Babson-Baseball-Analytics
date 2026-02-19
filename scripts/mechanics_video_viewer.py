#!/usr/bin/env python3
"""
Step A — Video I/O + frame scrubber (OpenCV).

Loads a video and lets you inspect it frame by frame.
Prints FPS, duration, and frame count on startup.

Controls:
  SPACE       play / pause
  D or →      step forward one frame
  A or ←      step backward one frame
  S           save current frame as PNG to --out-dir
  Q or ESC    quit

Usage examples:
  python scripts/mechanics_video_viewer.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

  python scripts/mechanics_video_viewer.py \\
      --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \\
      --out-dir output/mechanics_debug --start 10 --step 2
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2

from src.mechanics.video_io import read_video_meta, save_frame
from src.mechanics.utils import add_text_overlay, slugify


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Interactive frame-by-frame video viewer for mechanics analysis.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--video",    required=True, help="Path to input video file.")
    p.add_argument("--out-dir",  default="output/mechanics_debug",
                   help="Directory for saved frames. Default: output/mechanics_debug.")
    p.add_argument("--start",    type=int, default=0,  help="Start frame (0-based). Default: 0.")
    p.add_argument("--step",     type=int, default=1,
                   help="Frames to advance per play tick. Default: 1.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    video_path = Path(args.video)

    if not video_path.exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        sys.exit(1)

    meta = read_video_meta(video_path)
    print()
    print(f"  Video    : {video_path}")
    print(f"  FPS      : {meta.fps:.2f}")
    print(f"  Frames   : {meta.frame_count}")
    print(f"  Size     : {meta.width} x {meta.height}")
    print(f"  Duration : {meta.duration_s:.2f} s")
    print()
    print("  Controls: SPACE=play/pause  A/←=back  D/→=forward  S=save  Q/ESC=quit")
    print()

    out_dir = Path(args.out_dir) / slugify(video_path.stem)
    current = args.start
    playing = False
    saved_count = 0

    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, current)

    cv2.namedWindow("Mechanics Viewer", cv2.WINDOW_NORMAL)
    cv2.resizeWindow("Mechanics Viewer", min(meta.width, 1280), min(meta.height, 720))

    last_frame = None  # cache so we can re-display without re-reading

    while True:
        if playing:
            for _ in range(args.step):
                ret, frame = cap.read()
                if not ret:
                    playing = False
                    break
                current += 1
                last_frame = frame
        else:
            if last_frame is None:
                cap.set(cv2.CAP_PROP_POS_FRAMES, current)
                ret, frame = cap.read()
                if ret:
                    last_frame = frame

        frame = last_frame
        if frame is None:
            break

        # Clamp display index
        display_idx = min(current, meta.frame_count - 1)
        time_s = display_idx / meta.fps
        status  = "PLAYING" if playing else "PAUSED"

        disp = add_text_overlay(frame, f"Frame {display_idx}/{meta.frame_count - 1}  {time_s:.2f}s",
                                pos=(10, 30))
        disp = add_text_overlay(disp, status, pos=(10, 60),
                                color=(0, 255, 255) if playing else (180, 180, 180))

        cv2.imshow("Mechanics Viewer", disp)

        # Wait duration: full frame interval when playing, 50 ms when paused
        delay = max(1, int(1000 / meta.fps)) if playing else 50
        key = cv2.waitKey(delay) & 0xFF

        if key in (ord("q"), 27):          # Q or ESC
            break
        elif key == ord(" "):
            playing = not playing
        elif key in (ord("d"), 83):        # D or right arrow
            playing = False
            current = min(current + 1, meta.frame_count - 1)
            cap.set(cv2.CAP_PROP_POS_FRAMES, current)
            last_frame = None              # force re-read
        elif key in (ord("a"), 81):        # A or left arrow
            playing = False
            current = max(args.start, current - 1)
            cap.set(cv2.CAP_PROP_POS_FRAMES, current)
            last_frame = None
        elif key == ord("s"):
            out_dir.mkdir(parents=True, exist_ok=True)
            out_path = out_dir / f"frame_{display_idx:05d}.png"
            save_frame(frame, out_path)
            saved_count += 1
            print(f"  Saved: {out_path}")

    cap.release()
    cv2.destroyAllWindows()

    if saved_count:
        print(f"\nSaved {saved_count} frame(s) to {out_dir}/")


if __name__ == "__main__":
    main()
