"""Calibration tool: compute pixels-per-inch from home plate width."""

import argparse
import json
import os
import cv2
import numpy as np
import yaml


def load_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


def _load_frame(config, frame_idx=0, video_path=None):
    """Load a calibration/ROI frame from video or standalone frames_dir."""
    if video_path:
        cap = cv2.VideoCapture(video_path)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame_img = cap.read()
        cap.release()
        if not ret:
            raise RuntimeError(f"Cannot read frame {frame_idx} from video: {video_path}")
        return frame_img

    frames_dir = config["paths"]["frames_dir"]
    frame_files = sorted(f for f in os.listdir(frames_dir) if f.endswith(".jpg"))
    if frame_idx >= len(frame_files):
        raise RuntimeError(f"Frame index {frame_idx} out of range for {frames_dir}")
    frame_img = cv2.imread(os.path.join(frames_dir, frame_files[frame_idx]))
    if frame_img is None:
        raise RuntimeError(f"Cannot read frame {frame_idx} from {frames_dir}")
    return frame_img


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
    center_x = (_points[0][0] + _points[1][0]) / 2
    return ppi, center_x


_rect_start = None
_rect_end = None
_drawing = False
_roi_clone = None


def _roi_callback(event, x, y, flags, param):
    global _rect_start, _rect_end, _drawing, _roi_clone
    if event == cv2.EVENT_LBUTTONDOWN:
        _rect_start = (x, y)
        _drawing = True
    elif event == cv2.EVENT_MOUSEMOVE and _drawing:
        _rect_end = (x, y)
        _roi_clone = param.copy()
        cv2.rectangle(_roi_clone, _rect_start, _rect_end, (0, 255, 0), 2)
        cv2.imshow("Select ROI", _roi_clone)
    elif event == cv2.EVENT_LBUTTONUP:
        _rect_end = (x, y)
        _drawing = False
        _roi_clone = param.copy()
        cv2.rectangle(_roi_clone, _rect_start, _rect_end, (0, 255, 0), 2)

        # Draw sub-regions: left 40% = pitcher, right 40% = catcher
        rx = min(_rect_start[0], _rect_end[0])
        ry = min(_rect_start[1], _rect_end[1])
        rw = abs(_rect_end[0] - _rect_start[0])
        rh = abs(_rect_end[1] - _rect_start[1])
        catcher_x = rx + int(rw * 0.6)
        cv2.rectangle(_roi_clone, (catcher_x, ry), (rx + rw, ry + rh), (0, 165, 255), 1)
        cv2.putText(_roi_clone, "CATCHER", (catcher_x + 5, ry + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 165, 255), 1)
        cv2.putText(_roi_clone, "PITCHER", (rx + 5, ry + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        cv2.imshow("Select ROI", _roi_clone)


def interactive_set_roi(frame):
    """Open a window for user to draw an ROI rectangle.

    Returns (x, y, width, height).
    """
    global _rect_start, _rect_end, _drawing, _roi_clone
    _rect_start = None
    _rect_end = None
    _drawing = False

    print("Draw a rectangle around the pitcher-catcher area, then press Enter.")
    print("Exclude crowd, signs, dugouts. The right 40% will be the catcher region.")
    win = "Select ROI"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(win, _roi_callback, frame)
    cv2.imshow(win, frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

    if _rect_start is None or _rect_end is None:
        raise RuntimeError("No ROI drawn")

    x = min(_rect_start[0], _rect_end[0])
    y = min(_rect_start[1], _rect_end[1])
    w = abs(_rect_end[0] - _rect_start[0])
    h = abs(_rect_end[1] - _rect_start[1])

    if w < 50 or h < 50:
        raise RuntimeError("ROI too small")

    return x, y, w, h


def save_roi(x, y, w, h, config_path="config.yaml"):
    """Save detection_roi to config.yaml."""
    with open(config_path) as f:
        raw = f.read()

    roi_block = (f"detection_roi:\n"
                 f"  x: {x}\n"
                 f"  y: {y}\n"
                 f"  width: {w}\n"
                 f"  height: {h}\n")

    if "detection_roi:" in raw:
        import re
        raw = re.sub(
            r"detection_roi:\n(?:  \w+:.*\n)*",
            roi_block,
            raw,
        )
    else:
        raw = raw.rstrip() + "\n\n" + roi_block

    with open(config_path, "w") as f:
        f.write(raw)
    print(f"Saved detection_roi: x={x}, y={y}, w={w}, h={h} to {config_path}")


def save_outing_roi(x, y, w, h, outing_dir, pitch_log_path=None):
    """Save ROI to <outing_dir>/roi.json and optionally update pitch_log.json."""
    os.makedirs(outing_dir, exist_ok=True)
    roi = {"x": x, "y": y, "width": w, "height": h}

    roi_path = os.path.join(outing_dir, "roi.json")
    with open(roi_path, "w") as f:
        json.dump(roi, f, indent=2)
    print(f"Saved ROI to {roi_path}")

    if pitch_log_path and os.path.exists(pitch_log_path):
        with open(pitch_log_path) as f:
            log_data = json.load(f)
        if isinstance(log_data, dict):
            log_data["roi"] = roi
            with open(pitch_log_path, "w") as f:
                json.dump(log_data, f, indent=2)
            print(f"Updated ROI in {pitch_log_path}")


def save_calibration(ppi, plate_center_x=None, config_path="config.yaml"):
    with open(config_path) as f:
        raw = f.read()
    import re
    raw = re.sub(
        r"pixels_per_inch:.*",
        f"pixels_per_inch: {ppi:.4f}",
        raw,
    )
    if plate_center_x is not None:
        if "plate_center_x:" in raw:
            raw = re.sub(r"plate_center_x:.*", f"plate_center_x: {plate_center_x:.1f}", raw)
        else:
            raw = re.sub(
                r"(pixels_per_inch:.*)",
                rf"\1\n  plate_center_x: {plate_center_x:.1f}",
                raw,
            )
    with open(config_path, "w") as f:
        f.write(raw)
    print(f"Saved pixels_per_inch: {ppi:.4f} to {config_path}")
    if plate_center_x is not None:
        print(f"Saved plate_center_x: {plate_center_x:.1f} to {config_path}")


def save_outing_calibration(ppi, plate_center_x=None, plate_width_inches=None,
                            outing_dir=None, pitch_log_path=None):
    """Save calibration to <outing_dir>/calibration.json and optionally pitch_log."""
    if outing_dir is None:
        raise RuntimeError("outing_dir is required for save_outing_calibration")

    os.makedirs(outing_dir, exist_ok=True)
    calibration = {
        "pixels_per_inch": round(float(ppi), 4),
    }
    if plate_center_x is not None:
        calibration["plate_center_x"] = round(float(plate_center_x), 1)
    if plate_width_inches is not None:
        calibration["plate_width_inches"] = float(plate_width_inches)

    calibration_path = os.path.join(outing_dir, "calibration.json")
    with open(calibration_path, "w") as f:
        json.dump(calibration, f, indent=2)
    print(f"Saved calibration to {calibration_path}")

    if pitch_log_path and os.path.exists(pitch_log_path):
        with open(pitch_log_path) as f:
            log_data = json.load(f)
        if isinstance(log_data, dict):
            log_data["calibration"] = calibration
            with open(pitch_log_path, "w") as f:
                json.dump(log_data, f, indent=2)
            print(f"Updated calibration in {pitch_log_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calibrate pixels per inch / set detection ROI")
    parser.add_argument("--ppi", type=float, help="Set pixels_per_inch directly (skip interactive)")
    parser.add_argument("--plate-center-x", type=float,
                        help="Set plate_center_x directly when using --ppi")
    parser.add_argument("--plate-width-inches", type=float, default=None,
                        help="Override plate width inches used for calibration metadata")
    parser.add_argument("--frame", type=int, default=0, help="Frame index to use for calibration")
    parser.add_argument("--set-roi", action="store_true",
                        help="Interactively set the detection ROI")
    parser.add_argument("--outing-dir", type=str, default=None,
                        help="Save ROI/calibration to <outing_dir> instead of config.yaml")
    parser.add_argument("--pitch-log", type=str, default=None,
                        help="Optional pitch_log.json path to update with outing ROI/calibration")
    parser.add_argument("--video", type=str, default=None,
                        help="Video file to grab a frame from (for calibration or --set-roi)")
    args = parser.parse_args()

    config = load_config()
    plate_width = args.plate_width_inches or config["calibration"]["plate_width_inches"]
    pitch_log_path = args.pitch_log
    if pitch_log_path is None and args.outing_dir:
        pitch_log_path = os.path.join(args.outing_dir, "pitch_log.json")

    if args.set_roi:
        frame_img = _load_frame(config, args.frame, args.video)
        x, y, w, h = interactive_set_roi(frame_img)
        if args.outing_dir:
            save_outing_roi(x, y, w, h, args.outing_dir, pitch_log_path)
        else:
            save_roi(x, y, w, h)
    elif args.ppi is not None:
        if args.outing_dir:
            save_outing_calibration(
                args.ppi,
                plate_center_x=args.plate_center_x,
                plate_width_inches=plate_width,
                outing_dir=args.outing_dir,
                pitch_log_path=pitch_log_path,
            )
        else:
            save_calibration(args.ppi, args.plate_center_x)
    else:
        frame_img = _load_frame(config, args.frame, args.video)
        ppi, center_x = interactive_calibrate(frame_img, plate_width)
        if args.outing_dir:
            save_outing_calibration(
                ppi,
                plate_center_x=center_x,
                plate_width_inches=plate_width,
                outing_dir=args.outing_dir,
                pitch_log_path=pitch_log_path,
            )
        else:
            save_calibration(ppi, center_x)
