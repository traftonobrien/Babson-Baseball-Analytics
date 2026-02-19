from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest.pitch_split import detect_pitch_windows_from_energy, motion_energy_from_frames


def _make_motion_frames(
    n: int,
    bursts: list[tuple[int, int]],
    w: int = 320,
    h: int = 180,
) -> list[np.ndarray]:
    frames: list[np.ndarray] = []
    for i in range(n):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        frame[:, :] = (20, 20, 20)
        # Static mound-ish patch.
        cv2.circle(frame, (w // 2, int(h * 0.58)), 18, (55, 90, 140), -1)
        moving = False
        for lo, hi in bursts:
            if lo <= i <= hi:
                moving = True
                break
        if moving:
            x = int(w * 0.25) + ((i - lo) % 14) * 6
            cv2.rectangle(frame, (x, int(h * 0.28)), (x + 24, int(h * 0.62)), (245, 245, 245), -1)
        else:
            cv2.rectangle(frame, (int(w * 0.25), int(h * 0.28)), (int(w * 0.25) + 24, int(h * 0.62)), (235, 235, 235), -1)
        frames.append(frame)
    return frames


def test_pitch_split_detects_two_motion_bursts():
    fps = 30.0
    frames = _make_motion_frames(
        n=180,
        bursts=[(40, 55), (105, 121)],
    )
    energy = motion_energy_from_frames(frames)
    windows = detect_pitch_windows_from_energy(
        energy,
        fps=fps,
        min_pitch_s=1.0,
        max_pitch_s=4.5,
        pad_pre_s=0.75,
        pad_post_s=0.75,
    )
    assert len(windows) >= 2
    starts = [w.start_frame for w in windows[:2]]
    assert starts[0] < 40
    assert starts[1] < 105
    for w in windows[:2]:
        dur_s = (w.end_frame - w.start_frame + 1) / fps
        assert 1.0 <= dur_s <= 4.5
        assert w.confidence >= 0.2


def test_pitch_split_fallback_returns_window_when_motion_is_weak():
    fps = 30.0
    frames = _make_motion_frames(
        n=90,
        bursts=[(38, 42)],
    )
    # Flatten energy to near-constant weak signal.
    energy = np.full((len(frames),), 0.01, dtype=np.float64)
    energy[40] = 0.03
    windows = detect_pitch_windows_from_energy(
        energy,
        fps=fps,
        min_pitch_s=1.0,
        max_pitch_s=3.5,
    )
    assert len(windows) == 1
    win = windows[0]
    assert win.start_frame < win.end_frame
    assert win.release_frame is not None

