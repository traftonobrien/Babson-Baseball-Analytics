"""Batch pitch processor with SAM 2 on mini-clips.

Supports two modes:
  --fast (default): image predictor only, no overlay video, minimal disk I/O
  --debug:          full SAM 2 video propagation + overlay video + result PNG
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time

import cv2
import numpy as np
import torch
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ---------------------------------------------------------------------------
# ffmpeg helpers for web-compatible MP4 output
# ---------------------------------------------------------------------------

_FFMPEG_AVAILABLE: bool | None = None  # cached after first check


def _has_ffmpeg() -> bool:
    """Return True if ffmpeg is on PATH."""
    global _FFMPEG_AVAILABLE
    if _FFMPEG_AVAILABLE is None:
        _FFMPEG_AVAILABLE = shutil.which("ffmpeg") is not None
    return _FFMPEG_AVAILABLE


def _ffmpeg_reencode(src: str, dst: str) -> bool:
    """Re-encode *src* to *dst* with H.264/yuv420p for browser playback.

    Returns True on success, False if ffmpeg fails or is missing.
    On success the intermediate *src* file is deleted.
    """
    if not _has_ffmpeg():
        return False
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", src,
                "-c:v", "libx264",
                "-pix_fmt", "yuv420p",
                "-preset", "veryfast",
                "-crf", "18",
                "-movflags", "+faststart",
                "-an",
                dst,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        os.remove(src)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

# ---------------------------------------------------------------------------

from sam2.build_sam import build_sam2, build_sam2_video_predictor
from sam2.sam2_image_predictor import SAM2ImagePredictor
from src.export_csv import build_row, write_row, next_pitch_number
from src.sheets_sync import get_player, get_default_sheet_id


def load_base_config(path="config.yaml"):
    with open(path) as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Timing helpers
# ---------------------------------------------------------------------------

COMPUTE_PHASES = ("frames", "glove_seg", "ball_seg", "miss_calc", "csv_write",
                  "overlay_render", "result_png")
USER_PHASES = ("user_glove_click", "user_ball_click", "user_pitch_type")


class PitchTimer:
    """Accumulates per-phase timings for a single pitch."""

    def __init__(self):
        self.phases = {}
        self._start = None
        self._phase = None
        self.total_start = time.monotonic()

    def start(self, phase):
        now = time.monotonic()
        if self._phase is not None:
            self.phases[self._phase] = self.phases.get(self._phase, 0) + (now - self._start)
        self._phase = phase
        self._start = now

    def stop(self):
        if self._phase is not None:
            now = time.monotonic()
            self.phases[self._phase] = self.phases.get(self._phase, 0) + (now - self._start)
            self._phase = None

    def total(self):
        return time.monotonic() - self.total_start

    def compute_time(self):
        return sum(self.phases.get(p, 0) for p in COMPUTE_PHASES)

    def user_time(self):
        return sum(self.phases.get(p, 0) for p in USER_PHASES)

    def summary(self):
        ct = self.compute_time()
        ut = self.user_time()
        wall = self.total()
        parts = [f"compute={ct:.1f}s  user={ut:.1f}s  wall={wall:.1f}s"]
        for phase in COMPUTE_PHASES + USER_PHASES:
            if phase in self.phases:
                parts.append(f"{phase}={self.phases[phase]:.1f}s")
        return "  Timing: " + "  ".join(parts)


class RunTimer:
    """Accumulates timings across all pitches in a run."""

    def __init__(self):
        self.pitch_times = []
        self.compute_times = []
        self.user_times = []
        self.phase_totals = {}
        self.run_start = time.monotonic()

    def record(self, pitch_timer):
        self.pitch_times.append(pitch_timer.total())
        self.compute_times.append(pitch_timer.compute_time())
        self.user_times.append(pitch_timer.user_time())
        for phase, elapsed in pitch_timer.phases.items():
            self.phase_totals[phase] = self.phase_totals.get(phase, 0) + elapsed

    def summary(self):
        if not self.pitch_times:
            return ""
        total = time.monotonic() - self.run_start
        avg = sum(self.pitch_times) / len(self.pitch_times)
        avg_compute = sum(self.compute_times) / len(self.compute_times)
        avg_user = sum(self.user_times) / len(self.user_times)
        total_compute = sum(self.compute_times)
        total_user = sum(self.user_times)
        lines = [
            f"\n{'='*60}",
            "TIMING SUMMARY",
            f"  Total wall time: {total:.1f}s",
            f"  Total compute:   {total_compute:.1f}s",
            f"  Total user wait: {total_user:.1f}s",
            f"  Pitches processed: {len(self.pitch_times)}",
            f"  Avg per pitch: wall={avg:.1f}s  compute={avg_compute:.1f}s  user={avg_user:.1f}s",
            f"  Fastest wall: {min(self.pitch_times):.1f}s",
            f"  Slowest wall: {max(self.pitch_times):.1f}s",
            "",
            "  Compute phase breakdown:",
        ]
        for phase in COMPUTE_PHASES:
            if phase in self.phase_totals:
                pct = self.phase_totals[phase] / max(total_compute, 0.001) * 100
                lines.append(f"    {phase:16s} {self.phase_totals[phase]:6.1f}s  ({pct:4.1f}%)")
        if any(p in self.phase_totals for p in USER_PHASES):
            lines.append("  User phase breakdown:")
            for phase in USER_PHASES:
                if phase in self.phase_totals:
                    lines.append(f"    {phase:16s} {self.phase_totals[phase]:6.1f}s")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# ROI helpers
# ---------------------------------------------------------------------------

def _load_detection_roi(config):
    """Load detection_roi from config. Returns (x, y, w, h) or None."""
    roi_cfg = config.get("detection_roi")
    if roi_cfg is None:
        return None
    return (roi_cfg["x"], roi_cfg["y"], roi_cfg["width"], roi_cfg["height"])


def _catcher_roi(frame_h, frame_w, detection_roi=None):
    """Return (x1, y1, x2, y2) for the catcher-only sub-region."""
    if detection_roi is not None:
        rx, ry, rw, rh = detection_roi
        return rx + int(rw * 0.6), ry, rx + rw, ry + rh
    return int(frame_w * 0.50), int(frame_h * 0.40), int(frame_w * 0.85), int(frame_h * 0.80)


def _crop_roi(frame, roi_xyxy):
    x1, y1, x2, y2 = roi_xyxy
    return frame[y1:y2, x1:x2]


def _to_full_coords(crop_x, crop_y, roi_xywh):
    """Translate coordinates from cropped ROI space back to full frame."""
    return (crop_x + roi_xywh[0], crop_y + roi_xywh[1])


# ---------------------------------------------------------------------------
# Frame extraction helpers
# ---------------------------------------------------------------------------

def _read_cropped_frame(clip_path, frame_idx, detection_roi=None):
    """Read a single frame from video, optionally crop to ROI. Returns BGR ndarray or None."""
    cap = cv2.VideoCapture(clip_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None
    if detection_roi is not None:
        rx, ry, rw, rh = detection_roi
        frame = frame[ry:ry+rh, rx:rx+rw]
    return frame


def create_mini_clip(clip_path, target_frame, arrival_frame, detection_roi=None, pad=15):
    """Extract frames from a tight window around the pitch, cropped to ROI.

    Writes cropped JPEG frames to a temp directory for SAM 2 video predictor.

    Returns:
        mini_dir: path to temp directory with JPEG frames
        start_offset: the absolute frame index of frame 0 in the mini-clip
        roi_xywh: the (x, y, w, h) crop applied (or None if no crop)
        frame_count: number of frames extracted
    """
    cap = cv2.VideoCapture(clip_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    start = max(0, target_frame - pad)
    end = min(total - 1, arrival_frame + pad)

    mini_dir = tempfile.mkdtemp(prefix="pitch_mini_")

    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    count = 0
    for abs_idx in range(start, end + 1):
        ret, frame = cap.read()
        if not ret:
            break
        if detection_roi is not None:
            rx, ry, rw, rh = detection_roi
            frame = frame[ry:ry+rh, rx:rx+rw]
        out_path = os.path.join(mini_dir, f"{count:05d}.jpg")
        cv2.imwrite(out_path, frame)
        count += 1

    cap.release()
    print(f"  Mini-clip: {count} frames (abs {start}-{end}), "
          f"cropped={'yes' if detection_roi else 'no'}")

    return mini_dir, start, detection_roi, count


def create_mini_clip_sparse(clip_path, target_frame, arrival_frame, detection_roi=None):
    """Extract only the target and arrival frames (fast mode).

    Writes exactly 2 cropped JPEG frames to a temp directory.

    Returns:
        mini_dir: path to temp directory with 2 JPEG frames (target.jpg, arrival.jpg)
        roi_xywh: the (x, y, w, h) crop applied (or None if no crop)
    """
    mini_dir = tempfile.mkdtemp(prefix="pitch_fast_")

    target_img = _read_cropped_frame(clip_path, target_frame, detection_roi)
    arrival_img = _read_cropped_frame(clip_path, arrival_frame, detection_roi)

    if target_img is not None:
        cv2.imwrite(os.path.join(mini_dir, "target.jpg"), target_img)
    if arrival_img is not None:
        cv2.imwrite(os.path.join(mini_dir, "arrival.jpg"), arrival_img)

    return mini_dir, detection_roi


# ---------------------------------------------------------------------------
# SAM 2 video predictor (for glove tracking on mini-clip — debug mode only)
# ---------------------------------------------------------------------------

_video_predictor = None


def get_video_predictor(config):
    """Load SAM 2 video predictor once and cache it."""
    global _video_predictor
    if _video_predictor is not None:
        return _video_predictor

    checkpoint = config["model"]["checkpoint"]
    model_cfg = config["model"]["config"]
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Loading SAM 2 video predictor: {checkpoint} ({device})")

    _video_predictor = build_sam2_video_predictor(model_cfg, checkpoint, device=device)
    print(f"  SAM 2 video predictor ready")
    return _video_predictor


# ---------------------------------------------------------------------------
# SAM 2 image predictor (for single-frame segmentation)
# ---------------------------------------------------------------------------

_image_predictor = None


def get_image_predictor(config):
    """Load SAM 2 image predictor once and cache it."""
    global _image_predictor
    if _image_predictor is not None:
        return _image_predictor

    checkpoint = config["model"]["checkpoint"]
    model_cfg = config["model"]["config"]
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"Loading SAM 2 image predictor ({device})")

    sam_model = build_sam2(model_cfg, checkpoint, device=device)
    _image_predictor = SAM2ImagePredictor(sam_model)
    print(f"  SAM 2 image predictor ready")
    return _image_predictor


def mask_centroid(mask):
    """Compute (x, y) centroid of a binary mask."""
    if mask is None:
        return None
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return None
    return (float(xs.mean()), float(ys.mean()))


def _sam_image_segment_once(frame_bgr, click_point, image_predictor,
                            crop_size=0, max_width=0):
    """Core SAM 2 image predictor call on a single frame.

    Returns (centroid, mask, mask_pixel_count) or (None, None, 0).
    Centroids and mask are in frame_bgr coordinate space.
    """
    h, w = frame_bgr.shape[:2]
    cx, cy = int(click_point[0]), int(click_point[1])

    # --- Optional crop around click point ---
    crop_ox, crop_oy = 0, 0
    if crop_size > 0:
        half = crop_size // 2
        x1 = max(0, cx - half)
        y1 = max(0, cy - half)
        x2 = min(w, x1 + crop_size)
        y2 = min(h, y1 + crop_size)
        if x2 - x1 < crop_size:
            x1 = max(0, x2 - crop_size)
        if y2 - y1 < crop_size:
            y1 = max(0, y2 - crop_size)
        crop_ox, crop_oy = x1, y1
        work = frame_bgr[y1:y2, x1:x2]
        click_in_work = (cx - x1, cy - y1)
    else:
        work = frame_bgr
        click_in_work = (cx, cy)

    # --- Optional downscale ---
    ww = work.shape[1]
    scale = 1.0
    if max_width > 0 and ww > max_width:
        scale = max_width / ww
        work = cv2.resize(work, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        click_in_work = (click_in_work[0] * scale, click_in_work[1] * scale)

    # --- SAM inference ---
    rgb = cv2.cvtColor(work, cv2.COLOR_BGR2RGB)
    image_predictor.set_image(rgb)
    point_coords = np.array([[click_in_work[0], click_in_work[1]]], dtype=np.float32)
    point_labels = np.array([1], dtype=np.int32)
    masks, scores, _ = image_predictor.predict(
        point_coords=point_coords, point_labels=point_labels, multimask_output=True)
    best_idx = scores.argmax()
    mask = masks[best_idx]
    mask_px = int(mask.sum())
    centroid = mask_centroid(mask)
    if centroid is None:
        return None, None, 0

    # --- Map centroid back to frame_bgr coordinates ---
    fx, fy = centroid
    if scale != 1.0:
        fx /= scale
        fy /= scale
    fx += crop_ox
    fy += crop_oy

    # Build full-resolution mask
    if crop_size > 0 or scale != 1.0:
        if scale != 1.0:
            crop_h = int(round(work.shape[0] / scale))
            crop_w = int(round(work.shape[1] / scale))
            small_mask = cv2.resize(
                mask.astype(np.uint8),
                (crop_w, crop_h),
                interpolation=cv2.INTER_NEAREST)
        else:
            small_mask = mask.astype(np.uint8)
        full_mask = np.zeros((h, w), dtype=np.uint8)
        mh, mw = small_mask.shape[:2]
        full_mask[crop_oy:crop_oy + mh, crop_ox:crop_ox + mw] = small_mask
        return (fx, fy), full_mask.astype(bool), mask_px

    return (fx, fy), mask, mask_px


# Mask area thresholds relative to the working image (crop or full frame).
_MASK_MIN_FRAC = 0.0005   # < 0.05% of image area = suspiciously small
_MASK_MAX_FRAC = 0.40     # > 40% of image area = suspiciously large


def _sam_image_segment(frame_bgr, click_point, image_predictor,
                       crop_size=0, max_width=0, label="object"):
    """Run SAM 2 image predictor with one automatic retry on bad masks.

    If the mask is empty or suspiciously small/large, retries once with
    crop_size=0 (full ROI).  Centroids are always in frame_bgr space.
    """
    h, w = frame_bgr.shape[:2]

    centroid, mask, mask_px = _sam_image_segment_once(
        frame_bgr, click_point, image_predictor,
        crop_size=crop_size, max_width=max_width)

    if centroid is not None and crop_size > 0:
        work_area = min(crop_size, w) * min(crop_size, h)
        frac = mask_px / max(work_area, 1)
        if frac < _MASK_MIN_FRAC or frac > _MASK_MAX_FRAC:
            print(f"  WARNING: {label} mask looks suspicious "
                  f"({mask_px}px, {frac*100:.2f}% of crop). Retrying with full ROI...")
            centroid, mask, mask_px = _sam_image_segment_once(
                frame_bgr, click_point, image_predictor,
                crop_size=0, max_width=max_width)

    if centroid is None:
        return None, None
    return centroid, mask


# ---------------------------------------------------------------------------
# Fast glove detection (no click, no SAM)
# ---------------------------------------------------------------------------

def auto_detect_glove(frame, detection_roi=None):
    """Detect catcher's glove by tan/brown leather color in catcher region.

    Returns (x, y, confidence) in frame coordinates, or (None, None, 0).
    """
    fh, fw = frame.shape[:2]

    # Determine catcher sub-region
    if detection_roi is not None:
        rx, ry, rw, rh = detection_roi
        # Right half of detection ROI = catcher area
        crop_x1 = rx + rw // 2
        crop_y1 = ry
        crop_x2 = rx + rw
        crop_y2 = ry + rh
    else:
        crop_x1 = int(fw * 0.55)
        crop_y1 = int(fh * 0.35)
        crop_x2 = int(fw * 0.85)
        crop_y2 = int(fh * 0.80)

    crop = frame[crop_y1:crop_y2, crop_x1:crop_x2]
    if crop.size == 0:
        return None, None, 0

    # HSV filter for tan/brown leather glove
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, np.array([8, 40, 80]), np.array([25, 180, 220]))

    # Morphological cleanup
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None, None, 0

    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    if area < 100:
        return None, None, 0

    M = cv2.moments(largest)
    if M["m00"] == 0:
        return None, None, 0

    cx = int(M["m10"] / M["m00"]) + crop_x1
    cy = int(M["m01"] / M["m00"]) + crop_y1

    confidence = int(min(100, max(10, area / 500 * 100)))
    return cx, cy, confidence


# ---------------------------------------------------------------------------
# Glove tracking via SAM 2 video propagation on mini-clip (debug mode)
# ---------------------------------------------------------------------------

def track_glove_mini(mini_dir, click_point, target_local_idx, video_predictor):
    """Run SAM 2 video propagation on the mini-clip to track the glove.

    Args:
        mini_dir: directory of cropped JPEG frames
        click_point: (x, y) in cropped coordinates where user clicked the glove
        target_local_idx: frame index within mini-clip corresponding to target frame
        video_predictor: SAM2VideoPredictor instance

    Returns:
        dict of {local_frame_idx: binary_mask} for all frames in the mini-clip
    """
    with torch.inference_mode():
        state = video_predictor.init_state(video_path=mini_dir)

        points = np.array([[click_point[0], click_point[1]]], dtype=np.float32)
        labels = np.array([1], dtype=np.int32)

        video_predictor.add_new_points_or_box(
            inference_state=state,
            frame_idx=target_local_idx,
            obj_id=1,
            points=points,
            labels=labels,
        )

        masks = {}
        for fidx, obj_ids, mask_logits in video_predictor.propagate_in_video(state):
            mask = (mask_logits[0] > 0.0).cpu().numpy().squeeze()
            masks[fidx] = mask

    print(f"  SAM 2 glove tracking: {len(masks)} frames propagated")
    return masks


# ---------------------------------------------------------------------------
# Interactive helpers
# ---------------------------------------------------------------------------

_click_pos = None


def _click_callback(event, x, y, flags, param):
    global _click_pos
    if event == cv2.EVENT_LBUTTONDOWN:
        _click_pos = (x, y)


def click_on_frame(frame, prompt, color=(0, 255, 0)):
    """Open window for user to click a point. Returns (x, y) or None."""
    global _click_pos
    _click_pos = None
    clone = frame.copy()

    win = prompt
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.setMouseCallback(win, _click_callback)
    cv2.imshow(win, clone)

    while True:
        key = cv2.waitKey(30) & 0xFF
        if _click_pos is not None:
            clone = frame.copy()
            cv2.drawMarker(clone, _click_pos, color, cv2.MARKER_CROSS, 20, 2)
            cv2.imshow(win, clone)
        if key == 13 or key == ord(' ') or key == ord('q'):
            break

    cv2.destroyWindow(win)
    return _click_pos


def click_ball_manual(frame, image_predictor, crop_size=0, max_width=0):
    """User clicks on ball -> SAM single-frame -> return centroid, mask."""
    click = click_on_frame(frame, "Click on BALL, then press Enter", (0, 0, 255))
    if click is None:
        return None, None

    centroid, mask = _sam_image_segment(frame, click, image_predictor,
                                        crop_size=crop_size, max_width=max_width,
                                        label="ball")
    if centroid:
        print(f"  SAM ball: centroid=({centroid[0]:.0f}, {centroid[1]:.0f})")
    else:
        print("  SAM ball: no mask")
    return centroid, mask


# ---------------------------------------------------------------------------
# Frame scrubber
# ---------------------------------------------------------------------------

def frame_scrubber(clip_path, initial_target=None, initial_arrival=None):
    """Interactive scrubber. T=target, A=arrival, Enter=confirm, N=skip."""
    cap = cv2.VideoCapture(clip_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total == 0:
        cap.release()
        return None, None

    win = "Scrubber - T=target, A=arrival, Enter=confirm, N=skip"
    cv2.namedWindow(win, cv2.WINDOW_NORMAL)
    cv2.createTrackbar("Frame", win, 0, total - 1, lambda x: None)

    target_frame = initial_target
    arrival_frame = initial_arrival
    current = initial_target if initial_target is not None else 0
    if initial_target is not None:
        cv2.setTrackbarPos("Frame", win, initial_target)

    while True:
        pos = cv2.getTrackbarPos("Frame", win)
        if pos != current:
            current = pos

        cap.set(cv2.CAP_PROP_POS_FRAMES, current)
        ret, img = cap.read()
        if not ret:
            break

        h, w = img.shape[:2]
        cv2.putText(img, f"Frame {current}/{total-1}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if target_frame is not None:
            cv2.putText(img, f"TARGET: {target_frame}", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            if current == target_frame:
                cv2.rectangle(img, (0, 0), (w - 1, h - 1), (0, 255, 0), 4)

        if arrival_frame is not None:
            cv2.putText(img, f"ARRIVAL: {arrival_frame}", (10, 90),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
            if current == arrival_frame:
                cv2.rectangle(img, (0, 0), (w - 1, h - 1), (0, 165, 255), 4)

        cv2.putText(img, "[T] Target  [A] Arrival  [Enter] Confirm  [N] Skip",
                    (10, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (200, 200, 200), 1)

        cv2.imshow(win, img)
        key = cv2.waitKey(30) & 0xFF

        if key == ord('t') or key == ord('T'):
            target_frame = current
            print(f"  Target frame set: {target_frame}")
        elif key == ord('a') or key == ord('A'):
            arrival_frame = current
            print(f"  Arrival frame set: {arrival_frame}")
        elif key == 13 or key == ord('q') or key == ord('Q'):
            break
        elif key == ord('n') or key == ord('N') or key == 27:
            target_frame = None
            arrival_frame = None
            break

    cv2.destroyWindow(win)
    cap.release()
    return target_frame, arrival_frame


def read_frame(clip_path, frame_idx):
    """Read a single frame from a video file."""
    cap = cv2.VideoCapture(clip_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return frame if ret else None


# ---------------------------------------------------------------------------
# Miss calculation
# ---------------------------------------------------------------------------

def calculate_miss_simple(glove_pos, ball_pos, ppi, pitcher_hand="R"):
    """Calculate miss distance from two points (full-frame coordinates)."""
    dx = ball_pos[0] - glove_pos[0]
    dy = ball_pos[1] - glove_pos[1]
    dist_px = np.hypot(dx, dy)

    arm_sign = 1 if pitcher_hand == "R" else -1
    h_direction = "arm-side" if dx * arm_sign > 0 else "glove-side"
    v_direction = "high" if dy < 0 else "low"

    result = {
        "dist_px": float(dist_px),
        "dx_px": float(dx),
        "dy_px": float(dy),
        "h_direction": h_direction,
        "v_direction": v_direction,
    }
    if ppi:
        result["dist_in"] = dist_px / ppi
        result["h_in"] = abs(dx) / ppi
        result["v_in"] = abs(dy) / ppi

    return result


# ---------------------------------------------------------------------------
# Clip playback & pitch type selection
# ---------------------------------------------------------------------------

_focus_terminal_enabled = sys.platform == "darwin"


def _focus_terminal():
    """Best-effort: bring Terminal (or iTerm) to the foreground on macOS."""
    if not _focus_terminal_enabled:
        return
    try:
        ret = subprocess.run(
            ["osascript", "-e", 'tell application "Terminal" to activate'],
            capture_output=True, timeout=2)
        if ret.returncode != 0:
            subprocess.run(
                ["osascript", "-e", 'tell application "iTerm" to activate'],
                capture_output=True, timeout=2)
    except Exception:
        pass


def play_clip(clip_path):
    """Play the clip in an OpenCV window. Enter closes window immediately.

    Uses try/finally to guarantee cleanup on macOS, where the Cocoa event
    loop must be fully drained before returning to a blocking ``input()``
    call — otherwise the process beachballs.
    """
    win = "Pitch Preview"
    cap = None
    try:
        cap = cv2.VideoCapture(clip_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        delay = max(1, int(1000 / fps))

        cv2.namedWindow(win, cv2.WINDOW_NORMAL)

        while True:
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    print("  [preview] no frames, exiting", flush=True)
                    break

            cv2.imshow(win, frame)
            key = cv2.waitKey(delay) & 0xFF
            if key == 13 or key == 10:
                print("  [preview] Enter pressed, exiting", flush=True)
                break
            try:
                if cv2.getWindowProperty(win, cv2.WND_PROP_VISIBLE) < 1:
                    print("  [preview] window closed, exiting", flush=True)
                    break
            except cv2.error:
                print("  [preview] window gone, exiting", flush=True)
                break

    finally:
        print("  [preview] cleanup start", flush=True)
        # 1. Release capture
        if cap is not None:
            cap.release()
            print("  [preview] cap.release() done", flush=True)

        # 2. Destroy window
        try:
            cv2.destroyWindow(win)
        except cv2.error:
            cv2.destroyAllWindows()

        # 3. Drain the Cocoa/HighGUI event queue.  On macOS the OpenCV GUI
        #    runs on the main thread via NSApp.  A single waitKey(1) is not
        #    enough — the run-loop must process the window-close
        #    NSNotifications, the view teardown, and the
        #    autoreleasepool drain.  Without repeated pumping the
        #    run-loop stalls and the OS shows a beachball as soon as
        #    Python blocks on input().
        for _ in range(30):
            cv2.waitKey(1)

        # 4. Small sleep to let the OS finish any remaining
        #    Cocoa teardown off-band.
        time.sleep(0.05)
        print("  [preview] cleanup done", flush=True)

    _focus_terminal()
    print("  Preview closed. Select pitch type:", flush=True)


def select_pitch_type(arsenal):
    """Select pitch type from arsenal list, or fall back to manual entry.

    Args:
        arsenal: list of dicts with 'abbreviation' and 'pitch_type' keys,
                 or empty list for manual entry.
    Returns:
        pitch type string (e.g. "FF").
    """
    if not arsenal:
        return input("  Pitch type? (FF/CB/SL/CH/other, Enter to skip): ").strip().upper()

    print("\n  Select pitch type:")
    for i, pitch in enumerate(arsenal, 1):
        abbrev = pitch.get("abbreviation", "")
        name = pitch.get("pitch_type", "")
        print(f"    {i}. {abbrev} ({name})")
    print(f"    0. Other/Skip")

    while True:
        choice = input("  Enter number: ").strip()
        if choice == "" or choice == "0":
            custom = input("  Enter pitch type: ").strip().upper()
            return custom
        try:
            idx = int(choice) - 1
            if 0 <= idx < len(arsenal):
                return arsenal[idx].get("abbreviation", arsenal[idx].get("pitch_type", ""))
        except ValueError:
            pass
        print("  Invalid choice, try again.")


# ---------------------------------------------------------------------------
# Per-pitch processing (overlay helpers — debug mode only)
# ---------------------------------------------------------------------------

def _draw_text_box(frame, lines, x, y, font_scale=0.5, thickness=1, padding=10):
    """Draw a semi-transparent text box with multiple lines."""
    font = cv2.FONT_HERSHEY_SIMPLEX
    line_heights = []
    line_widths = []
    for line in lines:
        (tw, th), baseline = cv2.getTextSize(line, font, font_scale, thickness)
        line_heights.append(th + baseline)
        line_widths.append(tw)

    box_w = max(line_widths) + padding * 2
    line_spacing = 6
    box_h = sum(line_heights) + line_spacing * (len(lines) - 1) + padding * 2

    fh, fw = frame.shape[:2]
    x = min(x, fw - box_w - 5)

    overlay = frame.copy()
    cv2.rectangle(overlay, (x, y), (x + box_w, y + box_h), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, dst=frame)
    cv2.rectangle(frame, (x, y), (x + box_w, y + box_h), (255, 255, 255), 1)

    cy = y + padding
    for i, line in enumerate(lines):
        cy += line_heights[i]
        cv2.putText(frame, line, (x + padding, cy), font, font_scale,
                    (255, 255, 255), thickness)
        cy += line_spacing


def _draw_legend(frame, x, y):
    """Draw a color legend in the bottom-left corner."""
    items = [
        ((0, 255, 0), "Glove mask"),
        ((0, 0, 255), "Ball"),
        ((255, 255, 0), "Total dist"),
        ((255, 200, 0), "H miss"),
        ((0, 200, 255), "V miss"),
        ((0, 165, 255), "Arrival frame"),
        ((255, 0, 255), "Glove target"),
    ]
    for i, (color, label) in enumerate(items):
        ly = y + i * 20
        cv2.rectangle(frame, (x, ly), (x + 12, ly + 12), color, -1)
        cv2.putText(frame, label, (x + 18, ly + 11),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)


def render_overlay_video(mini_dir, frame_count, glove_masks, glove_pos,
                         ball_pos, miss, target_local, arrival_local,
                         ppi, pitcher_hand, player_id, pitch_type,
                         pitch_number, zone_height, plate_center_x,
                         output_path, fps=30):
    """Render an overlay MP4 from mini-clip frames with SAM glove tracking.

    Matches the original visualize.py overlay style:
        - Green semi-transparent glove mask + centroid dot every frame
        - Green target circle (from target frame onward)
        - Red result circle (from arrival frame onward)
        - Magenta crosshair at glove target
        - Strike zone with 9-box grid
        - H/V component lines with labels on arrival frame
        - Miss distance text box (top-right)
        - Color legend (bottom-left)
        - Header: pitcher name, pitch type, pitch number
    """
    from src.visualize import get_zone_bounds, draw_strike_zone

    sample_path = os.path.join(mini_dir, f"{0:05d}.jpg")
    sample = cv2.imread(sample_path)
    if sample is None:
        return
    h, w = sample.shape[:2]

    # Write to temp file first; re-encode to web-compatible H.264 at the end
    tmp_path = output_path + ".tmp.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (w, h))

    # Glove target position (from target frame mask centroid, in cropped coords)
    glove_target_crop = mask_centroid(glove_masks.get(target_local))

    arm_sign = 1 if pitcher_hand == "R" else -1

    # Build header
    header_parts = []
    if player_id:
        header_parts.append(player_id)
    if pitch_type:
        header_parts.append(pitch_type)
    header_parts.append(f"{'RHP' if pitcher_hand == 'R' else 'LHP'}")
    header_text = " | ".join(header_parts)

    # Pre-compute miss summary lines for text box (shown from arrival onward)
    summary_lines = None
    if miss:
        dx = miss.get("dx_px", 0)
        dy = miss.get("dy_px", 0)
        h_label = miss.get("h_direction", "")
        v_label = miss.get("v_direction", "")
        summary_lines = [f"PITCH #{pitch_number}"]
        if ppi and miss.get("dist_in") is not None:
            summary_lines.append(f'Total: {miss["dist_in"]:.1f}"')
            summary_lines.append(f'H: {miss["h_in"]:.1f}" {h_label}')
            summary_lines.append(f'V: {miss["v_in"]:.1f}" {v_label}')
        else:
            summary_lines.append(f'Total: {miss["dist_px"]:.0f}px')
            summary_lines.append(f'H: {abs(dx):.0f}px {h_label}')
            summary_lines.append(f'V: {abs(dy):.0f}px {v_label}')
        miss_dir_h = "Arm" if dx * arm_sign > 0 else "Glove"
        miss_dir_v = "High" if dy < 0 else "Low"
        summary_lines.append(f"Result: {miss_dir_v}-{miss_dir_h}")

    # Target circle radius (if ppi available)
    target_circle_r = int(3.5 * ppi) if ppi else None

    for i in range(frame_count):
        frame_path = os.path.join(mini_dir, f"{i:05d}.jpg")
        frame = cv2.imread(frame_path)
        if frame is None:
            break

        # --- Target frame border ---
        if i == target_local:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (255, 0, 255), 4)

        # --- Arrival frame border ---
        if i == arrival_local:
            cv2.rectangle(frame, (0, 0), (w - 1, h - 1), (0, 165, 255), 4)

        # --- Strike zone ---
        if glove_target_crop is not None and ppi:
            draw_strike_zone(frame, glove_target_crop, ppi, zone_height,
                             zone_center_x=None)

        # --- Green target circle (from target frame onward) ---
        if glove_target_crop is not None and target_circle_r and i >= target_local:
            gx, gy = int(glove_target_crop[0]), int(glove_target_crop[1])
            overlay = frame.copy()
            cv2.circle(overlay, (gx, gy), target_circle_r, (0, 200, 0), -1)
            cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
            cv2.circle(frame, (gx, gy), target_circle_r, (0, 200, 0), 2)
            cv2.putText(frame, "TARGET",
                        (gx - 30, gy + target_circle_r + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1)

        # --- Red result circle (from arrival frame onward) ---
        if ball_pos is not None and target_circle_r and i >= arrival_local:
            bx, by = int(ball_pos[0]), int(ball_pos[1])
            overlay = frame.copy()
            cv2.circle(overlay, (bx, by), target_circle_r, (0, 0, 220), -1)
            cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
            cv2.circle(frame, (bx, by), target_circle_r, (0, 0, 220), 2)
            cv2.putText(frame, "RESULT",
                        (bx - 30, by - target_circle_r - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 220), 1)

        # --- Glove mask overlay (green) ---
        if i in glove_masks:
            mask = glove_masks[i]
            overlay = frame.copy()
            overlay[mask] = (0, 255, 0)
            frame = cv2.addWeighted(frame, 0.7, overlay, 0.3, 0)

            # Glove centroid dot
            centroid = mask_centroid(mask)
            if centroid is not None:
                cx, cy = int(centroid[0]), int(centroid[1])
                cv2.circle(frame, (cx, cy), 5, (0, 200, 0), -1)

        # --- Glove target crosshair (persistent from target frame onward) ---
        if glove_target_crop is not None and i >= target_local:
            gx, gy = int(glove_target_crop[0]), int(glove_target_crop[1])
            cv2.drawMarker(frame, (gx, gy), (255, 0, 255), cv2.MARKER_CROSS, 20, 2)

        # --- Ball circle ---
        if ball_pos is not None and i in (arrival_local,):
            bx, by = int(ball_pos[0]), int(ball_pos[1])
            cv2.circle(frame, (bx, by), 10, (0, 0, 255), 2)

        # --- H/V miss component lines on arrival frame ---
        if i == arrival_local and ball_pos is not None and glove_target_crop is not None:
            gx, gy = int(glove_target_crop[0]), int(glove_target_crop[1])
            bx, by = int(ball_pos[0]), int(ball_pos[1])

            # Right-angle decomposition
            corner = (bx, gy)
            cv2.line(frame, (gx, gy), corner, (255, 200, 0), 2)  # horizontal
            cv2.line(frame, corner, (bx, by), (0, 200, 255), 2)  # vertical
            cv2.line(frame, (gx, gy), (bx, by), (255, 255, 0), 1)  # diagonal

            # H label
            if ppi and miss.get("h_in") is not None:
                h_text = f'H:{miss["h_in"]:.1f}"'
            else:
                h_text = f'H:{abs(miss.get("dx_px", 0)):.0f}px'
            cv2.putText(frame, h_text, ((gx + bx) // 2 - 20, gy - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

            # V label
            if ppi and miss.get("v_in") is not None:
                v_text = f'V:{miss["v_in"]:.1f}"'
            else:
                v_text = f'V:{abs(miss.get("dy_px", 0)):.0f}px'
            cv2.putText(frame, v_text, (bx + 10, (gy + by) // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 1)

            # Total label
            if ppi and miss.get("dist_in") is not None:
                t_text = f'{miss["dist_in"]:.1f}"'
            else:
                t_text = f'{miss["dist_px"]:.0f}px'
            cv2.putText(frame, t_text, (bx + 10, by - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # --- Miss distance text box (top-right, from arrival onward) ---
        if i >= arrival_local and summary_lines:
            _draw_text_box(frame, summary_lines, w - 260, 50)

        # --- Header text ---
        cv2.putText(frame, header_text, (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # --- Frame number + timestamp ---
        timestamp = i / fps
        cv2.putText(frame, f"Frame {i} | {timestamp:.3f}s",
                    (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        # --- Legend (bottom-left) ---
        _draw_legend(frame, 10, h - 155)

        writer.write(frame)

    writer.release()

    # Re-encode to web-compatible H.264; fall back to OpenCV output if ffmpeg missing
    if not _ffmpeg_reencode(tmp_path, output_path):
        os.rename(tmp_path, output_path)


def render_overlay_lite(clip_path, target_frame, arrival_frame,
                        glove_pos_crop, ball_pos_crop, miss, ppi,
                        pitcher_hand, player_id, pitch_type, pitch_number,
                        zone_height, detection_roi, output_path, fps=30, pad=5):
    """Render overlay MP4 without SAM2 video propagation.

    Reads frames directly from the source clip (T-pad to A+pad), crops to ROI,
    and draws static target marker + ball/miss annotations on arrival frame.
    No glove mask tracking — just centroid markers and miss geometry.
    """
    from src.visualize import draw_strike_zone

    cap = cv2.VideoCapture(clip_path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    clip_fps = cap.get(cv2.CAP_PROP_FPS) or fps

    start = max(0, target_frame - pad)
    end = min(total - 1, arrival_frame + pad)

    # Read first frame to get dimensions (after ROI crop)
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    ret, sample = cap.read()
    if not ret:
        cap.release()
        return
    if detection_roi is not None:
        rx, ry, rw, rh = detection_roi
        sample = sample[ry:ry+rh, rx:rx+rw]
    h, w = sample.shape[:2]

    # Write to temp file first; re-encode to web-compatible H.264 at the end
    tmp_path = output_path + ".tmp.mp4"
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(tmp_path, fourcc, clip_fps, (w, h))

    arm_sign = 1 if pitcher_hand == "R" else -1
    target_circle_r = int(3.5 * ppi) if ppi else None

    # Header
    header_parts = []
    if player_id:
        header_parts.append(player_id)
    if pitch_type:
        header_parts.append(pitch_type)
    header_parts.append(f"{'RHP' if pitcher_hand == 'R' else 'LHP'}")
    header_text = " | ".join(header_parts)

    # Miss summary lines
    summary_lines = None
    if miss:
        dx = miss.get("dx_px", 0)
        dy = miss.get("dy_px", 0)
        h_label = miss.get("h_direction", "")
        v_label = miss.get("v_direction", "")
        summary_lines = [f"PITCH #{pitch_number}"]
        if ppi and miss.get("dist_in") is not None:
            summary_lines.append(f'Total: {miss["dist_in"]:.1f}"')
            summary_lines.append(f'H: {miss["h_in"]:.1f}" {h_label}')
            summary_lines.append(f'V: {miss["v_in"]:.1f}" {v_label}')
        else:
            summary_lines.append(f'Total: {miss["dist_px"]:.0f}px')
            summary_lines.append(f'H: {abs(dx):.0f}px {h_label}')
            summary_lines.append(f'V: {abs(dy):.0f}px {v_label}')
        miss_dir_h = "Arm" if dx * arm_sign > 0 else "Glove"
        miss_dir_v = "High" if dy < 0 else "Low"
        summary_lines.append(f"Result: {miss_dir_v}-{miss_dir_h}")

    gx, gy = int(glove_pos_crop[0]), int(glove_pos_crop[1])
    bx, by = int(ball_pos_crop[0]), int(ball_pos_crop[1])

    target_local = target_frame - start
    arrival_local = arrival_frame - start

    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    for i in range(end - start + 1):
        ret, frame = cap.read()
        if not ret:
            break
        if detection_roi is not None:
            frame = frame[ry:ry+rh, rx:rx+rw]

        fh, fw = frame.shape[:2]

        # Frame borders
        if i == target_local:
            cv2.rectangle(frame, (0, 0), (fw - 1, fh - 1), (255, 0, 255), 4)
        if i == arrival_local:
            cv2.rectangle(frame, (0, 0), (fw - 1, fh - 1), (0, 165, 255), 4)

        # Strike zone
        if ppi:
            draw_strike_zone(frame, (gx, gy), ppi, zone_height, zone_center_x=None)

        # Target marker (from target frame onward)
        if i >= target_local:
            if target_circle_r:
                overlay = frame.copy()
                cv2.circle(overlay, (gx, gy), target_circle_r, (0, 200, 0), -1)
                cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
                cv2.circle(frame, (gx, gy), target_circle_r, (0, 200, 0), 2)
            cv2.drawMarker(frame, (gx, gy), (255, 0, 255), cv2.MARKER_CROSS, 20, 2)
            cv2.putText(frame, "TARGET",
                        (gx - 30, gy + (target_circle_r or 10) + 18),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 200, 0), 1)

        # Ball + miss geometry (arrival frame onward)
        if i >= arrival_local:
            if target_circle_r:
                overlay = frame.copy()
                cv2.circle(overlay, (bx, by), target_circle_r, (0, 0, 220), -1)
                cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, dst=frame)
                cv2.circle(frame, (bx, by), target_circle_r, (0, 0, 220), 2)
            cv2.circle(frame, (bx, by), 10, (0, 0, 255), 2)
            cv2.putText(frame, "RESULT",
                        (bx - 30, by - (target_circle_r or 10) - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 220), 1)

        # H/V decomposition lines on arrival frame
        if i == arrival_local:
            corner = (bx, gy)
            cv2.line(frame, (gx, gy), corner, (255, 200, 0), 2)
            cv2.line(frame, corner, (bx, by), (0, 200, 255), 2)
            cv2.line(frame, (gx, gy), (bx, by), (255, 255, 0), 1)

            if ppi and miss.get("h_in") is not None:
                h_text = f'H:{miss["h_in"]:.1f}"'
            else:
                h_text = f'H:{abs(miss.get("dx_px", 0)):.0f}px'
            cv2.putText(frame, h_text, ((gx + bx) // 2 - 20, gy - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 200, 0), 1)

            if ppi and miss.get("v_in") is not None:
                v_text = f'V:{miss["v_in"]:.1f}"'
            else:
                v_text = f'V:{abs(miss.get("dy_px", 0)):.0f}px'
            cv2.putText(frame, v_text, (bx + 10, (gy + by) // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 255), 1)

            if ppi and miss.get("dist_in") is not None:
                t_text = f'{miss["dist_in"]:.1f}"'
            else:
                t_text = f'{miss["dist_px"]:.0f}px'
            cv2.putText(frame, t_text, (bx + 10, by - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)

        # Miss text box (from arrival onward)
        if i >= arrival_local and summary_lines:
            _draw_text_box(frame, summary_lines, fw - 260, 50)

        # Header
        cv2.putText(frame, header_text, (10, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1)

        # Frame number
        timestamp = i / clip_fps
        cv2.putText(frame, f"Frame {i} | {timestamp:.3f}s",
                    (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        _draw_legend(frame, 10, fh - 155)

        writer.write(frame)

    writer.release()
    cap.release()

    # Re-encode to web-compatible H.264; fall back to OpenCV output if ffmpeg missing
    if not _ffmpeg_reencode(tmp_path, output_path):
        os.rename(tmp_path, output_path)


# ---------------------------------------------------------------------------
# Per-pitch processing: FAST mode (image predictor only, no overlay)
# ---------------------------------------------------------------------------

def process_single_pitch_fast(clip_path, base_config, pitch_number,
                              player_id, pitcher_hand, csv_path, zone_height,
                              output_dir, image_predictor,
                              known_target=None, known_arrival=None,
                              arsenal=None, batch_mode=False,
                              known_pitch_type=None,
                              sam_crop_size=0, sam_max_width=0,
                              sam_glove_crop=0, sam_ball_crop=0,
                              overlay_lite=False, result_png=True):
    """Process a single pitch using image predictor only (fast mode).

    Skips SAM 2 video propagation and overlay video rendering.
    Segments glove on target frame and ball on arrival frame using image predictor.
    """
    clip_name = os.path.basename(clip_path)
    timer = PitchTimer()

    print(f"\n{'='*60}")
    print(f"[FAST] Processing {clip_name} (pitch #{pitch_number})")
    print(f"{'='*60}")

    ppi = base_config["calibration"].get("pixels_per_inch")
    plate_center_x = base_config["calibration"].get("plate_center_x")
    fps = base_config["video"].get("fps", 30)
    detection_roi = _load_detection_roi(base_config)

    if known_target is not None and known_arrival is not None:
        target_frame = known_target
        arrival_frame = known_arrival
        print(f"  Using pre-marked frames: T={target_frame}, A={arrival_frame}")
    else:
        if batch_mode:
            print("  Batch mode requires pre-marked frames. Skipping.")
            return None, timer
        print("  Opening scrubber...")
        target_frame, arrival_frame = frame_scrubber(clip_path)
        if target_frame is None or arrival_frame is None:
            print("  Skipped.")
            return None, timer

    print(f"  Target: frame {target_frame} | Arrival: frame {arrival_frame}")

    # --- Extract only 2 frames ---
    timer.start("frames")
    mini_dir, roi_used = create_mini_clip_sparse(
        clip_path, target_frame, arrival_frame, detection_roi)

    target_crop_img = cv2.imread(os.path.join(mini_dir, "target.jpg"))
    arrival_crop_img = cv2.imread(os.path.join(mini_dir, "arrival.jpg"))

    if target_crop_img is None or arrival_crop_img is None:
        print("  Cannot read target or arrival frame.")
        shutil.rmtree(mini_dir)
        return None, timer
    timer.stop()

    # --- Glove: click or auto-detect, then SAM image segment ---
    if batch_mode:
        timer.start("glove_seg")
        gx, gy, glove_conf = auto_detect_glove(target_crop_img)
        if gx is None:
            print("  Auto glove detection failed. Skipping.")
            shutil.rmtree(mini_dir)
            return None, timer
        glove_click = (gx, gy)
        print(f"  Glove auto-detected: ({gx}, {gy}), confidence={glove_conf}%")
    else:
        timer.start("user_glove_click")
        print("  Click on the GLOVE in the target frame, then press Enter...")
        glove_click = click_on_frame(target_crop_img, "Click GLOVE on target frame, Enter to confirm", (0, 255, 0))
        glove_conf = 100
        if glove_click is None:
            print("  No glove selected, skipping.")
            shutil.rmtree(mini_dir)
            return None, timer

    # SAM image segmentation on target frame for glove
    timer.start("glove_seg")
    glove_crop = sam_glove_crop if sam_glove_crop > 0 else sam_crop_size
    glove_centroid_crop, glove_mask = _sam_image_segment(
        target_crop_img, glove_click, image_predictor,
        crop_size=glove_crop, max_width=sam_max_width, label="glove")
    if glove_centroid_crop is None:
        print("  SAM glove segmentation failed.")
        shutil.rmtree(mini_dir)
        return None, timer
    print(f"  SAM glove: centroid=({glove_centroid_crop[0]:.0f}, {glove_centroid_crop[1]:.0f})")

    # Convert to full-frame coordinates
    if roi_used is not None:
        glove_pos = _to_full_coords(glove_centroid_crop[0], glove_centroid_crop[1], roi_used)
    else:
        glove_pos = glove_centroid_crop
    timer.stop()

    # --- Ball: click then SAM image segment ---
    timer.start("user_ball_click")
    ball_crop = sam_ball_crop if sam_ball_crop > 0 else sam_crop_size
    print("  Click on the BALL in the arrival frame, then press Enter...")
    ball_click = click_on_frame(arrival_crop_img, "Click on BALL, then press Enter", (0, 0, 255))
    if ball_click is None:
        print("  No ball selected, skipping.")
        shutil.rmtree(mini_dir)
        return None, timer

    timer.start("ball_seg")
    ball_pos_crop, ball_mask = _sam_image_segment(
        arrival_crop_img, ball_click, image_predictor,
        crop_size=ball_crop, max_width=sam_max_width, label="ball")
    if ball_pos_crop is None:
        print("  SAM ball segmentation failed.")
        shutil.rmtree(mini_dir)
        return None, timer
    print(f"  SAM ball: centroid=({ball_pos_crop[0]:.0f}, {ball_pos_crop[1]:.0f})")

    if roi_used is not None:
        ball_pos = _to_full_coords(ball_pos_crop[0], ball_pos_crop[1], roi_used)
    else:
        ball_pos = ball_pos_crop
    timer.stop()

    # --- Pitch type ---
    if known_pitch_type:
        pitch_type = known_pitch_type
    elif batch_mode:
        pitch_type = ""
    else:
        timer.start("user_pitch_type")
        print("  Playing clip for pitch type identification...")
        play_clip(clip_path)
        pitch_type = select_pitch_type(arsenal or [])
        timer.stop()

    # --- Miss calculation ---
    timer.start("miss_calc")
    miss = calculate_miss_simple(glove_pos, ball_pos, ppi, pitcher_hand)
    timer.stop()

    if ppi:
        print(f"  Miss: {miss['dist_in']:.1f}\" "
              f"({miss['h_in']:.1f}\" {miss['h_direction']}, "
              f"{miss['v_in']:.1f}\" {miss['v_direction']})")
    else:
        print(f"  Miss: {miss['dist_px']:.1f}px")

    # --- CSV ---
    timer.start("csv_write")
    csv_num = next_pitch_number(csv_path) if os.path.exists(csv_path) else pitch_number
    ball_dict = {"x": ball_pos[0], "y": ball_pos[1], "radius": 0}
    row = build_row(
        pitcher_name=player_id,
        pitcher_hand=pitcher_hand,
        pitch_type=pitch_type,
        target_frame=target_frame,
        arrival_frame=arrival_frame,
        glove_target=glove_pos,
        ball_pos=ball_dict,
        ppi=ppi,
        zone_height=zone_height,
        fps=fps,
        pitch_number=csv_num,
        plate_center_x=plate_center_x,
    )
    write_row(csv_path, row, append=True)
    print(f"  Saved to CSV (pitch #{csv_num})")
    timer.stop()

    # --- Overlay-lite video ---
    stem = os.path.splitext(clip_name)[0]
    if overlay_lite:
        timer.start("overlay_render")
        os.makedirs(output_dir, exist_ok=True)
        overlay_path = os.path.join(output_dir, f"{stem}_overlay.mp4")
        print("  Rendering overlay-lite video...")
        render_overlay_lite(
            clip_path=clip_path,
            target_frame=target_frame,
            arrival_frame=arrival_frame,
            glove_pos_crop=glove_centroid_crop,
            ball_pos_crop=ball_pos_crop,
            miss=miss,
            ppi=ppi,
            pitcher_hand=pitcher_hand,
            player_id=player_id,
            pitch_type=pitch_type,
            pitch_number=csv_num,
            zone_height=zone_height,
            detection_roi=detection_roi,
            output_path=overlay_path,
            fps=fps,
        )
        print(f"  Saved {overlay_path}")
        timer.stop()

    # --- Result PNG ---
    if overlay_lite and result_png:
        timer.start("result_png")
        os.makedirs(output_dir, exist_ok=True)
        arrival_full = read_frame(clip_path, arrival_frame)
        if arrival_full is not None:
            arr_img = arrival_full.copy()
            gx_f, gy_f = int(glove_pos[0]), int(glove_pos[1])
            bx_f, by_f = int(ball_pos[0]), int(ball_pos[1])

            cv2.drawMarker(arr_img, (gx_f, gy_f), (0, 200, 0), cv2.MARKER_CROSS, 20, 2)
            cv2.circle(arr_img, (bx_f, by_f), 10, (0, 0, 255), 2)
            cv2.line(arr_img, (gx_f, gy_f), (bx_f, by_f), (255, 255, 0), 2)
            corner = (bx_f, gy_f)
            cv2.line(arr_img, (gx_f, gy_f), corner, (255, 200, 0), 1)
            cv2.line(arr_img, corner, (bx_f, by_f), (0, 200, 255), 1)
            if ppi:
                label = (f'{miss["dist_in"]:.1f}" '
                         f'({miss["h_in"]:.1f}" {miss["h_direction"]}, '
                         f'{miss["v_in"]:.1f}" {miss["v_direction"]})')
            else:
                label = f'{miss["dist_px"]:.1f}px'
            cv2.putText(arr_img, label, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
            cv2.putText(arr_img, "TARGET", (gx_f - 30, gy_f + 35),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)
            cv2.putText(arr_img, "BALL", (bx_f - 20, by_f - 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

            png_path = os.path.join(output_dir, f"{stem}_result.png")
            cv2.imwrite(png_path, arr_img)
            print(f"  Saved {png_path}")
        timer.stop()

    # Clean up
    shutil.rmtree(mini_dir)

    ball_conf = 100
    confidence = min(glove_conf, ball_conf)

    print(timer.summary())

    return {
        "clip": clip_name,
        "pitch_number": csv_num,
        "pitch_type": pitch_type,
        "target_frame": target_frame,
        "arrival_frame": arrival_frame,
        "total_miss_inches": miss.get("dist_in"),
        "h_miss": miss["h_direction"],
        "v_miss": miss["v_direction"],
        "confidence": confidence,
    }, timer


# ---------------------------------------------------------------------------
# Per-pitch processing: DEBUG mode (full SAM video propagation + overlay)
# ---------------------------------------------------------------------------

def process_single_pitch_debug(clip_path, base_config, pitch_number,
                               player_id, pitcher_hand, csv_path, zone_height,
                               output_dir, video_predictor, image_predictor,
                               known_target=None, known_arrival=None,
                               arsenal=None, batch_mode=False,
                               known_pitch_type=None):
    """Process a single pitch with full SAM 2 video propagation + overlay (debug mode)."""
    clip_name = os.path.basename(clip_path)
    timer = PitchTimer()

    print(f"\n{'='*60}")
    print(f"[DEBUG] Processing {clip_name} (pitch #{pitch_number})")
    print(f"{'='*60}")

    ppi = base_config["calibration"].get("pixels_per_inch")
    plate_center_x = base_config["calibration"].get("plate_center_x")
    fps = base_config["video"].get("fps", 30)
    detection_roi = _load_detection_roi(base_config)

    if known_target is not None and known_arrival is not None:
        target_frame = known_target
        arrival_frame = known_arrival
        print(f"  Using pre-marked frames: T={target_frame}, A={arrival_frame}")
    else:
        if batch_mode:
            print("  Batch mode requires pre-marked frames. Skipping.")
            return None, timer
        print("  Opening scrubber...")
        target_frame, arrival_frame = frame_scrubber(clip_path)
        if target_frame is None or arrival_frame is None:
            print("  Skipped.")
            return None, timer

    print(f"  Target: frame {target_frame} | Arrival: frame {arrival_frame}")

    # --- Create full mini-clip ---
    timer.start("frames")
    pad = 5 if (known_target is not None) else 15
    mini_dir, start_offset, roi_used, frame_count = create_mini_clip(
        clip_path, target_frame, arrival_frame, detection_roi, pad=pad)

    target_local = target_frame - start_offset
    arrival_local = arrival_frame - start_offset
    timer.stop()

    # --- Glove click -> SAM 2 video propagation ---
    timer.start("glove_seg")
    target_crop_path = os.path.join(mini_dir, f"{target_local:05d}.jpg")
    target_crop_img = cv2.imread(target_crop_path)

    if target_crop_img is None:
        print("  Cannot read target frame from mini-clip.")
        shutil.rmtree(mini_dir)
        return None, timer

    if batch_mode:
        gx, gy, glove_conf = auto_detect_glove(target_crop_img)
        if gx is None:
            print("  Auto glove detection failed. Skipping.")
            shutil.rmtree(mini_dir)
            return None, timer
        glove_click = (gx, gy)
        print(f"  Glove auto-detected: ({gx}, {gy}), confidence={glove_conf}%")
    else:
        print("  Click on the GLOVE in the target frame, then press Enter...")
        glove_click = click_on_frame(target_crop_img, "Click GLOVE on target frame, Enter to confirm", (0, 255, 0))
        glove_conf = 100
        if glove_click is None:
            print("  No glove selected, skipping.")
            shutil.rmtree(mini_dir)
            return None, timer

    print(f"  Glove click (cropped coords): ({glove_click[0]}, {glove_click[1]})")
    print("  Running SAM 2 video propagation on mini-clip...")
    glove_masks = track_glove_mini(mini_dir, glove_click, target_local, video_predictor)

    if target_local not in glove_masks:
        print("  SAM 2 did not produce a mask for the target frame.")
        shutil.rmtree(mini_dir)
        return None, timer

    glove_centroid_crop = mask_centroid(glove_masks[target_local])
    if glove_centroid_crop is None:
        print("  Empty glove mask at target frame.")
        shutil.rmtree(mini_dir)
        return None, timer

    if roi_used is not None:
        glove_pos = _to_full_coords(glove_centroid_crop[0], glove_centroid_crop[1], roi_used)
    else:
        glove_pos = glove_centroid_crop

    print(f"  Glove position (full frame): ({glove_pos[0]:.0f}, {glove_pos[1]:.0f})")
    timer.stop()

    # --- Ball click -> SAM image segment ---
    timer.start("ball_seg")
    arrival_crop_path = os.path.join(mini_dir, f"{arrival_local:05d}.jpg")
    arrival_crop_img = cv2.imread(arrival_crop_path)

    if arrival_crop_img is None:
        print("  Cannot read arrival frame from mini-clip.")
        shutil.rmtree(mini_dir)
        return None, timer

    ball_pos_crop, ball_mask = click_ball_manual(arrival_crop_img, image_predictor)
    if ball_pos_crop is None:
        print("  No ball position, skipping.")
        shutil.rmtree(mini_dir)
        return None, timer

    if roi_used is not None:
        ball_pos = _to_full_coords(ball_pos_crop[0], ball_pos_crop[1], roi_used)
    else:
        ball_pos = ball_pos_crop

    print(f"  Ball position (full frame): ({ball_pos[0]:.0f}, {ball_pos[1]:.0f})")
    timer.stop()

    # --- Pitch type ---
    if known_pitch_type:
        pitch_type = known_pitch_type
    elif batch_mode:
        pitch_type = ""
    else:
        print("  Playing clip for pitch type identification...")
        play_clip(clip_path)
        pitch_type = select_pitch_type(arsenal or [])

    # --- Miss calculation ---
    timer.start("miss_calc")
    miss = calculate_miss_simple(glove_pos, ball_pos, ppi, pitcher_hand)
    timer.stop()

    if ppi:
        print(f"  Miss: {miss['dist_in']:.1f}\" "
              f"({miss['h_in']:.1f}\" {miss['h_direction']}, "
              f"{miss['v_in']:.1f}\" {miss['v_direction']})")
    else:
        print(f"  Miss: {miss['dist_px']:.1f}px")

    # --- CSV ---
    timer.start("csv_write")
    csv_num = next_pitch_number(csv_path) if os.path.exists(csv_path) else pitch_number
    ball_dict = {"x": ball_pos[0], "y": ball_pos[1], "radius": 0}
    row = build_row(
        pitcher_name=player_id,
        pitcher_hand=pitcher_hand,
        pitch_type=pitch_type,
        target_frame=target_frame,
        arrival_frame=arrival_frame,
        glove_target=glove_pos,
        ball_pos=ball_dict,
        ppi=ppi,
        zone_height=zone_height,
        fps=fps,
        pitch_number=csv_num,
        plate_center_x=plate_center_x,
    )
    write_row(csv_path, row, append=True)
    print(f"  Saved to CSV (pitch #{csv_num})")
    timer.stop()

    # --- Overlay video ---
    timer.start("overlay")
    os.makedirs(output_dir, exist_ok=True)
    stem = os.path.splitext(os.path.basename(clip_path))[0]
    overlay_path = os.path.join(output_dir, f"{stem}_overlay.mp4")
    print("  Rendering overlay video...")
    render_overlay_video(
        mini_dir=mini_dir,
        frame_count=frame_count,
        glove_masks=glove_masks,
        glove_pos=glove_pos,
        ball_pos=ball_pos_crop,
        miss=miss,
        target_local=target_local,
        arrival_local=arrival_local,
        ppi=ppi,
        pitcher_hand=pitcher_hand,
        player_id=player_id,
        pitch_type=pitch_type,
        pitch_number=csv_num,
        zone_height=zone_height,
        plate_center_x=plate_center_x,
        output_path=overlay_path,
        fps=fps,
    )
    print(f"  Saved {overlay_path}")
    timer.stop()

    # --- Result PNG ---
    timer.start("result_png")
    arrival_full = read_frame(clip_path, arrival_frame)
    if arrival_full is not None:
        arr_img = arrival_full.copy()
        gx, gy = int(glove_pos[0]), int(glove_pos[1])
        bx, by = int(ball_pos[0]), int(ball_pos[1])

        cv2.drawMarker(arr_img, (gx, gy), (0, 200, 0), cv2.MARKER_CROSS, 20, 2)
        cv2.circle(arr_img, (bx, by), 10, (0, 0, 255), 2)
        cv2.line(arr_img, (gx, gy), (bx, by), (255, 255, 0), 2)
        corner = (bx, gy)
        cv2.line(arr_img, (gx, gy), corner, (255, 200, 0), 1)
        cv2.line(arr_img, corner, (bx, by), (0, 200, 255), 1)
        if ppi:
            label = (f'{miss["dist_in"]:.1f}" '
                     f'({miss["h_in"]:.1f}" {miss["h_direction"]}, '
                     f'{miss["v_in"]:.1f}" {miss["v_direction"]})')
        else:
            label = f'{miss["dist_px"]:.1f}px'
        cv2.putText(arr_img, label, (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        cv2.putText(arr_img, "TARGET", (gx - 30, gy + 35),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 200, 0), 1)
        cv2.putText(arr_img, "BALL", (bx - 20, by - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

        png_path = os.path.join(output_dir, f"{stem}_result.png")
        cv2.imwrite(png_path, arr_img)
        print(f"  Saved {png_path}")
    timer.stop()

    # Clean up mini-clip temp directory
    shutil.rmtree(mini_dir)

    ball_conf = 100
    confidence = min(glove_conf, ball_conf)

    print(timer.summary())

    return {
        "clip": clip_name,
        "pitch_number": csv_num,
        "pitch_type": pitch_type,
        "target_frame": target_frame,
        "arrival_frame": arrival_frame,
        "total_miss_inches": miss.get("dist_in"),
        "h_miss": miss["h_direction"],
        "v_miss": miss["v_direction"],
        "confidence": confidence,
    }, timer


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Batch pitch processor with SAM 2 on mini-clips")
    parser.add_argument("--clips-dir", required=True,
                        help="Directory containing pitch_NNN.mp4 clips")
    parser.add_argument("--player-id", required=True,
                        help="Pitcher identifier (e.g. SLangan1)")
    parser.add_argument("--pitcher-hand", choices=["R", "L"], default="R")
    parser.add_argument("--output-csv", required=True,
                        help="CSV output path")
    parser.add_argument("--zone-height", type=float, default=23)
    parser.add_argument("--start-at", type=int, default=1,
                        help="Start at pitch N (for resuming, default: 1)")
    parser.add_argument("--batch", action="store_true",
                        help="Fully automatic batch mode (no user input, review low-confidence after)")
    parser.add_argument("--sheet-id", type=str, default=None,
                        help="Google Sheet ID for player data (or use default from config)")
    parser.add_argument("--arsenals-csv", type=str, default="data/Arsenals.csv",
                        help="Path to Arsenals.csv for pitch type menu (default: data/Arsenals.csv)")
    parser.add_argument("--show-roi", action="store_true",
                        help="Preview the configured detection ROI and exit")
    # Speed / debug mode flags
    parser.add_argument("--debug", action="store_true",
                        help="Enable debug mode: full SAM 2 video propagation + overlay video + result PNG")
    parser.add_argument("--no-overlay", action="store_true",
                        help="Alias for fast mode (default). Skips overlay video rendering.")
    parser.add_argument("--sam-max-width", type=int, default=0,
                        help="Downscale frames to this width before SAM 2 inference (0=off, recommended: 800)")
    parser.add_argument("--sam-crop-size", type=int, default=0,
                        help="Crop square around click point before SAM 2 (0=off, recommended: 384)")
    parser.add_argument("--overlay-lite", action="store_true",
                        help="Render overlay MP4 using markers only (no SAM2 video propagation)")
    parser.add_argument("--no-result-png", action="store_true",
                        help="Skip result PNG generation (only applies with --overlay-lite)")
    parser.add_argument("--glove-crop-size", type=int, default=0,
                        help="Override SAM crop size for glove segmentation (0=use --sam-crop-size)")
    parser.add_argument("--ball-crop-size", type=int, default=0,
                        help="Override SAM crop size for ball segmentation (0=use --sam-crop-size)")
    focus_default = sys.platform == "darwin"
    parser.add_argument("--focus-terminal", action="store_true", default=focus_default,
                        help="After preview, activate Terminal/iTerm (default: ON on macOS)")
    parser.add_argument("--no-focus-terminal", action="store_true",
                        help="Disable auto-focus of Terminal after preview")
    args = parser.parse_args()

    # Apply focus-terminal setting to module-level flag
    global _focus_terminal_enabled
    if args.no_focus_terminal:
        _focus_terminal_enabled = False
    else:
        _focus_terminal_enabled = args.focus_terminal

    # Default is fast mode. --debug enables full overlays.
    # --no-overlay is accepted for clarity but is the default behavior.
    debug_mode = args.debug and not args.no_overlay

    base_config = load_base_config()

    # Show ROI preview and exit
    if args.show_roi:
        detection_roi = _load_detection_roi(base_config)
        if detection_roi is None:
            print("No detection_roi configured. Run: python3 src/calibrate.py --set-roi")
            return
        clips = sorted(f for f in os.listdir(args.clips_dir)
                        if f.startswith("pitch_") and f.endswith(".mp4"))
        if not clips:
            print(f"No clips in {args.clips_dir}")
            return
        cap = cv2.VideoCapture(os.path.join(args.clips_dir, clips[0]))
        ret, frame = cap.read()
        cap.release()
        if not ret:
            print("Cannot read frame")
            return

        rx, ry, rw, rh = detection_roi
        cv2.rectangle(frame, (rx, ry), (rx + rw, ry + rh), (0, 255, 0), 2)
        cv2.putText(frame, "DETECTION ROI", (rx + 5, ry - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cx1 = rx + int(rw * 0.6)
        cv2.rectangle(frame, (cx1, ry), (rx + rw, ry + rh), (0, 165, 255), 2)
        cv2.putText(frame, "CATCHER", (cx1 + 5, ry + 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 165, 255), 2)
        print(f"Detection ROI: x={rx}, y={ry}, w={rw}, h={rh}")
        print(f"Catcher region: x={cx1}-{rx+rw}, y={ry}-{ry+rh}")
        cv2.namedWindow("ROI Preview", cv2.WINDOW_NORMAL)
        cv2.imshow("ROI Preview", frame)
        cv2.waitKey(0)
        cv2.destroyAllWindows()
        return

    # Load player arsenal for pitch type selection
    # Try Arsenals.csv first (shared loader), fall back to sheets_sync
    from src.arsenals import get_player_arsenal as _get_arsenal_csv
    arsenal = _get_arsenal_csv(args.player_id, csv_path=args.arsenals_csv)
    if not arsenal:
        # Fall back to Google Sheets / players.yaml
        sheet_id = args.sheet_id or get_default_sheet_id()
        player_info = get_player(args.player_id, sheet_id=sheet_id)
        arsenal = player_info.get("arsenal", [])
    if arsenal:
        abbrevs = [p.get("abbreviation", "") for p in arsenal]
        print(f"Loaded arsenal for {args.player_id}: {abbrevs}")
    else:
        print(f"No arsenal found for {args.player_id}, using manual pitch type entry")

    # Load SAM predictors
    image_predictor = get_image_predictor(base_config)
    video_predictor = get_video_predictor(base_config) if debug_mode else None

    # Check ffmpeg availability for web-compatible overlay videos
    if not _has_ffmpeg():
        print("WARNING: ffmpeg not found. Overlay videos may not play in browser.")

    if debug_mode:
        mode_label = "DEBUG"
    elif args.overlay_lite:
        mode_label = "FAST + OVERLAY-LITE"
    else:
        mode_label = "FAST"
    print(f"\nMode: {mode_label}")
    if not debug_mode:
        print("  Skipping: SAM 2 video propagation")
        print("  Using: SAM 2 image predictor for glove + ball (2 frames only)")
        if args.overlay_lite:
            print("  Overlay: marker-based MP4 (no mask tracking)")
            if args.no_result_png:
                print("  Result PNG: skipped")
        else:
            print("  Overlay: none")
        if args.sam_crop_size > 0 or args.sam_max_width > 0:
            parts = []
            if args.sam_crop_size > 0:
                parts.append(f"crop={args.sam_crop_size}px")
            if args.sam_max_width > 0:
                parts.append(f"max_width={args.sam_max_width}px")
            print(f"  SAM speedup: {', '.join(parts)}")

    clips = sorted(
        f for f in os.listdir(args.clips_dir)
        if f.startswith("pitch_") and f.endswith(".mp4")
    )

    if not clips:
        print(f"No pitch clips found in {args.clips_dir}")
        return

    # Load pitch_log.json if it exists (from segment_pitches.py --manual or mark_pitches.py)
    parent_dir = os.path.dirname(args.clips_dir.rstrip("/"))
    pitch_log_path = os.path.join(parent_dir, "pitch_log.json")
    pitch_log_by_clip = {}
    if os.path.exists(pitch_log_path):
        with open(pitch_log_path) as f:
            log_data = json.load(f)
        # Support dict with "pitches" key, or bare list
        if isinstance(log_data, dict) and "pitches" in log_data:
            entries = log_data["pitches"]
        elif isinstance(log_data, list):
            entries = log_data
        else:
            entries = []
        for p in entries:
            clip_key = p.get("clip")
            if clip_key is None:
                print(f"  WARNING: pitch_log entry missing 'clip' key, skipping: {p}", flush=True)
                continue
            pitch_log_by_clip[clip_key] = p
        print(f"Loaded pitch_log.json: {len(pitch_log_by_clip)} entries", flush=True)

    print(f"Clip files in {args.clips_dir}: {len(clips)}", flush=True)
    if pitch_log_by_clip:
        matched = [c for c in clips if c in pitch_log_by_clip]
        unmatched = [c for c in clips if c not in pitch_log_by_clip]
        print(f"Matched by filename: {len(matched)}", flush=True)
        if unmatched:
            show = unmatched[:10]
            print(f"Unmatched clips ({len(unmatched)}): {show}"
                  f"{'...' if len(unmatched) > 10 else ''}", flush=True)

    print(f"Player: {args.player_id} ({'RHP' if args.pitcher_hand == 'R' else 'LHP'})")
    print(f"Output CSV: {args.output_csv}")
    if args.start_at > 1:
        print(f"Starting at pitch #{args.start_at}")

    results_dir = os.path.join(parent_dir, "results")

    processed = []
    skipped = 0
    run_timer = RunTimer()

    for i, clip_name in enumerate(clips):
        pitch_num = i + 1
        if pitch_num < args.start_at:
            continue

        clip_path = os.path.join(args.clips_dir, clip_name)

        # Look up pre-marked frames from pitch_log.json by clip filename
        log_entry = pitch_log_by_clip.get(clip_name)
        known_target = None
        known_arrival = None
        known_pitch_type = None
        if log_entry is not None:
            known_target = log_entry["target_frame"]
            known_arrival = log_entry["arrival_frame"]
            known_pitch_type = log_entry.get("pitch_type", "")

        if debug_mode:
            result, pitch_timer = process_single_pitch_debug(
                clip_path=clip_path,
                base_config=base_config,
                pitch_number=pitch_num,
                player_id=args.player_id,
                pitcher_hand=args.pitcher_hand,
                csv_path=args.output_csv,
                zone_height=args.zone_height,
                output_dir=results_dir,
                video_predictor=video_predictor,
                image_predictor=image_predictor,
                known_target=known_target,
                known_arrival=known_arrival,
                arsenal=arsenal,
                batch_mode=args.batch,
                known_pitch_type=known_pitch_type,
            )
        else:
            result, pitch_timer = process_single_pitch_fast(
                clip_path=clip_path,
                base_config=base_config,
                pitch_number=pitch_num,
                player_id=args.player_id,
                pitcher_hand=args.pitcher_hand,
                csv_path=args.output_csv,
                zone_height=args.zone_height,
                output_dir=results_dir,
                image_predictor=image_predictor,
                known_target=known_target,
                known_arrival=known_arrival,
                arsenal=arsenal,
                batch_mode=args.batch,
                known_pitch_type=known_pitch_type,
                sam_crop_size=args.sam_crop_size,
                sam_max_width=args.sam_max_width,
                sam_glove_crop=args.glove_crop_size,
                sam_ball_crop=args.ball_crop_size,
                overlay_lite=args.overlay_lite,
                result_png=not args.no_result_png,
            )

        if result:
            processed.append(result)
            run_timer.record(pitch_timer)
        else:
            skipped += 1

    # Summary
    print(f"\n{'='*60}")
    print("=== Batch Complete ===")
    print(f"Mode: {mode_label}")
    print(f"Processed: {len(processed)} pitches")
    print(f"Skipped: {skipped}")
    if processed:
        miss_values = [p["total_miss_inches"] for p in processed
                       if p["total_miss_inches"] is not None]
        if miss_values:
            print(f"Average miss: {sum(miss_values) / len(miss_values):.1f}\"")
            print(f"Min miss: {min(miss_values):.1f}\"")
            print(f"Max miss: {max(miss_values):.1f}\"")

        # Confidence breakdown (batch mode)
        if args.batch:
            high = [p for p in processed if p.get("confidence", 100) >= 80]
            medium = [p for p in processed if 50 <= p.get("confidence", 100) < 80]
            low = [p for p in processed if p.get("confidence", 100) < 50]
            print(f"\nConfidence breakdown:")
            print(f"  High (>=80%):  {len(high)} pitches")
            print(f"  Medium (50-79%): {len(medium)} pitches")
            print(f"  Low (<50%):    {len(low)} pitches - REVIEW NEEDED")

        print(f"\nPitch-by-pitch:")
        for p in processed:
            miss = f'{p["total_miss_inches"]:.1f}"' if p["total_miss_inches"] else "N/A"
            conf_str = f" conf={p['confidence']}%" if args.batch else ""
            print(f"  #{p['pitch_number']:2d} {p['clip']:15s} {p['pitch_type']:4s} "
                  f"miss={miss} ({p['h_miss']}, {p['v_miss']}){conf_str}")

    print(f"\nCSV: {args.output_csv}")
    if debug_mode:
        print(f"Results: {results_dir}")

    # Timing summary
    print(run_timer.summary())
    print(f"{'='*60}")

    # Batch mode: offer to review low-confidence pitches
    if args.batch and processed:
        low_conf = [p for p in processed if p.get("confidence", 100) < 50]
        if low_conf:
            answer = input(f"\n{len(low_conf)} low-confidence pitches. Review now? (y/n): ").strip().lower()
            if answer == "y":
                print("Re-processing low-confidence pitches with manual input...")
                for p in low_conf:
                    clip_path = os.path.join(args.clips_dir, p["clip"])
                    log_entry = pitch_log_by_clip.get(p["clip"])
                    kt = None
                    ka = None
                    kpt = None
                    if log_entry is not None:
                        kt = log_entry["target_frame"]
                        ka = log_entry["arrival_frame"]
                        kpt = log_entry.get("pitch_type", "")
                    if debug_mode:
                        process_single_pitch_debug(
                            clip_path=clip_path,
                            base_config=base_config,
                            pitch_number=p["pitch_number"],
                            player_id=args.player_id,
                            pitcher_hand=args.pitcher_hand,
                            csv_path=args.output_csv,
                            zone_height=args.zone_height,
                            output_dir=results_dir,
                            video_predictor=video_predictor,
                            image_predictor=image_predictor,
                            known_target=kt,
                            known_arrival=ka,
                            arsenal=arsenal,
                            batch_mode=False,
                            known_pitch_type=kpt,
                        )
                    else:
                        process_single_pitch_fast(
                            clip_path=clip_path,
                            base_config=base_config,
                            pitch_number=p["pitch_number"],
                            player_id=args.player_id,
                            pitcher_hand=args.pitcher_hand,
                            csv_path=args.output_csv,
                            zone_height=args.zone_height,
                            output_dir=results_dir,
                            image_predictor=image_predictor,
                            known_target=kt,
                            known_arrival=ka,
                            arsenal=arsenal,
                            batch_mode=False,
                            known_pitch_type=kpt,
                        )
                print("Review complete.")


if __name__ == "__main__":
    main()
