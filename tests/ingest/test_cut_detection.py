from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest.cut_detection import detect_cut_frames, detect_segments_from_frames, shot_scores_from_frames


def _solid_frame(color_bgr: tuple[int, int, int], w: int = 320, h: int = 180) -> np.ndarray:
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:, :] = np.array(color_bgr, dtype=np.uint8)
    return frame


def test_cut_detection_finds_hard_color_transitions():
    frames: list[np.ndarray] = []
    frames.extend([_solid_frame((10, 180, 10)) for _ in range(30)])
    frames.extend([_solid_frame((30, 60, 200)) for _ in range(30)])
    frames.extend([_solid_frame((200, 200, 30)) for _ in range(30)])

    scores = shot_scores_from_frames(frames)
    cuts = detect_cut_frames(scores, min_cut_gap_frames=5)
    assert len(cuts) >= 2
    assert any(abs(c - 30) <= 2 for c in cuts)
    assert any(abs(c - 60) <= 2 for c in cuts)


def test_segments_from_frames_returns_expected_boundaries():
    fps = 30.0
    frames: list[np.ndarray] = []
    frames.extend([_solid_frame((10, 160, 20)) for _ in range(24)])
    frames.extend([_solid_frame((60, 70, 200)) for _ in range(26)])
    frames.extend([_solid_frame((210, 210, 30)) for _ in range(25)])

    segments = detect_segments_from_frames(frames, fps=fps, min_segment_s=0.5)
    assert len(segments) == 3
    assert segments[0].start_frame == 0
    assert abs(segments[1].start_frame - 24) <= 2
    assert abs(segments[2].start_frame - 50) <= 2
    assert segments[-1].end_frame == len(frames) - 1

