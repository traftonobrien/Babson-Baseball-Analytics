"""Calibration tool: compute pixels-per-inch from home plate width."""

import argparse
import os
import cv2
import numpy as np
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


_points = []
_clone = None


def _mouse_callback(event, x, y, flags, param):
    global _clone
    if event == cv2.EVENT_LBUTTONDOWN and len(_points) < 2:
        _points.append((x, y))
        cv2.circle(_clone, (x, y), 5, (0, 0, 255), -1)
        if len(_points) == 2:
            cv2.line(_clone, _points[0], _points[1], (0, 0, 255), 2)
        cv2.imshow("Calibrate", _clone)


def interactive_calibrate(frame, plate_width_inches):
    """Open a window for user to click two home plate edge points."""
    global _points, _clone
    _points = []
    _clone = frame.copy()

    print(f"Click the two edges of home plate ({plate_width_inches}\" width), then press any key.")
    cv2.imshow("Calibrate", _clone)
    cv2.setMouseCallback("Calibrate", _mouse_callback)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    if len(_points) < 2:
        raise RuntimeError("Need exactly 2 points")

    pixel_dist = np.hypot(_points[1][0] - _points[0][0], _points[1][1] - _points[0][1])
    ppi = pixel_dist / plate_width_inches
    return ppi


def save_ppi(ppi, config_path="config.yaml"):
    with open(config_path) as f:
        raw = f.read()
    # Replace the pixels_per_inch line
    import re
    raw = re.sub(
        r"pixels_per_inch:.*",
        f"pixels_per_inch: {ppi:.4f}",
        raw,
    )
    with open(config_path, "w") as f:
        f.write(raw)
    print(f"Saved pixels_per_inch: {ppi:.4f} to {config_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calibrate pixels per inch")
    parser.add_argument("--ppi", type=float, help="Set pixels_per_inch directly (skip interactive)")
    parser.add_argument("--frame", type=int, default=0, help="Frame index to use for calibration")
    args = parser.parse_args()

    config = load_config()

    if args.ppi is not None:
        save_ppi(args.ppi)
    else:
        frames_dir = config["paths"]["frames_dir"]
        frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".jpg"))
        frame_img = cv2.imread(os.path.join(frames_dir, frame_files[args.frame]))
        plate_width = config["calibration"]["plate_width_inches"]
        ppi = interactive_calibrate(frame_img, plate_width)
        save_ppi(ppi)
