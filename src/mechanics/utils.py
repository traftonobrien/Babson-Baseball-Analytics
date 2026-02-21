"""
Utility functions for mechanics analysis.

Drawing helpers, path slugification, and output directory management.
"""
from __future__ import annotations

import dataclasses
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


@dataclasses.dataclass
class WindowCleanResult:
    """Result of window_clean outlier removal."""
    values: np.ndarray      # cleaned values (NaN where dropped)
    kept_mask: np.ndarray   # bool mask of kept frames
    jitter_score: float     # 0..1, lower is better
    kept_count: int
    dropped_count: int


def window_clean(
    series: Iterable[float],
    radius: int = 3,
    center: int | None = None,
    mad_k: float = 3.0,
    top_pct: float = 0.15,
) -> WindowCleanResult:
    """
    Universal outlier rescue: remove spike frames from a windowed series.

    Steps:
      1. Collect frames within ±radius of center (or entire series if center=None).
      2. Compute per-frame jump magnitude (absolute first differences).
      3. Compute median + MAD of jumps.
      4. Drop frames with jump > median + mad_k * MAD.
      5. Also drop the top top_pct largest jumps (catches systematic noise).
      6. Return cleaned series with jitter score.

    Args:
        series:   1D numeric values (may contain NaN).
        radius:   Half-window size around center.
        center:   Center index (default: middle of series).
        mad_k:    MAD multiplier for outlier threshold.
        top_pct:  Fraction of largest jumps to additionally drop.

    Returns:
        WindowCleanResult with cleaned values and diagnostics.
    """
    raw = np.asarray(list(series), dtype=np.float64)
    n = raw.size
    if n == 0:
        return WindowCleanResult(
            values=raw.copy(), kept_mask=np.zeros(0, dtype=bool),
            jitter_score=1.0, kept_count=0, dropped_count=0,
        )

    # Windowing
    if center is None:
        center = n // 2
    lo = max(0, center - radius)
    hi = min(n, center + radius + 1)
    window_mask = np.zeros(n, dtype=bool)
    window_mask[lo:hi] = True

    # Work only on the window, but preserve full array
    out = raw.copy()
    kept = np.ones(n, dtype=bool)

    # Compute jumps within window
    win_indices = np.where(window_mask & ~np.isnan(raw))[0]
    if len(win_indices) < 3:
        return WindowCleanResult(
            values=out, kept_mask=kept,
            jitter_score=0.5, kept_count=int(len(win_indices)), dropped_count=0,
        )

    # Frame-to-frame jump magnitudes
    win_vals = raw[win_indices]
    jumps = np.abs(np.diff(win_vals))

    if jumps.size == 0:
        return WindowCleanResult(
            values=out, kept_mask=kept,
            jitter_score=0.0, kept_count=int(len(win_indices)), dropped_count=0,
        )

    # MAD-based threshold
    med_jump = float(np.median(jumps))
    mad_jump = float(np.median(np.abs(jumps - med_jump)))
    # Use a minimum MAD proportional to median to avoid flagging mild variation.
    # A jump of 2-3x the median is normal; only flag truly anomalous spikes.
    effective_mad = max(mad_jump, med_jump * 0.5, 1e-9)
    threshold = med_jump + mad_k * effective_mad

    # Mark frames whose incoming or outgoing jump exceeds threshold
    bad_by_mad = set()
    for i, j in enumerate(jumps):
        if j > threshold:
            # Mark the frame that moved (the second frame in the pair)
            bad_by_mad.add(int(win_indices[i + 1]))

    # Top-percentile largest jumps — only flag if clearly anomalous
    n_top = max(1, int(np.ceil(top_pct * len(jumps))))
    top_indices = np.argsort(jumps)[-n_top:]
    bad_by_top = set()
    # Require jump to be at least 2x median + 2*MAD to avoid false positives
    top_floor = med_jump * 2.0 + mad_jump * 2.0
    for idx in top_indices:
        if jumps[idx] > top_floor:
            bad_by_top.add(int(win_indices[idx + 1]))

    bad_frames = bad_by_mad | bad_by_top

    # Don't drop more than half the window
    max_drop = max(1, len(win_indices) // 2)
    if len(bad_frames) > max_drop:
        # Keep only the worst max_drop
        all_jumps_for_frame = {}
        for i, j in enumerate(jumps):
            fi = int(win_indices[i + 1])
            all_jumps_for_frame[fi] = max(all_jumps_for_frame.get(fi, 0.0), float(j))
        sorted_bad = sorted(bad_frames, key=lambda f: all_jumps_for_frame.get(f, 0.0), reverse=True)
        bad_frames = set(sorted_bad[:max_drop])

    for fi in bad_frames:
        out[fi] = np.nan
        kept[fi] = False

    # Jitter score: fraction of jumps exceeding threshold (lower is better)
    n_over = sum(1 for j in jumps if j > threshold)
    jitter_score = min(1.0, n_over / max(1, len(jumps)))

    return WindowCleanResult(
        values=out,
        kept_mask=kept,
        jitter_score=jitter_score,
        kept_count=int(kept[window_mask].sum()),
        dropped_count=int(len(bad_frames)),
    )


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
