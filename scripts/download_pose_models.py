#!/usr/bin/env python3
"""
Download pose estimation models for mechanics analysis.

Downloads:
  - MediaPipe Pose Landmarker Lite (~3 MB)
  - ViTPose-B ONNX model (~95 MB) [optional]

Usage:
  python scripts/download_pose_models.py              # MediaPipe only
  python scripts/download_pose_models.py --vitpose    # MediaPipe + ViTPose
  python scripts/download_pose_models.py --all        # All models
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


def main() -> None:
    p = argparse.ArgumentParser(description="Download pose estimation models.")
    p.add_argument("--vitpose", action="store_true", help="Download ViTPose-B ONNX model.")
    p.add_argument("--all", action="store_true", help="Download all available models.")
    args = p.parse_args()

    # Always download MediaPipe model.
    print("=== MediaPipe Pose Landmarker ===")
    from src.mechanics.pose import _ensure_model
    mp_path = _ensure_model()
    print(f"  Path: {mp_path}")
    print(f"  Size: {mp_path.stat().st_size / 1e6:.1f} MB")

    if args.vitpose or args.all:
        print("\n=== ViTPose-B (ONNX) ===")
        try:
            from src.mechanics.pose_vitpose import _ensure_vitpose_model
            vp_path = _ensure_vitpose_model()
            print(f"  Path: {vp_path}")
            print(f"  Size: {vp_path.stat().st_size / 1e6:.1f} MB")
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            sys.exit(1)

    print("\nDone.")


if __name__ == "__main__":
    main()
