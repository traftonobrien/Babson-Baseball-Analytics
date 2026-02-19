"""
Utility functions for mechanics analysis.

Drawing helpers, path slugification, and output directory management.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np

try:
    from scipy.signal import savgol_filter as _sg_filter  # type: ignore
except Exception:  # pragma: no cover - exercised by tests without scipy
    _sg_filter = None


def slugify(text: str) -> str:
    """
    Convert a human-readable name to a filesystem-safe slug.

    Examples:
        'Jason Finkelstein'  → 'jason_finkelstein'
        'Pitch Test.mp4'     → 'pitch_test'
        'My Clip (1)'        → 'my_clip_1'
    """
    text = Path(text).stem  # strip extension if present
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = text.strip("_")
    return text


def make_output_dir(base: str | Path, player_name: str, clip_name: str) -> Path:
    """
    Create and return output/<player_slug>/<clip_slug>/.

    Args:
        base:        Root output directory (e.g. "output/mechanics").
        player_name: Raw player/folder name (e.g. "Jason Finkelstein").
        clip_name:   Raw clip name (e.g. "Pitch Test.mp4" or "Pitch Test").
    """
    d = Path(base) / slugify(player_name) / slugify(clip_name)
    d.mkdir(parents=True, exist_ok=True)
    return d


def add_text_overlay(
    frame: np.ndarray,
    text: str,
    pos: tuple[int, int] = (10, 30),
    scale: float = 0.7,
    color: tuple = (0, 255, 0),
    thickness: int = 2,
    bg: bool = True,
) -> np.ndarray:
    """
    Draw text on a copy of frame with an optional dark background rectangle.

    The background rectangle makes text readable on any image content.
    Returns a new array; does not modify the input.
    """
    out = frame.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)
    x, y = pos

    if bg:
        pad = 3
        cv2.rectangle(
            out,
            (x - pad, y - th - pad),
            (x + tw + pad, y + baseline + pad),
            (0, 0, 0),
            -1,
        )

    cv2.putText(out, text, (x, y), font, scale, color, thickness, cv2.LINE_AA)
    return out


def phase_color(phase_name: str) -> tuple[int, int, int]:
    """BGR color for each phase name (used in report images)."""
    return {
        "set":             (200, 200, 200),   # light gray
        "first_movement":  (0,   200, 255),   # yellow
        "peak_leg_lift":   (0,   255,   0),   # green
        "foot_strike":     (0,   165, 255),   # orange
        "ball_release":    (0,     0, 255),   # red
    }.get(phase_name, (255, 255, 255))


def smooth_series(
    values: Iterable[float],
    window: int = 7,
    polyorder: int = 2,
) -> np.ndarray:
    """
    Smooth a 1D numeric series with optional Savitzky-Golay.

    Uses Savitzky-Golay when scipy is available, otherwise a moving average.
    NaNs are linearly interpolated for filtering then restored after smoothing.
    """
    raw = np.asarray(list(values), dtype=np.float64)
    if raw.size == 0:
        return raw.copy()

    valid = ~np.isnan(raw)
    if not np.any(valid):
        return np.full_like(raw, np.nan, dtype=np.float64)

    x = np.arange(raw.size, dtype=np.float64)
    filled = np.interp(x, x[valid], raw[valid])

    win = max(3, int(window))
    if win % 2 == 0:
        win += 1
    if win > raw.size:
        win = raw.size if raw.size % 2 == 1 else raw.size - 1
    if win < 3:
        out = filled.copy()
    elif _sg_filter is not None and win > polyorder:
        out = _sg_filter(filled, window_length=win, polyorder=min(polyorder, win - 1), mode="interp")
    else:
        kernel = np.ones(win, dtype=np.float64) / float(win)
        pad = win // 2
        padded = np.pad(filled, (pad, pad), mode="edge")
        out = np.convolve(padded, kernel, mode="valid")

    out = out.astype(np.float64, copy=False)
    out[~valid] = np.nan
    return out


def smoothing_residual_std(
    raw_values: Iterable[float],
    smoothed_values: Iterable[float],
) -> float:
    """Std dev of residual (raw - smoothed) on finite points."""
    raw = np.asarray(list(raw_values), dtype=np.float64)
    smooth = np.asarray(list(smoothed_values), dtype=np.float64)
    if raw.size == 0 or smooth.size == 0:
        return 0.0
    n = min(raw.size, smooth.size)
    raw = raw[:n]
    smooth = smooth[:n]
    valid = ~np.isnan(raw) & ~np.isnan(smooth)
    if np.count_nonzero(valid) < 3:
        return 0.0
    resid = raw[valid] - smooth[valid]
    return float(np.std(resid))
