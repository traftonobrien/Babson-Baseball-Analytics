#!/usr/bin/env python3
"""
Frame Labeler — scrub through video frames and annotate ground-truth phases.

Usage:
    python scripts/frame_labeler.py --video "Mechanics Analysis/Trafton OBrien/OBrien Mechanics.mov"

Controls:
    Trackbar : scrub to any frame
    s        : mark SET
    m        : mark FIRST MOVEMENT
    p        : mark PEAK LEG LIFT
    l        : mark MOST LOADED
    f        : mark FOOT STRIKE
    w        : mark WEIGHT BEARING
    a        : mark ARM FLIP-UP
    r        : mark BALL RELEASE
    u        : undo last label
    q / ESC  : save and quit

Output:
    Writes labels.json alongside the video (or to --out path).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2

REPO_ROOT = Path(__file__).parent.parent

PHASE_KEYS = {
    ord("s"): "set",
    ord("m"): "first_movement",
    ord("p"): "peak_leg_lift",
    ord("l"): "most_loaded",
    ord("f"): "foot_strike",
    ord("w"): "weight_bearing",
    ord("a"): "arm_flip_up",
    ord("r"): "ball_release",
}

PHASE_COLORS = {
    "set": (0, 255, 255),         # Yellow
    "first_movement": (255, 200, 0),  # Cyan-ish
    "peak_leg_lift": (0, 255, 0),  # Green
    "most_loaded": (255, 0, 255),  # Magenta
    "foot_strike": (0, 165, 255),  # Orange
    "weight_bearing": (0, 100, 255),  # Dark orange
    "arm_flip_up": (255, 100, 0),  # Blue-ish
    "ball_release": (0, 0, 255),   # Red
}


def parse_args():
    parser = argparse.ArgumentParser(description="Frame labeler for phase annotation")
    parser.add_argument("--video", required=True, help="Path to video file")
    parser.add_argument("--out", default=None, help="Output JSON path (default: labels.json next to video)")
    parser.add_argument("--load", default=None, help="Load existing labels JSON to continue editing")
    return parser.parse_args()


def _resolve_path(path_str: str) -> Path:
    p = Path(path_str)
    if p.is_absolute():
        return p
    candidate = REPO_ROOT / path_str
    if candidate.exists():
        return candidate
    return p


def _draw_overlay(frame, frame_idx: int, total_frames: int, labels: dict, fps: float):
    """Draw HUD overlay with current frame info and labels."""
    h, w = frame.shape[:2]
    overlay = frame.copy()

    # Frame info bar at top
    time_s = frame_idx / fps if fps > 0 else 0
    info = f"Frame {frame_idx}/{total_frames - 1}  |  {time_s:.3f}s  |  {fps:.1f} fps"
    cv2.rectangle(overlay, (0, 0), (w, 32), (0, 0, 0), -1)
    cv2.putText(overlay, info, (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

    # Labels panel on the right side
    y_start = 50
    cv2.rectangle(overlay, (w - 260, 38), (w, y_start + len(PHASE_COLORS) * 25 + 10), (0, 0, 0), -1)
    cv2.putText(overlay, "Labels:", (w - 250, y_start), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

    for i, (phase_name, color) in enumerate(PHASE_COLORS.items()):
        y = y_start + 22 + i * 25
        key_char = [chr(k) for k, v in PHASE_KEYS.items() if v == phase_name][0]
        labeled_frame = labels.get(phase_name)

        if labeled_frame is not None:
            text = f"[{key_char}] {phase_name}: frame {labeled_frame}"
            text_color = color
        else:
            text = f"[{key_char}] {phase_name}: ---"
            text_color = (100, 100, 100)

        cv2.putText(overlay, text, (w - 250, y), cv2.FONT_HERSHEY_SIMPLEX, 0.4, text_color, 1)

    # Indicator markers on timeline
    for phase_name, labeled_frame in labels.items():
        if labeled_frame is not None and labeled_frame == frame_idx:
            color = PHASE_COLORS.get(phase_name, (255, 255, 255))
            label_text = phase_name.upper().replace("_", " ")
            cv2.rectangle(overlay, (0, h - 35), (w, h), color, -1)
            cv2.putText(overlay, label_text, (10, h - 12),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Keyboard help at bottom-left
    cv2.putText(overlay, "q/ESC=save+quit  u=undo", (10, h - 45),
                cv2.FONT_HERSHEY_SIMPLEX, 0.35, (150, 150, 150), 1)

    return overlay


def _on_trackbar(pos, state: dict):
    """Trackbar callback — update current frame index."""
    state["frame_idx"] = pos


def main():
    args = parse_args()
    video_path = _resolve_path(args.video)
    if not video_path.exists():
        print(f"ERROR: Video not found: {video_path}")
        sys.exit(1)

    out_path = Path(args.out) if args.out else video_path.parent / "labels.json"

    # Load existing labels if requested or if labels.json already exists
    labels: dict[str, int | None] = {name: None for name in PHASE_COLORS}
    load_path = Path(args.load) if args.load else out_path
    if load_path.exists():
        try:
            existing = json.loads(load_path.read_text())
            for k, v in existing.items():
                if k in labels:
                    labels[k] = v
            print(f"Loaded existing labels from {load_path}")
        except (json.JSONDecodeError, KeyError):
            pass

    # Open video
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"ERROR: Cannot open video: {video_path}")
        sys.exit(1)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

    print(f"Video: {video_path.name}  ({total_frames} frames, {fps:.1f} fps)")
    print("Keyboard shortcuts:")
    for key_code, phase_name in PHASE_KEYS.items():
        print(f"  {chr(key_code)} = {phase_name}")
    print("  u = undo last label")
    print("  q/ESC = save and quit")

    # Window setup
    win_name = f"Frame Labeler — {video_path.name}"
    cv2.namedWindow(win_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(win_name, 1280, 720)

    state = {"frame_idx": 0}
    cv2.createTrackbar("Frame", win_name, 0, max(total_frames - 1, 1),
                       lambda pos: _on_trackbar(pos, state))

    undo_stack: list[tuple[str, int | None]] = []
    prev_frame_idx = -1
    frame = None

    while True:
        fi = state["frame_idx"]

        # Only re-read frame if index changed
        if fi != prev_frame_idx:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
            ret, raw_frame = cap.read()
            if not ret:
                continue
            frame = raw_frame
            prev_frame_idx = fi

        if frame is None:
            continue

        display = _draw_overlay(frame, fi, total_frames, labels, fps)
        cv2.imshow(win_name, display)

        key = cv2.waitKey(30) & 0xFF

        if key == 27 or key == ord("q"):
            break
        elif key == ord("u"):
            if undo_stack:
                phase_name, old_value = undo_stack.pop()
                labels[phase_name] = old_value
                print(f"  Undo: {phase_name} → {old_value}")
        elif key in PHASE_KEYS:
            phase_name = PHASE_KEYS[key]
            undo_stack.append((phase_name, labels[phase_name]))
            labels[phase_name] = fi
            print(f"  Labeled: {phase_name} = frame {fi}  ({fi / fps:.3f}s)")

    # Save labels
    cap.release()
    cv2.destroyAllWindows()

    output = {k: v for k, v in labels.items() if v is not None}
    output["_meta"] = {
        "video": str(video_path.name),
        "total_frames": total_frames,
        "fps": fps,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2) + "\n")
    print(f"\nSaved {len(output) - 1} labels to {out_path}")


if __name__ == "__main__":
    main()
