from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest.angle_classify import classify_angle_from_frames


def _blank_field(w: int = 320, h: int = 180, green: tuple[int, int, int] = (35, 145, 40)) -> np.ndarray:
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    frame[:, :] = np.array(green, dtype=np.uint8)
    return frame


def _behind_home_frames(n: int = 10) -> list[np.ndarray]:
    out: list[np.ndarray] = []
    for i in range(n):
        f = _blank_field()
        h, w = f.shape[:2]
        cv2.rectangle(f, (0, int(h * 0.68)), (w - 1, h - 1), (60, 90, 150), -1)  # dirt near plate
        cv2.rectangle(f, (int(w * 0.46), int(h * 0.78)), (int(w * 0.54), int(h * 0.95)), (18, 18, 18), -1)  # catcher/ump blob
        # Slight flicker so motion isn't exactly zero.
        cv2.circle(f, (w // 2, int(h * 0.58)), 4 + (i % 2), (70, 120, 180), -1)
        out.append(f)
    return out


def _behind_center_frames(n: int = 10) -> list[np.ndarray]:
    out: list[np.ndarray] = []
    for i in range(n):
        f = _blank_field(green=(40, 155, 50))
        h, w = f.shape[:2]
        cv2.circle(f, (w // 2, int(h * 0.55)), 14, (70, 110, 170), -1)  # mound dirt
        cv2.rectangle(f, (int(w * 0.48), int(h * 0.62)), (int(w * 0.52), int(h * 0.67)), (250, 250, 250), -1)
        if i % 3 == 0:
            cv2.circle(f, (w // 2, int(h * 0.55)), 2, (255, 255, 255), -1)
        out.append(f)
    return out


def _open_side_frames(left_motion: bool, n: int = 10) -> list[np.ndarray]:
    out: list[np.ndarray] = []
    for i in range(n):
        f = _blank_field(green=(32, 120, 36))
        h, w = f.shape[:2]
        # Asymmetric dirt lane.
        if left_motion:
            cv2.rectangle(f, (int(w * 0.05), int(h * 0.45)), (int(w * 0.45), h - 1), (60, 90, 145), -1)
            x = int(w * 0.22) + (i % 5) * 4
        else:
            cv2.rectangle(f, (int(w * 0.55), int(h * 0.45)), (w - 1, h - 1), (60, 90, 145), -1)
            x = int(w * 0.78) - (i % 5) * 4
        # Pitcher blob moving mostly horizontally.
        cv2.rectangle(f, (x - 10, int(h * 0.28)), (x + 10, int(h * 0.58)), (245, 245, 245), -1)
        out.append(f)
    return out


def test_classifier_detects_behind_home():
    pred = classify_angle_from_frames(_behind_home_frames())
    assert pred.angle_class == "behind_home"
    assert pred.confidence >= 0.45


def test_classifier_detects_behind_center():
    pred = classify_angle_from_frames(_behind_center_frames())
    assert pred.angle_class == "behind_center"
    assert pred.confidence >= 0.40


def test_classifier_detects_open_side_rhp():
    pred = classify_angle_from_frames(_open_side_frames(left_motion=True))
    assert pred.angle_class == "open_side_RHP"
    assert pred.confidence >= 0.40


def test_classifier_detects_open_side_lhp():
    pred = classify_angle_from_frames(_open_side_frames(left_motion=False))
    assert pred.angle_class == "open_side_LHP"
    assert pred.confidence >= 0.40

