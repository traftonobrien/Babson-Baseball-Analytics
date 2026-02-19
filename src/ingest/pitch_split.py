"""
Pitch-window detection inside a single angle segment.

Primary signal is frame-to-frame motion energy, designed to work without
audio and without requiring pose extraction.
"""
from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

from src.mechanics.video_io import read_video_meta


@dataclasses.dataclass
class PitchWindow:
    start_frame: int
    end_frame: int
    set_frame: Optional[int]
    release_frame: Optional[int]
    confidence: float
    peak_energy: float

    @property
    def duration_frames(self) -> int:
        return max(0, self.end_frame - self.start_frame + 1)


def _smooth(values: np.ndarray, window: int) -> np.ndarray:
    if values.size == 0:
        return values
    w = max(1, int(window))
    if w % 2 == 0:
        w += 1
    if w <= 1:
        return values.copy()
    pad = w // 2
    padded = np.pad(values, (pad, pad), mode="edge")
    kernel = np.ones(w, dtype=np.float64) / float(w)
    return np.convolve(padded, kernel, mode="valid")


def motion_energy_from_frames(frames: list[np.ndarray]) -> np.ndarray:
    """
    Normalized motion energy from frame differencing.

    Values are in [0,1]-ish and robust enough for burst detection.
    """
    if not frames:
        return np.zeros((0,), dtype=np.float64)
    energy = np.zeros((len(frames),), dtype=np.float64)
    prev_gray = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    prev_gray = cv2.GaussianBlur(prev_gray, (5, 5), 0)

    for i in range(1, len(frames)):
        gray = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (5, 5), 0)
        diff = cv2.absdiff(gray, prev_gray)
        # Keep meaningful motion, suppress tiny sensor flicker.
        _, th = cv2.threshold(diff, 12, 255, cv2.THRESH_BINARY)
        energy[i] = float(np.mean(th) / 255.0)
        prev_gray = gray
    return _smooth(energy, window=5)


