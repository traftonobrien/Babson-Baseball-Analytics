"""
Shot-boundary detection for multi-angle ingest.

Uses a simple weighted score:
  - HSV histogram distance (global color/layout shift)
  - Edge-change ratio (structural shift)
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np

from src.mechanics.video_io import read_video_meta


@dataclasses.dataclass
class DetectedSegment:
    start_frame: int
    end_frame: int
    start_s: float
    end_s: float

    @property
    def duration_s(self) -> float:
        return max(0.0, self.end_s - self.start_s)


def _hist_signature(frame: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1, 2], None, [16, 16, 8], [0, 180, 0, 256, 0, 256])
    hist = cv2.normalize(hist, hist).flatten()
    return hist


def _hist_diff(prev: np.ndarray, curr: np.ndarray) -> float:
    h1 = _hist_signature(prev)
    h2 = _hist_signature(curr)
    # Bhattacharyya distance in [0,1] for normalized histograms.
    return float(cv2.compareHist(h1.astype(np.float32), h2.astype(np.float32), cv2.HISTCMP_BHATTACHARYYA))


def _edge_change_ratio(prev: np.ndarray, curr: np.ndarray) -> float:
    prev_g = cv2.cvtColor(prev, cv2.COLOR_BGR2GRAY)
    curr_g = cv2.cvtColor(curr, cv2.COLOR_BGR2GRAY)
    e1 = cv2.Canny(prev_g, 90, 180)
    e2 = cv2.Canny(curr_g, 90, 180)
    diff = cv2.absdiff(e1, e2)
    changed = float(np.count_nonzero(diff))
    total = max(1.0, float(np.count_nonzero(e1 | e2)))
    return changed / total


def _smooth_1d(values: np.ndarray, window: int = 5) -> np.ndarray:
    if values.size == 0:
        return values
    w = max(1, int(window))
    if w % 2 == 0:
        w += 1
    if w == 1 or values.size < 3:
        return values.copy()
    pad = w // 2
    padded = np.pad(values, (pad, pad), mode="edge")
    kernel = np.ones(w, dtype=np.float64) / float(w)
    return np.convolve(padded, kernel, mode="valid")


def shot_scores_from_frames(frames: Iterable[np.ndarray]) -> np.ndarray:
    """Per-frame cut score, first frame = 0."""
    scores: list[float] = []
    prev: np.ndarray | None = None
    for frame in frames:
        if prev is None:
            scores.append(0.0)
            prev = frame
            continue
        hist = _hist_diff(prev, frame)
        ecr = _edge_change_ratio(prev, frame)
        score = 0.72 * hist + 0.28 * min(1.0, ecr)
        scores.append(float(score))
        prev = frame
    if not scores:
        return np.zeros((0,), dtype=np.float64)
    raw = np.asarray(scores, dtype=np.float64)
    return _smooth_1d(raw, window=5)


def detect_cut_frames(
    scores: np.ndarray,
    min_cut_gap_frames: int = 8,
) -> list[int]:
    """
    Return frame indices where a new shot starts.

    Frame i is considered a cut when score[i] is a local maximum and exceeds
    a robust threshold derived from median + MAD.
    """
    if scores.size < 3:
        return []
    arr = np.asarray(scores, dtype=np.float64)
    core = arr[1:]
    med = float(np.median(core))
    mad = float(np.median(np.abs(core - med)))
    threshold = max(med + 4.0 * mad, med + 0.05, 0.10)

    cuts: list[int] = []
    last_cut = -10_000
    for i in range(1, len(arr) - 1):
        s = float(arr[i])
        if s < threshold:
            continue
        if not (s >= arr[i - 1] and s >= arr[i + 1]):
            continue
        if i - last_cut < min_cut_gap_frames:
            # Keep stronger of the two nearby maxima.
            if cuts and s > arr[cuts[-1]]:
                cuts[-1] = i
                last_cut = i
            continue
        cuts.append(i)
        last_cut = i
    return cuts


def _segments_from_cuts(
    total_frames: int,
    fps: float,
    cut_frames: list[int],
    min_segment_s: float,
) -> list[DetectedSegment]:
    if total_frames <= 0:
        return []
    min_frames = max(1, int(round(min_segment_s * fps)))
    # Filter cuts that would create tiny segments.
    kept: list[int] = []
    seg_start = 0
    for cut in sorted(cut_frames):
        if cut <= seg_start:
            continue
        if (cut - seg_start) < min_frames:
            continue
        if (total_frames - cut) < min_frames:
            continue
        kept.append(cut)
        seg_start = cut

    bounds = [0] + kept + [total_frames]
    segments: list[DetectedSegment] = []
    for i in range(len(bounds) - 1):
        start = bounds[i]
        end_exclusive = bounds[i + 1]
        if end_exclusive <= start:
            continue
        end = end_exclusive - 1
        segments.append(
            DetectedSegment(
                start_frame=int(start),
                end_frame=int(end),
                start_s=float(start) / max(fps, 1e-6),
                end_s=float(end + 1) / max(fps, 1e-6),
            )
        )
    return segments


def detect_segments_from_frames(
    frames: list[np.ndarray],
    fps: float,
    min_segment_s: float = 0.9,
) -> list[DetectedSegment]:
    scores = shot_scores_from_frames(frames)
    cuts = detect_cut_frames(scores)
    return _segments_from_cuts(len(frames), fps=fps, cut_frames=cuts, min_segment_s=min_segment_s)


def detect_segments(
    video_path: str | Path,
    min_segment_s: float = 0.9,
    sample_step: int = 1,
) -> list[DetectedSegment]:
    """
    Shot detection directly from video file.

    sample_step can be increased for speed on very long videos.
    """
    path = Path(video_path)
    meta = read_video_meta(path)
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")

    try:
        prev: np.ndarray | None = None
        sampled_scores: list[float] = []
        sampled_frames: list[int] = []
        frame_idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if sample_step > 1 and (frame_idx % sample_step) != 0:
                frame_idx += 1
                continue
            if prev is None:
                sampled_scores.append(0.0)
                sampled_frames.append(frame_idx)
                prev = frame
                frame_idx += 1
                continue
            hist = _hist_diff(prev, frame)
            ecr = _edge_change_ratio(prev, frame)
            sampled_scores.append(0.72 * hist + 0.28 * min(1.0, ecr))
            sampled_frames.append(frame_idx)
            prev = frame
            frame_idx += 1
    finally:
        cap.release()

    if not sampled_scores:
        return []

    smooth_scores = _smooth_1d(np.asarray(sampled_scores, dtype=np.float64), window=5)
    sampled_cut_idx = detect_cut_frames(smooth_scores, min_cut_gap_frames=max(3, int(8 / max(sample_step, 1))))
    real_cuts = [int(sampled_frames[i]) for i in sampled_cut_idx if 0 <= i < len(sampled_frames)]
    return _segments_from_cuts(
        total_frames=meta.frame_count,
        fps=meta.fps,
        cut_frames=real_cuts,
        min_segment_s=min_segment_s,
    )
