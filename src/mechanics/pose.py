"""
MediaPipe Pose wrapper for mechanics analysis.

WHAT THIS MODULE DOES:
  Runs Google's MediaPipe Pose Landmarker (Tasks API, v0.10+) on video frames
  and returns normalized landmark arrays for downstream analysis.

API NOTE:
  MediaPipe 0.10+ uses the Tasks API. The legacy mp.solutions.pose was removed.
  This module auto-downloads the lite pose model (~3 MB) on first use and
  caches it at ~/.cache/mediapipe/pose_landmarker_lite.task.

WHY MEDIAPIPE FIRST (not YOLO, ViTPose, etc.):
  Zero-config after pip install. CPU real-time. 33 landmarks out of the box.
  Good enough for heuristic coaching metrics.

KNOWN LIMITATIONS:
  - Accuracy degrades with limb occlusion (lead leg behind drive leg).
  - Wrist tracking is unreliable during arm acceleration (motion blur).
  - Always picks the most prominent person — make sure the pitcher fills
    most of the frame.

WHAT COMES NEXT:
  - ViTPose / HRNet: better accuracy in occlusion scenarios.
  - YOLO + tracking (SORT/ByteTrack): ball, glove, helmet detection.
  - Multi-view calibration: triangulate 3D positions from two cameras.
"""
from __future__ import annotations

import dataclasses
import logging
import os
import urllib.request
from pathlib import Path
from typing import List, Optional

import cv2
import numpy as np

# Suppress MediaPipe internal warnings (NORM_RECT, IMAGE_DIMENSIONS)
# that are harmless but noisy when running in VIDEO mode.
os.environ.setdefault("GLOG_minloglevel", "2")

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python.vision import (
    PoseLandmarker,
    PoseLandmarkerOptions,
)
from mediapipe.tasks.python.vision.core.vision_task_running_mode import (
    VisionTaskRunningMode,
)

from .video_io import iter_frames, read_video_meta

# ---------------------------------------------------------------------------
# Keypoint name → landmark index mapping.
# These indices are identical in legacy solutions and Tasks API.
# Full list: developers.google.com/mediapipe/solutions/vision/pose_landmarker
# ---------------------------------------------------------------------------
KP: dict[str, int] = {
    "NOSE": 0,
    "LEFT_SHOULDER": 11,
    "RIGHT_SHOULDER": 12,
    "LEFT_ELBOW": 13,
    "RIGHT_ELBOW": 14,
    "LEFT_WRIST": 15,
    "RIGHT_WRIST": 16,
    "LEFT_HIP": 23,
    "RIGHT_HIP": 24,
    "LEFT_KNEE": 25,
    "RIGHT_KNEE": 26,
    "LEFT_ANKLE": 27,
    "RIGHT_ANKLE": 28,
    "LEFT_HEEL": 29,
    "RIGHT_HEEL": 30,
    "LEFT_FOOT_INDEX": 31,
    "RIGHT_FOOT_INDEX": 32,
}

NUM_LANDMARKS = 33

# Skeleton connections for drawing (hardcoded from MediaPipe spec).
# Each tuple is (landmark_index_A, landmark_index_B).
POSE_CONNECTIONS: frozenset[tuple[int, int]] = frozenset([
    (0, 1), (1, 2), (2, 3), (3, 7),
    (0, 4), (4, 5), (5, 6), (6, 8),
    (9, 10),
    (11, 12), (11, 13), (13, 15), (15, 17), (15, 19), (15, 21), (17, 19),
    (12, 14), (14, 16), (16, 18), (16, 20), (16, 22), (18, 20),
    (11, 23), (12, 24), (23, 24),
    (23, 25), (24, 26), (25, 27), (26, 28),
    (27, 29), (28, 30), (29, 31), (30, 32),
    (27, 31), (28, 32),
])

# Model download URL and local cache path
_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "pose_landmarker/pose_landmarker_lite/float16/latest/"
    "pose_landmarker_lite.task"
)
_MODEL_CACHE = Path.home() / ".cache" / "mediapipe" / "pose_landmarker_lite.task"


def _ensure_model() -> Path:
    """
    Download the pose landmarker model if not already cached.

    Downloads ~3 MB on first use to ~/.cache/mediapipe/.
    Subsequent runs use the cached file.
    """
    if not _MODEL_CACHE.exists():
        _MODEL_CACHE.parent.mkdir(parents=True, exist_ok=True)
        print(f"Downloading pose landmarker model to {_MODEL_CACHE} …")
        urllib.request.urlretrieve(_MODEL_URL, _MODEL_CACHE)
        print("  Model downloaded.")
    return _MODEL_CACHE


# ---------------------------------------------------------------------------
# PoseResult
# ---------------------------------------------------------------------------

@dataclasses.dataclass
class PoseResult:
    """
    Pose estimation result for a single frame.

    landmarks: (33, 3) float32 array.
               Column 0: x normalized [0,1] (left→right in image).
               Column 1: y normalized [0,1] (top→bottom in image).
               Column 2: visibility score [0,1].
               All NaN means no pose was detected on this frame.

    frame_idx: Actual frame index in the source video (0-based).
    width, height: Source video dimensions in pixels.
    """
    frame_idx: int
    landmarks: np.ndarray  # shape (33, 3), dtype float32
    width: int
    height: int

    @property
    def valid(self) -> bool:
        """True if this frame has at least some valid landmarks."""
        return self.landmarks is not None and not np.isnan(self.landmarks[:, 0]).all()

    def pixel(self, kp_name: str) -> tuple[float, float]:
        """Return (x_px, y_px) for a named keypoint."""
        idx = KP[kp_name]
        lm = self.landmarks[idx]
        return float(lm[0]) * self.width, float(lm[1]) * self.height

    def visibility(self, kp_name: str) -> float:
        """Return visibility score [0,1] for a named keypoint."""
        return float(self.landmarks[KP[kp_name], 2])


