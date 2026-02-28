#!/usr/bin/env python3
"""
Interactive tool to map the 4 corners of the pitching rubber in 2D pixel space.

Usage:
  .venv/bin/python scripts/select_rubber.py --video path/to/video.mp4 --hand R
  .venv/bin/python scripts/select_rubber.py --video path/to/video.mp4 --hand L

Controls:
  LEFT CLICK: Place a corner marker (up to 4)
  RIGHT CLICK: Remove the last placed marker
  ENTER: Save calibration and exit
  ESC: Cancel and exit
  LEFT/RIGHT ARROWS / TRACKBAR: Scrub through video frames to find a clear view
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import cv2
import numpy as np

WINDOW_NAME = "Select Pitching Rubber (4 Corners)"
CALIBRATION_FILE = Path("camera_calibration.json")

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Map 4 corners of pitching rubber")
    parser.add_argument("--video", type=str, required=True, help="Path to video file")
    parser.add_argument("--hand", type=str, choices=["R", "L", "B"], default="R", help="Handedness (R or L)")
    return parser.parse_args()

def main() -> None:
    args = parse_args()
    video_path = Path(args.video)
    if not video_path.exists():
        print(f"ERROR: Video not found at {video_path}")
        sys.exit(1)

    print(f"Loading {video_path.name}...")
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print("ERROR: Could not open video file.")
        sys.exit(1)

    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
    cap.release()
    
    if not frames:
        print("ERROR: Failed to read any frames.")
        sys.exit(1)

    total_frames = len(frames)
    print(f"Loaded {total_frames} frames.")
    
    # Check for existing calibration
    points = []
    full_data = {}
    if CALIBRATION_FILE.exists():
        try:
            with open(CALIBRATION_FILE, "r") as f:
                full_data = json.load(f)
                
            hand_group = full_data.get(args.hand, {})
            points = [tuple(p) for p in hand_group.get("rubber_corners_px", [])]
            if points:
                print(f"Loaded {len(points)} existing points for hand '{args.hand}'.")
        except Exception as e:
            print(f"Warning: Could not read {CALIBRATION_FILE}: {e}")

    # GUI State
    state = {
        "current_pos": 0,
        "points": points[:4],  # Max 4 points: FL, FR, BR, BL
        "need_redraw": True
    }

    def on_mouse(event, x, y, flags, param):
        if event == cv2.EVENT_LBUTTONDOWN:
            if len(state["points"]) < 4:
                state["points"].append((x, y))
                state["need_redraw"] = True
        elif event == cv2.EVENT_RBUTTONDOWN:
            if state["points"]:
                state["points"].pop()
                state["need_redraw"] = True

    def on_trackbar(val):
        pass  # Handled in loop

    cv2.namedWindow(WINDOW_NAME, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(WINDOW_NAME, 1280, 720)
    cv2.createTrackbar("Frame", WINDOW_NAME, 0, max(1, total_frames - 1), on_trackbar)
    cv2.setMouseCallback(WINDOW_NAME, on_mouse)

    print("\nInstructions:")
    print("  Use trackbar or arrow keys to find a frame where the rubber is clear.")
    print("  LEFT CLICK to place corners in order: Front-Left, Front-Right, Back-Right, Back-Left.")
    print("  RIGHT CLICK to undo.")
    print("  ENTER to save. ESC to cancel.\n")

    while True:
        tb_pos = cv2.getTrackbarPos("Frame", WINDOW_NAME)
        if tb_pos != state["current_pos"]:
            state["current_pos"] = tb_pos
            state["need_redraw"] = True

        if state["need_redraw"]:
            display = frames[state["current_pos"]].copy()
            
            # Draw frame info
            cv2.putText(display, f"Frame: {state['current_pos']} / {total_frames-1}", (15, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
            cv2.putText(display, f"Points: {len(state['points'])}/4 (Order: FL -> FR -> BR -> BL)", (15, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2, cv2.LINE_AA)
            
            # Draw edges
            pts = state["points"]
            if len(pts) > 1:
                for i in range(len(pts) - 1):
                    cv2.line(display, pts[i], pts[i+1], (0, 255, 255), 2, cv2.LINE_AA)
            if len(pts) == 4:
                # Close the polygon
                cv2.line(display, pts[3], pts[0], (0, 255, 255), 2, cv2.LINE_AA)
                
                # Draw front edge in bright green
                cv2.line(display, pts[0], pts[1], (0, 255, 0), 3, cv2.LINE_AA)
                
            # Draw points
            for i, p in enumerate(pts):
                color = (0, 255, 0) if i < 2 else (0, 165, 255)
                cv2.circle(display, p, 5, color, -1, cv2.LINE_AA)
                cv2.putText(display, str(i+1), (p[0]+10, p[1]-10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2, cv2.LINE_AA)
                
            cv2.imshow(WINDOW_NAME, display)
            state["need_redraw"] = False

        key = cv2.waitKey(30) & 0xFF
        
        if key == 27:  # ESC
            print("Cancelled.")
            break
        elif key in (13, 10):  # ENTER
            if len(state["points"]) != 4:
                print("Wait! You must select exactly 4 corners of the rubber before saving.")
            else:
                full_data[args.hand] = {
                    "rubber_corners_px": state["points"],
                    "frame_labeled": state["current_pos"]
                }
                with open(CALIBRATION_FILE, "w") as f:
                    json.dump(full_data, f, indent=2)
                print(f"\nSaved 4 corners for Hand '{args.hand}' to {CALIBRATION_FILE.resolve()}")
                break
        elif key == 81:  # Left arrow (Mac/Linux)
            state["current_pos"] = max(0, state["current_pos"] - 1)
            cv2.setTrackbarPos("Frame", WINDOW_NAME, state["current_pos"])
        elif key == 83:  # Right arrow (Mac/Linux)
            state["current_pos"] = min(total_frames - 1, state["current_pos"] + 1)
            cv2.setTrackbarPos("Frame", WINDOW_NAME, state["current_pos"])

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
