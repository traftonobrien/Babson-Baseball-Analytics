"""
Tests for src/mechanics/pose.py.

No real video required — tests operate on synthetic PoseResult objects.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.pose import PoseResult, KP, NUM_LANDMARKS, draw_skeleton


def _make_pose(fill: float = 0.6, frame_idx: int = 0,
               width: int = 1920, height: int = 1080) -> PoseResult:
    """PoseResult where every landmark has x=fill, y=fill, visibility=fill."""
    lm = np.full((NUM_LANDMARKS, 3), fill, dtype=np.float32)
    return PoseResult(frame_idx=frame_idx, landmarks=lm, width=width, height=height)


def _make_nan_pose(frame_idx: int = 0) -> PoseResult:
    lm = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)
    return PoseResult(frame_idx=frame_idx, landmarks=lm, width=1920, height=1080)


class TestKpIndex:
    def test_all_indices_in_range(self):
        for name, idx in KP.items():
            assert 0 <= idx < NUM_LANDMARKS, f"{name}: index {idx} out of [0, {NUM_LANDMARKS})"

    def test_no_duplicate_indices(self):
        vals = list(KP.values())
        assert len(vals) == len(set(vals)), "Duplicate keypoint indices in KP dict"

    def test_num_landmarks_constant(self):
        assert NUM_LANDMARKS == 33


class TestPoseResultPixel:
    def test_center_normalized_maps_to_center_pixels(self):
        pose = _make_pose(fill=0.5, width=1920, height=1080)
        x, y = pose.pixel("LEFT_HIP")
        assert abs(x - 960.0) < 1.0
        assert abs(y - 540.0) < 1.0

    def test_zero_normalized_maps_to_origin(self):
        pose = _make_pose(fill=0.0, width=1280, height=720)
        x, y = pose.pixel("RIGHT_KNEE")
        assert abs(x) < 1e-6
        assert abs(y) < 1e-6

    def test_one_normalized_maps_to_full_size(self):
        lm = np.zeros((NUM_LANDMARKS, 3), dtype=np.float32)
        lm[:, 0] = 1.0
        lm[:, 1] = 1.0
        lm[:, 2] = 1.0
        pose = PoseResult(frame_idx=0, landmarks=lm, width=640, height=480)
        x, y = pose.pixel("LEFT_ANKLE")
        assert abs(x - 640.0) < 1.0
        assert abs(y - 480.0) < 1.0


class TestPoseResultVisibility:
    def test_returns_correct_value(self):
        pose = _make_pose(fill=0.75)
        assert abs(pose.visibility("LEFT_HIP") - 0.75) < 1e-4

    def test_nan_pose_visibility_is_nan(self):
        pose = _make_nan_pose()
        assert np.isnan(pose.visibility("LEFT_HIP"))


class TestPoseResultValid:
    def test_valid_with_real_landmarks(self):
        assert _make_pose().valid is True

    def test_not_valid_with_all_nan(self):
        assert _make_nan_pose().valid is False


class TestPoseResultShape:
    def test_landmarks_shape(self):
        pose = _make_pose()
        assert pose.landmarks.shape == (NUM_LANDMARKS, 3)

    def test_landmarks_dtype(self):
        pose = _make_pose()
        assert pose.landmarks.dtype == np.float32


class TestDrawSkeleton:
    def test_returns_same_shape(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        pose = _make_pose(fill=0.8, width=640, height=480)
        out = draw_skeleton(frame, pose)
        assert out.shape == frame.shape

    def test_does_not_modify_input(self):
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        original = frame.copy()
        pose = _make_pose(fill=0.8, width=640, height=480)
        draw_skeleton(frame, pose)
        np.testing.assert_array_equal(frame, original)

    def test_nan_pose_returns_copy_of_frame(self):
        frame = np.full((480, 640, 3), 42, dtype=np.uint8)
        pose = _make_nan_pose()
        out = draw_skeleton(frame, pose)
        np.testing.assert_array_equal(out, frame)
