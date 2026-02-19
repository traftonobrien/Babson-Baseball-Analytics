"""
Heuristic camera-angle classifier for baseball bullpen/game clips.

The classifier is intentionally conservative: uncertain cases return "unknown"
with lower confidence and an explainability cue list.
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Iterable, Optional

import cv2
import numpy as np

from src.mechanics.video_io import read_video_meta


@dataclasses.dataclass
class AnglePrediction:
    angle_class: str
    confidence: float
    cues: list[str]
    features: dict[str, float]


def _green_ratio(hsv: np.ndarray) -> float:
    h, s, v = cv2.split(hsv)
    mask = (h >= 35) & (h <= 95) & (s >= 35) & (v >= 35)
    return float(np.mean(mask))


def _brown_ratio(hsv: np.ndarray) -> float:
    h, s, v = cv2.split(hsv)
    mask = (h >= 5) & (h <= 30) & (s >= 40) & (v >= 25)
    return float(np.mean(mask))


def _symmetry_score(gray: np.ndarray) -> float:
    h, w = gray.shape
    half = w // 2
    left = gray[:, :half]
    right = gray[:, w - half:]
    right_flip = cv2.flip(right, 1)
    diff = np.mean(np.abs(left.astype(np.float32) - right_flip.astype(np.float32))) / 255.0
    return float(max(0.0, 1.0 - diff))


def _sample_frames(frames: list[np.ndarray], max_samples: int = 14) -> list[np.ndarray]:
    if len(frames) <= max_samples:
        return frames
    idxs = np.linspace(0, len(frames) - 1, max_samples).astype(np.int32)
    return [frames[int(i)] for i in idxs]


def _motion_features(sampled: list[np.ndarray]) -> tuple[float, float, float]:
    """
    Returns:
      motion_strength, motion_centroid_x, horizontal_motion_ratio
    """
    if len(sampled) < 2:
        return 0.0, 0.5, 1.0

    motion_acc = None
    flow_x: list[float] = []
    flow_y: list[float] = []
    prev_gray = cv2.cvtColor(sampled[0], cv2.COLOR_BGR2GRAY)
    prev_small = cv2.resize(prev_gray, (160, 90))

    for frame in sampled[1:]:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        diff = cv2.absdiff(gray, prev_gray)
        _, th = cv2.threshold(diff, 16, 255, cv2.THRESH_BINARY)
        motion_acc = th.astype(np.float32) if motion_acc is None else (motion_acc + th.astype(np.float32))

        small = cv2.resize(gray, (160, 90))
        flow = cv2.calcOpticalFlowFarneback(
            prev_small,
            small,
            None,
            pyr_scale=0.5,
            levels=2,
            winsize=13,
            iterations=2,
            poly_n=5,
            poly_sigma=1.1,
            flags=0,
        )
        flow_x.append(float(np.mean(np.abs(flow[..., 0]))))
        flow_y.append(float(np.mean(np.abs(flow[..., 1]))))
        prev_gray = gray
        prev_small = small

    if motion_acc is None:
        return 0.0, 0.5, 1.0

    h, w = motion_acc.shape
    total_motion = float(np.sum(motion_acc)) + 1e-6
    xs = np.tile(np.arange(w, dtype=np.float32), (h, 1))
    centroid_x = float(np.sum(xs * motion_acc) / total_motion) / max(1.0, w - 1)
    motion_strength = float(np.mean(motion_acc > 0.0))
    horiz_ratio = float(np.mean(flow_x) / max(np.mean(flow_y), 1e-6)) if flow_x else 1.0
    return motion_strength, centroid_x, horiz_ratio


def extract_angle_features(frames: list[np.ndarray]) -> dict[str, float]:
    sampled = _sample_frames(frames, max_samples=14)
    if not sampled:
        return {}

    g_list: list[float] = []
    b_list: list[float] = []
    sym_list: list[float] = []
    brown_bottom: list[float] = []
    dark_lower_center: list[float] = []

    for frame in sampled:
        resized = cv2.resize(frame, (320, 180))
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        g_list.append(_green_ratio(hsv))
        b_list.append(_brown_ratio(hsv))
        sym_list.append(_symmetry_score(gray))

        h, w = gray.shape
        bottom = hsv[int(h * 0.62):, :]
        brown_bottom.append(_brown_ratio(bottom))

        lower_center = gray[int(h * 0.66):, int(w * 0.35):int(w * 0.65)]
        dark_lower_center.append(float(np.mean(lower_center < 78)))

    motion_strength, motion_cx, horiz_ratio = _motion_features(sampled)
    return {
        "green_ratio": float(np.mean(g_list)),
        "brown_ratio": float(np.mean(b_list)),
        "symmetry": float(np.mean(sym_list)),
        "brown_bottom_ratio": float(np.mean(brown_bottom)),
        "dark_lower_center_ratio": float(np.mean(dark_lower_center)),
        "motion_strength": motion_strength,
        "motion_centroid_x": motion_cx,
        "horizontal_motion_ratio": horiz_ratio,
    }


def classify_angle_from_features(features: dict[str, float]) -> AnglePrediction:
    if not features:
        return AnglePrediction("unknown", 0.0, ["no_features"], {})

    green = features.get("green_ratio", 0.0)
    symmetry = features.get("symmetry", 0.0)
    brown_bottom = features.get("brown_bottom_ratio", 0.0)
    dark_lc = features.get("dark_lower_center_ratio", 0.0)
    motion = features.get("motion_strength", 0.0)
    motion_x = features.get("motion_centroid_x", 0.5)
    horiz = features.get("horizontal_motion_ratio", 1.0)

    cues: list[str] = []
    label = "unknown"
    conf = 0.2

    if motion >= 0.01 and horiz >= 1.10 and abs(motion_x - 0.5) >= 0.12 and green >= 0.10:
        cues.append("asymmetric_motion_centroid")
        cues.append("horizontal_motion_dominant")
        if motion_x <= 0.5:
            label = "open_side_RHP"
            cues.append("motion_weighted_left")
        else:
            label = "open_side_LHP"
            cues.append("motion_weighted_right")
        conf = min(0.92, 0.48 + min(0.20, abs(motion_x - 0.5)) + min(0.18, (horiz - 1.0) * 0.4))
    elif symmetry >= 0.72 and green >= 0.17:
        cues.append("high_symmetry")
        cues.append("field_green_dominant")
        if brown_bottom >= 0.11 or dark_lc >= 0.18:
            label = "behind_home"
            conf = min(0.97, 0.55 + (symmetry - 0.72) * 0.8 + min(0.25, dark_lc))
            cues.append("brown_bottom_or_catcher_presence")
        else:
            label = "behind_center"
            conf = min(0.95, 0.52 + (symmetry - 0.72) * 0.8 + min(0.20, green))
            cues.append("centerfield_symmetry_profile")
    elif symmetry <= 0.62 and green <= 0.15:
        if motion_x < 0.5:
            label = "hitter_view_RHH"
            cues.append("hitter_perspective_righty")
        else:
            label = "hitter_view_LHH"
            cues.append("hitter_perspective_lefty")
        conf = min(0.85, 0.40 + (0.62 - symmetry) * 0.6)
    else:
        cues.append("classification_uncertain")
        conf = min(0.45, 0.20 + motion * 0.2)

    return AnglePrediction(
        angle_class=label,
        confidence=max(0.0, min(1.0, float(conf))),
        cues=cues,
        features={k: round(float(v), 5) for k, v in features.items()},
    )


def classify_angle_from_frames(frames: list[np.ndarray]) -> AnglePrediction:
    return classify_angle_from_features(extract_angle_features(frames))


def sample_segment_frames(
    video_path: str | Path,
    start_frame: int,
    end_frame: int,
    max_samples: int = 14,
) -> list[np.ndarray]:
    if end_frame < start_frame:
        return []
    path = Path(video_path)
    meta = read_video_meta(path)
    lo = max(0, int(start_frame))
    hi = min(meta.frame_count - 1, int(end_frame))
    if hi < lo:
        return []
    if (hi - lo + 1) <= max_samples:
        sample_idx = list(range(lo, hi + 1))
    else:
        sample_idx = np.linspace(lo, hi, max_samples).astype(np.int32).tolist()

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")
    out: list[np.ndarray] = []
    try:
        for idx in sample_idx:
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
            ok, frame = cap.read()
            if not ok:
                continue
            out.append(frame)
    finally:
        cap.release()
    return out


def classify_segment(
    video_path: str | Path,
    start_frame: int,
    end_frame: int,
    max_samples: int = 14,
) -> AnglePrediction:
    frames = sample_segment_frames(video_path, start_frame, end_frame, max_samples=max_samples)
    return classify_angle_from_frames(frames)
