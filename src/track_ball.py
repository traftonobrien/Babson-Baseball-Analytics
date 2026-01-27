"""Track baseball using classical CV (color + contour + motion detection)."""

import os
import cv2
import numpy as np
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def detect_ball_in_frame(frame, prev_gray, cfg):
    """
    Detect a baseball in a single frame using color filtering, contour analysis,
    and frame differencing.

    Returns ((x, y, radius), current_gray) or (None, current_gray).
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    lower = np.array(cfg["hsv_lower"])
    upper = np.array(cfg["hsv_upper"])
    color_mask = cv2.inRange(hsv, lower, upper)

    # Motion mask via frame differencing
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    if prev_gray is not None:
        diff = cv2.absdiff(gray, prev_gray)
        _, motion_mask = cv2.threshold(diff, cfg["motion_threshold"], 255, cv2.THRESH_BINARY)
        mask = cv2.bitwise_and(color_mask, motion_mask)
    else:
        mask = color_mask

    mask = cv2.erode(mask, None, iterations=1)
    mask = cv2.dilate(mask, None, iterations=2)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_r = cfg["min_radius"]
    max_r = cfg["max_radius"]
    min_circ = cfg["min_circularity"]

    best = None
    for c in contours:
        ((x, y), radius) = cv2.minEnclosingCircle(c)
        if min_r < radius < max_r:
            circularity = cv2.contourArea(c) / (np.pi * radius * radius + 1e-6)
            if circularity > min_circ:
                if best is None or radius > best[2]:
                    best = (float(x), float(y), float(radius))

    return best, gray


def interpolate_gaps(positions, max_gap=2):
    """Fill gaps of up to max_gap missing frames via linear interpolation."""
    if not positions:
        return positions

    frames = sorted(positions.keys())
    for i in range(len(frames) - 1):
        f1, f2 = frames[i], frames[i + 1]
        gap = f2 - f1 - 1
        if 1 <= gap <= max_gap:
            p1 = positions[f1]
            p2 = positions[f2]
            for j in range(1, gap + 1):
                t = j / (gap + 1)
                interp_frame = f1 + j
                positions[interp_frame] = {
                    "x": p1["x"] + t * (p2["x"] - p1["x"]),
                    "y": p1["y"] + t * (p2["y"] - p1["y"]),
                    "radius": p1["radius"] + t * (p2["radius"] - p1["radius"]),
                    "interpolated": True,
                }
    return positions


def track_ball(config):
    """Track the ball across all extracted frames."""
    frames_dir = config["paths"]["frames_dir"]
    ball_cfg = config["ball_detection"]
    frame_files = sorted(
        f for f in os.listdir(frames_dir) if f.endswith(".jpg")
    )

    positions = {}
    prev_gray = None
    for i, fname in enumerate(frame_files):
        frame = cv2.imread(os.path.join(frames_dir, fname))
        result, prev_gray = detect_ball_in_frame(frame, prev_gray, ball_cfg)
        if result:
            positions[i] = {"x": result[0], "y": result[1], "radius": result[2]}

    detected = len(positions)
    positions = interpolate_gaps(positions)
    print(f"Detected ball in {detected}/{len(frame_files)} frames "
          f"({len(positions)} after interpolation)")
    return positions


if __name__ == "__main__":
    config = load_config()
    positions = track_ball(config)

    os.makedirs(config["paths"]["output_dir"], exist_ok=True)
    np.save(os.path.join(config["paths"]["output_dir"], "ball_positions.npy"), positions)