def detect_pitch_windows_from_energy(
    energy: np.ndarray,
    fps: float,
    min_pitch_s: float = 1.3,
    max_pitch_s: float = 6.0,
    pad_pre_s: float = 0.75,
    pad_post_s: float = 0.75,
) -> list[PitchWindow]:
    if energy.size == 0:
        return []
    fps = max(float(fps), 1e-6)
    smooth = _smooth(np.asarray(energy, dtype=np.float64), window=max(3, int(round(0.20 * fps))))
    base = float(np.percentile(smooth, 25))
    p90 = float(np.percentile(smooth, 90))
    span = max(1e-6, p90 - base)
    thr_hi = base + 0.45 * span
    thr_lo = base + 0.25 * span

    active = smooth >= thr_hi
    n = len(smooth)
    # Fill small holes so one frame dip does not split a pitch.
    gap_max = max(1, int(round(0.20 * fps)))
    i = 0
    while i < n:
        if active[i]:
            i += 1
            continue
        j = i
        while j < n and not active[j]:
            j += 1
        if i > 0 and j < n and (j - i) <= gap_max:
            active[i:j] = True
        i = j

    runs: list[tuple[int, int]] = []
    i = 0
    while i < n:
        if not active[i]:
            i += 1
            continue
        j = i
        while j + 1 < n and active[j + 1]:
            j += 1
        runs.append((i, j))
        i = j + 1

    # Expand runs using lower threshold for cleaner boundaries.
    expanded: list[tuple[int, int]] = []
    for a, b in runs:
        lo = a
        hi = b
        while lo > 0 and smooth[lo - 1] >= thr_lo:
            lo -= 1
        while hi + 1 < n and smooth[hi + 1] >= thr_lo:
            hi += 1
        expanded.append((lo, hi))

    # Merge runs separated by tiny pauses.
    merged: list[tuple[int, int]] = []
    merge_gap = max(1, int(round(0.25 * fps)))
    for lo, hi in expanded:
        if not merged:
            merged.append((lo, hi))
            continue
        plo, phi = merged[-1]
        if lo - phi <= merge_gap:
            merged[-1] = (plo, max(phi, hi))
        else:
            merged.append((lo, hi))

    min_clip_frames = max(1, int(round(min_pitch_s * fps)))
    max_clip_frames = max(min_clip_frames, int(round(max_pitch_s * fps)))
    pre = int(round(pad_pre_s * fps))
    post = int(round(pad_post_s * fps))

    windows: list[PitchWindow] = []
    for lo, hi in merged:
        peak_local = int(np.argmax(smooth[lo : hi + 1])) + lo
        set_frame = lo
        release_frame = peak_local
        clip_start = max(0, set_frame - pre)
        clip_end = min(n - 1, max(hi, release_frame) + post)

        if (clip_end - clip_start + 1) < min_clip_frames:
            clip_end = min(n - 1, clip_start + min_clip_frames - 1)
        if (clip_end - clip_start + 1) > max_clip_frames:
            center = release_frame
            half = max_clip_frames // 2
            clip_start = max(0, center - half)
            clip_end = min(n - 1, clip_start + max_clip_frames - 1)

        peak = float(smooth[peak_local])
        confidence = max(0.0, min(1.0, (peak - base) / (span + 1e-6)))
        windows.append(
            PitchWindow(
                start_frame=int(clip_start),
                end_frame=int(clip_end),
                set_frame=int(set_frame),
                release_frame=int(release_frame),
                confidence=float(confidence),
                peak_energy=float(peak),
            )
        )

    if windows:
        return windows

    # Fallback: one clip around global energy peak.
    peak = int(np.argmax(smooth))
    width = min(max_clip_frames, max(min_clip_frames, int(round(2.3 * fps))))
    start = max(0, peak - width // 2)
    end = min(n - 1, start + width - 1)
    if (end - start + 1) < min_clip_frames:
        end = min(n - 1, start + min_clip_frames - 1)
    conf = max(0.1, min(0.6, (float(smooth[peak]) - base) / (span + 1e-6)))
    return [
        PitchWindow(
            start_frame=int(start),
            end_frame=int(end),
            set_frame=None,
            release_frame=int(peak),
            confidence=float(conf),
            peak_energy=float(smooth[peak]),
        )
    ]


def detect_pitch_windows_in_segment(
    video_path: str | Path,
    segment_start_frame: int,
    segment_end_frame: int,
    fps: float,
    min_pitch_s: float = 1.3,
    max_pitch_s: float = 6.0,
) -> tuple[list[PitchWindow], np.ndarray]:
    path = Path(video_path)
    meta = read_video_meta(path)
    lo = max(0, int(segment_start_frame))
    hi = min(meta.frame_count - 1, int(segment_end_frame))
    if hi < lo:
        return [], np.zeros((0,), dtype=np.float64)

    frames: list[np.ndarray] = []
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {path}")
    try:
        cap.set(cv2.CAP_PROP_POS_FRAMES, lo)
        for _ in range(lo, hi + 1):
            ok, frame = cap.read()
            if not ok:
                break
            frames.append(frame)
    finally:
        cap.release()

    energy = motion_energy_from_frames(frames)
    local_windows = detect_pitch_windows_from_energy(
        energy,
        fps=fps,
        min_pitch_s=min_pitch_s,
        max_pitch_s=max_pitch_s,
    )
    global_windows: list[PitchWindow] = []
    for win in local_windows:
        global_windows.append(
            PitchWindow(
                start_frame=lo + win.start_frame,
                end_frame=lo + win.end_frame,
                set_frame=(lo + win.set_frame) if win.set_frame is not None else None,
                release_frame=(lo + win.release_frame) if win.release_frame is not None else None,
                confidence=win.confidence,
                peak_energy=win.peak_energy,
            )
        )
    return global_windows, energy

