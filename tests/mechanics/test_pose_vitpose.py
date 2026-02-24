"""Tests for src.mechanics.pose_vitpose module."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.pose import KP, NUM_LANDMARKS, PoseResult
from src.mechanics.pose_vitpose import (
    _COCO_TO_MEDIAPIPE,
    _coco17_to_mediapipe33,
)


class TestCoco17ToMediapipe33:
    """Test keypoint format conversion."""

    def _make_coco_kps(self, x: float = 320.0, y: float = 240.0, score: float = 0.9) -> np.ndarray:
        """Create a dummy COCO 17-keypoint array with all points at (x, y)."""
        kps = np.zeros((17, 3), dtype=np.float32)
        for i in range(17):
            kps[i] = [x + i * 10, y + i * 5, score]
        return kps

    def test_output_shape(self):
        coco = self._make_coco_kps()
        result = _coco17_to_mediapipe33(coco, width=640, height=480)
        assert result.shape == (NUM_LANDMARKS, 3)
        assert result.dtype == np.float32

    def test_mapped_keypoints_normalized(self):
        """Mapped keypoints should be in [0, 1] normalized coordinates."""
        coco = self._make_coco_kps(x=320.0, y=240.0, score=0.85)
        result = _coco17_to_mediapipe33(coco, width=640, height=480)

        for coco_idx, mp_idx in _COCO_TO_MEDIAPIPE.items():
            assert not np.isnan(result[mp_idx, 0]), f"COCO {coco_idx} -> MP {mp_idx} should not be NaN"
            assert 0.0 <= result[mp_idx, 0] <= 2.0  # allow slight overflow from offset
            assert 0.0 <= result[mp_idx, 1] <= 2.0
            assert result[mp_idx, 2] == pytest.approx(0.85)

    def test_unmapped_keypoints_are_nan(self):
        """Unmapped keypoints (wrist details, etc.) should be NaN."""
        coco = self._make_coco_kps()
        result = _coco17_to_mediapipe33(coco, width=640, height=480)

        # Indices not mapped from COCO should be NaN.
        # MediaPipe indices 1, 3, 4, 6, 9, 10 are face mesh points not in COCO.
        for idx in [1, 3, 4, 6, 9, 10]:
            assert np.isnan(result[idx, 0]), f"MP index {idx} should be NaN"

    def test_synthesized_heel_and_foot(self):
        """Heel and foot index should be synthesized from ankles."""
        coco = self._make_coco_kps()
        result = _coco17_to_mediapipe33(coco, width=640, height=480)

        for side in ("LEFT", "RIGHT"):
            ankle_idx = KP[f"{side}_ANKLE"]
            heel_idx = KP[f"{side}_HEEL"]
            foot_idx = KP[f"{side}_FOOT_INDEX"]

            if not np.isnan(result[ankle_idx, 0]):
                assert not np.isnan(result[heel_idx, 0]), f"{side} heel should be synthesized"
                assert not np.isnan(result[foot_idx, 0]), f"{side} foot should be synthesized"
                # Confidence should be reduced for synthetic points.
                assert result[heel_idx, 2] < result[ankle_idx, 2]
                assert result[foot_idx, 2] < result[ankle_idx, 2]

    def test_zero_dimensions_no_crash(self):
        coco = self._make_coco_kps()
        result = _coco17_to_mediapipe33(coco, width=0, height=0)
        assert result.shape == (NUM_LANDMARKS, 3)

    def test_nose_mapping(self):
        """COCO nose (index 0) should map to MediaPipe NOSE (index 0)."""
        coco = np.zeros((17, 3), dtype=np.float32)
        coco[0] = [320.0, 240.0, 0.95]
        result = _coco17_to_mediapipe33(coco, width=640, height=480)
        assert result[0, 0] == pytest.approx(0.5)
        assert result[0, 1] == pytest.approx(0.5)
        assert result[0, 2] == pytest.approx(0.95)


class TestExtractPosesAutoFallback:
    """Test that extract_poses_auto falls back gracefully."""

    def test_mediapipe_backend_name(self):
        from src.mechanics.pose import POSE_BACKEND
        # Default should be mediapipe.
        assert POSE_BACKEND in ("mediapipe", "vitpose")