# ---------------------------------------------------------------------------
# Pose extraction
# ---------------------------------------------------------------------------

_log = logging.getLogger(__name__)


def _frame_jump_magnitude(
    prev: np.ndarray,
    curr: np.ndarray,
) -> float:
    """L2 distance between two landmark arrays (ignoring NaN entries)."""
    mask = ~np.isnan(prev[:, 0]) & ~np.isnan(curr[:, 0])
    if mask.sum() == 0:
        return 0.0
    diff = curr[mask, :2] - prev[mask, :2]
    return float(np.sqrt(np.mean(diff ** 2)))


def extract_poses(
    video_path: str | Path,
    max_frames: Optional[int] = None,
    min_detection_confidence: float = 0.5,
    min_tracking_confidence: float = 0.5,
    verbose: bool = False,
    debug_stability: bool = False,
) -> List[PoseResult]:
    """
    Run MediaPipe Pose Landmarker on every frame and return a list of PoseResult.

    Frames where no pose is detected get a NaN-filled landmarks array
    (shape still (33, 3)) so downstream code always gets the same shape.

    TROUBLESHOOTING:
      Low valid count → try lowering min_detection_confidence to 0.3.
      Wrong person detected → MediaPipe picks the most prominent pose;
        make sure the pitcher fills most of the frame.
      Model not downloading → ensure internet access on first run, or
        manually place pose_landmarker_lite.task at ~/.cache/mediapipe/.

    Args:
        video_path:  Path to the video file.
        max_frames:  Stop after this many frames (useful for quick testing).
        min_detection_confidence: Threshold for initial detection.
        min_tracking_confidence:  Threshold for subsequent tracking.
        verbose:     Print progress every 30 frames.
        debug_stability: Log per-frame visibility and jump magnitude.
    """
    model_path = _ensure_model()
    meta = read_video_meta(video_path)
    results: List[PoseResult] = []

    base_options = mp_python.BaseOptions(model_asset_path=str(model_path))
    options = PoseLandmarkerOptions(
        base_options=base_options,
        running_mode=VisionTaskRunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=min_detection_confidence,
        min_pose_presence_confidence=min_detection_confidence,
        min_tracking_confidence=min_tracking_confidence,
    )

    with PoseLandmarker.create_from_options(options) as landmarker:
        for frame_idx, frame_bgr in iter_frames(video_path):
            if max_frames is not None and len(results) >= max_frames:
                break

            # Tasks API requires RGB and an mp.Image wrapper
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            # Timestamp must be monotonically increasing (in milliseconds)
            timestamp_ms = int(frame_idx * 1000 / meta.fps)
            detection = landmarker.detect_for_video(mp_image, timestamp_ms)

            if detection.pose_landmarks:
                raw = detection.pose_landmarks[0]  # first (only) person
                lm = np.array(
                    [[l.x, l.y, l.visibility] for l in raw],
                    dtype=np.float32,
                )
            else:
                lm = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)

            results.append(PoseResult(
                frame_idx=frame_idx,
                landmarks=lm,
                width=meta.width,
                height=meta.height,
            ))

            if debug_stability and results:
                vis_mean = float(np.nanmean(lm[:, 2])) if not np.isnan(lm[:, 0]).all() else 0.0
                jump = 0.0
                if len(results) >= 2:
                    jump = _frame_jump_magnitude(results[-2].landmarks, lm)
                _log.debug(
                    "frame=%d  vis=%.3f  jump=%.4f",
                    frame_idx, vis_mean, jump,
                )

            if verbose and frame_idx % 30 == 0:
                status = "OK" if detection.pose_landmarks else "NO POSE"
                print(f"  frame {frame_idx}/{meta.frame_count}  {status}")

    return results


# ---------------------------------------------------------------------------
# Drawing
# ---------------------------------------------------------------------------

def draw_skeleton(
    frame: np.ndarray,
    pose_result: PoseResult,
    min_visibility: float = 0.5,
    color: tuple = (0, 255, 0),
    thickness: int = 2,
) -> np.ndarray:
    """
    Draw skeleton connections and keypoint dots on a copy of the frame.

    Returns annotated BGR image. Does not modify the input frame.
    Skips connections where either endpoint has visibility < min_visibility.
    """
    out = frame.copy()
    if not pose_result.valid:
        return out

    h, w = out.shape[:2]
    lm = pose_result.landmarks

    # Connections (white lines)
    for (i, j) in POSE_CONNECTIONS:
        if i >= NUM_LANDMARKS or j >= NUM_LANDMARKS:
            continue
        if lm[i, 2] > min_visibility and lm[j, 2] > min_visibility:
            x1 = int(lm[i, 0] * w)
            y1 = int(lm[i, 1] * h)
            x2 = int(lm[j, 0] * w)
            y2 = int(lm[j, 1] * h)
            cv2.line(out, (x1, y1), (x2, y2), (220, 220, 220), 1, cv2.LINE_AA)

    # Keypoints (colored dots)
    for i in range(NUM_LANDMARKS):
        if not np.isnan(lm[i, 0]) and lm[i, 2] > min_visibility:
            x = int(lm[i, 0] * w)
            y = int(lm[i, 1] * h)
            cv2.circle(out, (x, y), 4, color, -1, cv2.LINE_AA)

    return out
