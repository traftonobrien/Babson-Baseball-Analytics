"""
ViTPose pose estimation backend for mechanics analysis.

Uses ONNX Runtime for inference with a ViTPose-B model. Falls back to
MediaPipe if ViTPose model is unavailable or inference fails.

KEYPOINT MAPPING:
  ViTPose uses COCO 17-keypoint format. This module maps those 17 keypoints
  to the MediaPipe 33-landmark format used downstream. Unmapped landmarks
  (face mesh, hands, feet indices) are filled with NaN.

MODEL:
  Default model: ViTPose-B (base) exported to ONNX (~95 MB).
  Downloaded on first use to ~/.cache/pitch-tracker/vitpose_b.onnx.
  Override with VITPOSE_MODEL_PATH environment variable.

DEPENDENCIES:
  - onnxruntime (CPU) or onnxruntime-gpu (GPU)
  - numpy, opencv-python

GPU:
  Automatically uses CUDA if onnxruntime-gpu is installed and a GPU is
  available. Falls back to CPU otherwise.
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

from .pose import KP, NUM_LANDMARKS, PoseResult
from .video_io import iter_frames, read_video_meta

_log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model paths and download
# ---------------------------------------------------------------------------

# ViTPose-B ONNX model (~95 MB). This is a community-exported ONNX from the
# official ViTPose checkpoint. The URL can be overridden via environment.
_DEFAULT_MODEL_URL = os.environ.get(
    "VITPOSE_MODEL_URL",
    "https://huggingface.co/onnx-community/vitpose-base-simple/resolve/main/onnx/model.onnx",
)

_DEFAULT_MODEL_CACHE = Path(
    os.environ.get(
        "VITPOSE_MODEL_PATH",
        str(Path.home() / ".cache" / "pitch-tracker" / "vitpose_b.onnx"),
    )
)


def _ensure_vitpose_model(
    model_path: Optional[Path] = None,
    model_url: Optional[str] = None,
) -> Path:
    """Download ViTPose ONNX model if not cached."""
    path = model_path or _DEFAULT_MODEL_CACHE
    url = model_url or _DEFAULT_MODEL_URL

    if path.exists():
        return path

    path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading ViTPose model to {path} ...")
    try:
        urllib.request.urlretrieve(url, path)
        print(f"  ViTPose model downloaded ({path.stat().st_size / 1e6:.1f} MB).")
    except Exception as e:
        if path.exists():
            path.unlink()
        raise RuntimeError(f"Failed to download ViTPose model from {url}: {e}") from e
    return path


# ---------------------------------------------------------------------------
# COCO → MediaPipe keypoint mapping
# ---------------------------------------------------------------------------

# COCO 17 keypoints: nose, left_eye, right_eye, left_ear, right_ear,
# left_shoulder, right_shoulder, left_elbow, right_elbow, left_wrist,
# right_wrist, left_hip, right_hip, left_knee, right_knee, left_ankle,
# right_ankle

# Map COCO index → MediaPipe landmark index.
# Only the keypoints that have a direct MediaPipe equivalent are mapped.
_COCO_TO_MEDIAPIPE: dict[int, int] = {
    0: KP["NOSE"],              # nose
    5: KP["LEFT_SHOULDER"],     # left_shoulder
    6: KP["RIGHT_SHOULDER"],    # right_shoulder
    7: KP["LEFT_ELBOW"],        # left_elbow
    8: KP["RIGHT_ELBOW"],       # right_elbow
    9: KP["LEFT_WRIST"],        # left_wrist
    10: KP["RIGHT_WRIST"],      # right_wrist
    11: KP["LEFT_HIP"],         # left_hip
    12: KP["RIGHT_HIP"],        # right_hip
    13: KP["LEFT_KNEE"],        # left_knee
    14: KP["RIGHT_KNEE"],       # right_knee
    15: KP["LEFT_ANKLE"],       # left_ankle
    16: KP["RIGHT_ANKLE"],      # right_ankle
}

# COCO keypoints that are eyes/ears — not directly in KP but mapped to
# nearby MediaPipe indices for completeness.
_COCO_FACE_TO_MEDIAPIPE: dict[int, int] = {
    1: 2,   # left_eye → MediaPipe LEFT_EYE_INNER (index 2, approximate)
    2: 5,   # right_eye → MediaPipe RIGHT_EYE_INNER (index 5, approximate)
    3: 7,   # left_ear → MediaPipe LEFT_EAR (index 7)
    4: 8,   # right_ear → MediaPipe RIGHT_EAR (index 8)
}


def _coco17_to_mediapipe33(
    coco_kps: np.ndarray,
    width: int,
    height: int,
) -> np.ndarray:
    """
    Convert COCO 17-keypoint array to MediaPipe 33-landmark format.

    Args:
        coco_kps: shape (17, 3) — x, y in pixel coords, score [0,1].
        width, height: frame dimensions for normalization.

    Returns:
        (33, 3) float32 array with normalized x, y and visibility.
        Unmapped landmarks are NaN.
    """
    out = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)

    for coco_idx, mp_idx in _COCO_TO_MEDIAPIPE.items():
        x_px, y_px, score = coco_kps[coco_idx]
        out[mp_idx, 0] = x_px / max(1, width)
        out[mp_idx, 1] = y_px / max(1, height)
        out[mp_idx, 2] = float(score)

    # Map face keypoints (approximate).
    for coco_idx, mp_idx in _COCO_FACE_TO_MEDIAPIPE.items():
        x_px, y_px, score = coco_kps[coco_idx]
        out[mp_idx, 0] = x_px / max(1, width)
        out[mp_idx, 1] = y_px / max(1, height)
        out[mp_idx, 2] = float(score)

    # Synthesize heel and foot_index from ankle positions with slight offset.
    # These are approximate — ViTPose doesn't provide foot landmarks.
    for side in ("LEFT", "RIGHT"):
        ankle_idx = KP[f"{side}_ANKLE"]
        heel_idx = KP[f"{side}_HEEL"]
        foot_idx = KP[f"{side}_FOOT_INDEX"]

        if not np.isnan(out[ankle_idx, 0]):
            ax, ay, av = out[ankle_idx]
            # Heel: slightly behind and below ankle.
            out[heel_idx, 0] = ax
            out[heel_idx, 1] = ay + 0.015  # ~15px down in normalized coords
            out[heel_idx, 2] = av * 0.7    # reduced confidence for synthetic
            # Foot index: slightly forward from ankle.
            out[foot_idx, 0] = ax
            out[foot_idx, 1] = ay + 0.010
            out[foot_idx, 2] = av * 0.6

    return out


# ---------------------------------------------------------------------------
# ViTPose inference session
# ---------------------------------------------------------------------------

class ViTPoseSession:
    """ONNX Runtime session for ViTPose inference."""

    def __init__(
        self,
        model_path: Optional[Path] = None,
        model_url: Optional[str] = None,
    ):
        try:
            import onnxruntime as ort
        except ImportError:
            raise ImportError(
                "onnxruntime is required for ViTPose. "
                "Install with: pip install onnxruntime"
            )

        self._model_path = _ensure_vitpose_model(model_path, model_url)

        # Choose providers: prefer GPU if available.
        providers = []
        available = ort.get_available_providers()
        if "CUDAExecutionProvider" in available:
            providers.append("CUDAExecutionProvider")
        providers.append("CPUExecutionProvider")

        self._session = ort.InferenceSession(
            str(self._model_path),
            providers=providers,
        )
        self._input_name = self._session.get_inputs()[0].name
        input_shape = self._session.get_inputs()[0].shape
        # Expected input: (1, 3, H, W) — typically (1, 3, 256, 192)
        _h = input_shape[2] if len(input_shape) == 4 else 256
        _w = input_shape[3] if len(input_shape) == 4 else 192
        self._input_h = _h if isinstance(_h, int) else 256
        self._input_w = _w if isinstance(_w, int) else 192

        _log.info(
            "ViTPose session: model=%s, input=%dx%d, providers=%s",
            self._model_path.name, self._input_h, self._input_w,
            self._session.get_providers(),
        )

    @property
    def backend_name(self) -> str:
        return "vitpose"

    def predict_frame(
        self,
        frame_bgr: np.ndarray,
        bbox: Optional[tuple[int, int, int, int]] = None,
    ) -> np.ndarray:
        """
        Run ViTPose on a single frame.

        Args:
            frame_bgr: BGR image (H, W, 3).
            bbox: Optional (x1, y1, x2, y2) bounding box for the person.
                  If None, uses the full frame.

        Returns:
            (17, 3) array — COCO keypoints (x_px, y_px, confidence).
        """
        h, w = frame_bgr.shape[:2]

        if bbox is not None:
            x1, y1, x2, y2 = bbox
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            crop = frame_bgr[y1:y2, x1:x2]
            crop_w, crop_h = x2 - x1, y2 - y1
        else:
            crop = frame_bgr
            x1, y1 = 0, 0
            crop_w, crop_h = w, h

        # Preprocess: resize, normalize, CHW format.
        resized = cv2.resize(crop, (self._input_w, self._input_h))
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0

        # ImageNet normalization.
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        rgb = (rgb - mean) / std

        blob = np.transpose(rgb, (2, 0, 1))[np.newaxis]  # (1, 3, H, W)

        # Run inference.
        outputs = self._session.run(None, {self._input_name: blob})
        heatmaps = outputs[0]  # (1, 17, H/4, W/4) typically

        # Decode heatmaps to keypoints.
        kps = self._decode_heatmaps(heatmaps[0], crop_w, crop_h)

        # Offset keypoints back to full-frame coordinates.
        kps[:, 0] += x1
        kps[:, 1] += y1

        return kps

    def _decode_heatmaps(
        self,
        heatmaps: np.ndarray,
        orig_w: int,
        orig_h: int,
    ) -> np.ndarray:
        """
        Decode (17, Hm, Wm) heatmaps to (17, 3) keypoints.

        Returns pixel coordinates in the original crop space + confidence.
        """
        num_kps, hm_h, hm_w = heatmaps.shape
        kps = np.zeros((num_kps, 3), dtype=np.float32)

        for k in range(num_kps):
            hm = heatmaps[k]
            max_val = float(np.max(hm))
            if max_val <= 0:
                kps[k] = [0, 0, 0]
                continue

            # Find peak location.
            flat_idx = int(np.argmax(hm))
            py, px = divmod(flat_idx, hm_w)

            # Sub-pixel refinement via neighbors.
            if 0 < px < hm_w - 1:
                diff_x = float(hm[py, px + 1] - hm[py, px - 1])
                px += 0.25 * np.sign(diff_x)
            if 0 < py < hm_h - 1:
                diff_y = float(hm[py + 1, px if isinstance(px, int) else int(px)] - hm[py - 1, px if isinstance(px, int) else int(px)])
                py += 0.25 * np.sign(diff_y)

            # Scale to original crop dimensions.
            kps[k, 0] = float(px) * orig_w / hm_w
            kps[k, 1] = float(py) * orig_h / hm_h
            kps[k, 2] = max_val

        return kps


# ---------------------------------------------------------------------------
# Public extraction API (mirrors pose.extract_poses signature)
# ---------------------------------------------------------------------------

_session_cache: Optional[ViTPoseSession] = None


def _get_session(
    model_path: Optional[Path] = None,
    model_url: Optional[str] = None,
) -> ViTPoseSession:
    """Get or create the cached ViTPose session."""
    global _session_cache
    if _session_cache is None:
        _session_cache = ViTPoseSession(model_path=model_path, model_url=model_url)
    return _session_cache


def extract_poses_vitpose(
    video_path: str | Path,
    max_frames: Optional[int] = None,
    verbose: bool = False,
    model_path: Optional[Path] = None,
    model_url: Optional[str] = None,
) -> List[PoseResult]:
    """
    Run ViTPose on every frame and return a list of PoseResult.

    Compatible with the pose.extract_poses API — returns PoseResult objects
    with (33, 3) landmark arrays in MediaPipe format.

    Args:
        video_path:  Path to the video file.
        max_frames:  Stop after this many frames.
        verbose:     Print progress every 30 frames.
        model_path:  Override ViTPose ONNX model path.
        model_url:   Override ViTPose model download URL.
    """
    session = _get_session(model_path=model_path, model_url=model_url)
    meta = read_video_meta(video_path)
    results: List[PoseResult] = []

    for frame_idx, frame_bgr in iter_frames(video_path):
        if max_frames is not None and len(results) >= max_frames:
            break

        try:
            coco_kps = session.predict_frame(frame_bgr)
            landmarks = _coco17_to_mediapipe33(coco_kps, meta.width, meta.height)
        except Exception as e:
            _log.warning("ViTPose failed on frame %d: %s", frame_idx, e)
            landmarks = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)

        results.append(PoseResult(
            frame_idx=frame_idx,
            landmarks=landmarks,
            width=meta.width,
            height=meta.height,
        ))

        if verbose and frame_idx % 30 == 0:
            valid = not np.isnan(landmarks[:, 0]).all()
            status = "OK" if valid else "NO POSE"
            print(f"  frame {frame_idx}/{meta.frame_count}  {status}")

    return results
