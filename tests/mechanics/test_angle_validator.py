"""Tests for src.mechanics.angle_validator."""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest.angle_classify import AnglePrediction
from src.mechanics.angle_validator import (
    OPEN_SIDE_MIN_CONFIDENCE,
    ValidationResult,
    validate_open_side_from_frames,
)


def _make_prediction(angle_class: str, confidence: float) -> AnglePrediction:
    return AnglePrediction(
        angle_class=angle_class,
        confidence=confidence,
        cues=["test"],
        features={"green_ratio": 0.2},
    )


class TestValidateOpenSideFromFrames:
    """Unit tests using frame-based validation (no video file needed)."""

    def test_empty_frames_returns_invalid(self):
        result = validate_open_side_from_frames([], hand="R")
        assert not result.valid
        assert result.confidence == 0.0
        assert result.reject_reason is not None

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_correct_open_side_rhp_passes(self, mock_classify):
        mock_classify.return_value = _make_prediction("open_side_RHP", 0.85)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="R")
        assert result.valid
        assert result.confidence == 0.85
        assert result.reject_reason is None

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_correct_open_side_lhp_passes(self, mock_classify):
        mock_classify.return_value = _make_prediction("open_side_LHP", 0.80)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="L")
        assert result.valid
        assert result.confidence == 0.80

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_wrong_angle_class_fails(self, mock_classify):
        mock_classify.return_value = _make_prediction("behind_home", 0.90)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="R")
        assert not result.valid
        assert "behind_home" in result.reject_reason

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_wrong_hand_open_side_fails(self, mock_classify):
        mock_classify.return_value = _make_prediction("open_side_LHP", 0.85)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="R")
        assert not result.valid
        assert "open_side_LHP" in result.reject_reason

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_low_confidence_fails(self, mock_classify):
        mock_classify.return_value = _make_prediction("open_side_RHP", 0.55)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="R")
        assert not result.valid
        assert "confidence" in result.reject_reason.lower()

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_custom_min_confidence(self, mock_classify):
        mock_classify.return_value = _make_prediction("open_side_RHP", 0.55)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        # With lowered threshold, this should pass.
        result = validate_open_side_from_frames(frames, hand="R", min_confidence=0.50)
        assert result.valid

    @patch("src.mechanics.angle_validator.classify_angle_from_frames")
    def test_unknown_class_fails(self, mock_classify):
        mock_classify.return_value = _make_prediction("unknown", 0.30)
        frames = [np.zeros((180, 320, 3), dtype=np.uint8)] * 5
        result = validate_open_side_from_frames(frames, hand="R")
        assert not result.valid

    def test_to_dict_valid(self):
        r = ValidationResult(valid=True, confidence=0.85, angle_class="open_side_RHP")
        d = r.to_dict()
        assert d["valid"] is True
        assert d["confidence"] == 0.85
        assert "reject_reason" not in d

    def test_to_dict_invalid(self):
        r = ValidationResult(
            valid=False, confidence=0.3, angle_class="behind_home",
            reject_reason="Wrong angle",
        )
        d = r.to_dict()
        assert d["valid"] is False
        assert d["reject_reason"] == "Wrong angle"
