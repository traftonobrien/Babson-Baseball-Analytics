"""
Unit tests for stride length benchmark metric.

All tests use synthetic data — no real video or MediaPipe model required.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.pose import PoseResult, KP, NUM_LANDMARKS
from src.mechanics.phases import PitchPhases, Phase
from src.mechanics.benchmarks import (
    _compute_stride_length,
    linear_score,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_lm(vis: float = 0.9) -> np.ndarray:
    lm = np.zeros((NUM_LANDMARKS, 3), dtype=np.float32)
    lm[:, 0] = 0.5
    lm[:, 1] = 0.5
    lm[:, 2] = vis
    return lm


def _make_pose(
    frame_idx: int = 0,
    lm: np.ndarray | None = None,
    width: int = 1280,
    height: int = 720,
) -> PoseResult:
    if lm is None:
        lm = _base_lm()
    return PoseResult(frame_idx=frame_idx, landmarks=lm.copy(), width=width, height=height)


def _make_phase(name: str, frame_idx: int, fps: float = 30.0) -> Phase:
    return Phase(name=name, frame_idx=frame_idx, time_s=frame_idx / fps, confidence=0.9)


def _make_phases(
    set_idx: int = 0,
    fs_idx: int = 30,
    fps: float = 30.0,
) -> PitchPhases:
    return PitchPhases(
        set_pos=_make_phase("set", set_idx, fps),
        first_movement=_make_phase("first_movement", 5, fps),
        peak_leg_lift=_make_phase("peak_leg_lift", 18, fps),
        most_loaded=None,
        foot_strike=_make_phase("foot_strike", fs_idx, fps),
        weight_bearing=None,
        arm_flip_up=None,
        ball_release=_make_phase("ball_release", 45, fps),
        fps=fps,
    )


def _pose_with_ankles_and_body(
    frame_idx: int,
    lead_ankle_norm: tuple[float, float],
    drive_ankle_norm: tuple[float, float],
    nose_norm: tuple[float, float] = (0.5, 0.1),
    hip_left_norm: tuple[float, float] = (0.45, 0.55),
    hip_right_norm: tuple[float, float] = (0.55, 0.55),
    width: int = 1000,
    height: int = 1000,
    vis: float = 0.9,
) -> PoseResult:
    """Create a pose with specific ankle, nose, and hip positions."""
    lm = _base_lm(vis)
    # LEFT_ANKLE (for RHP = lead)
    lm[KP["LEFT_ANKLE"]] = [lead_ankle_norm[0], lead_ankle_norm[1], vis]
    # RIGHT_ANKLE (for RHP = drive)
    lm[KP["RIGHT_ANKLE"]] = [drive_ankle_norm[0], drive_ankle_norm[1], vis]
    # NOSE for body height
    lm[KP["NOSE"]] = [nose_norm[0], nose_norm[1], vis]
    # Hips for midline
    lm[KP["LEFT_HIP"]] = [hip_left_norm[0], hip_left_norm[1], vis]
    lm[KP["RIGHT_HIP"]] = [hip_right_norm[0], hip_right_norm[1], vis]
    return PoseResult(frame_idx=frame_idx, landmarks=lm, width=width, height=height)


# ---------------------------------------------------------------------------
# Tests: basic stride computation
# ---------------------------------------------------------------------------

class TestStrideLength:
    def test_basic_stride_px(self):
        """Stride distance in pixels when no height is given."""
        # Lead ankle at (200, 800), drive ankle at (800, 800) in 1000x1000
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(0.2, 0.8),
            drive_ankle_norm=(0.8, 0.8),
        )
        poses = [fs_pose]
        phases = _make_phases(fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.unit == "px"
        # pixel distance = sqrt((800-200)^2 + 0^2) = 600
        assert abs(result.raw_value - 600.0) < 1.0
        assert result.sub_values["stride_px"] == pytest.approx(600.0, abs=1.0)

    def test_stride_with_height_inches(self):
        """Stride conversion to inches when player height is known."""
        # Body height proxy: nose at y=100, ankle midpoint at y=800 → 700px body height
        # Player is 74" (6'2")
        # stride px = 600, scale = 74 / 700, stride_in = 600 * 74/700 ≈ 63.4"
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(0.2, 0.8),
            drive_ankle_norm=(0.8, 0.8),
            nose_norm=(0.5, 0.1),  # nose at y=100
        )
        poses = [fs_pose]
        phases = _make_phases(fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R", player_height_inches=74.0)
        assert result.status == "ok"
        assert result.unit == "in"
        # Body height proxy ~ nose(100) to ankle_mid(800) = 700px
        # stride_in = 600 * (74/700) ≈ 63.4
        assert 60.0 < result.raw_value < 70.0
        assert result.sub_values.get("stride_inches") is not None

    def test_pct_height(self):
        """Stride as percentage of body height."""
        # Nose at y=100, ankles at y=800 → body_height=700px
        # Stride = 600px → 600/700 * 100 ≈ 85.7%
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(0.2, 0.8),
            drive_ankle_norm=(0.8, 0.8),
            nose_norm=(0.5, 0.1),
        )
        poses = [fs_pose]
        phases = _make_phases(fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.sub_values.get("pct_height") is not None
        pct = result.sub_values["pct_height"]
        assert 80.0 < pct < 92.0  # ~85.7%

    def test_lhp_swaps_ankles(self):
        """For LHP, lead ankle = RIGHT_ANKLE, drive = LEFT_ANKLE."""
        lm = _base_lm()
        # For LHP: lead=RIGHT_ANKLE, drive=LEFT_ANKLE
        lm[KP["RIGHT_ANKLE"]] = [0.2, 0.8, 0.9]
        lm[KP["LEFT_ANKLE"]] = [0.8, 0.8, 0.9]
        lm[KP["NOSE"]] = [0.5, 0.1, 0.9]
        fs_pose = PoseResult(frame_idx=30, landmarks=lm, width=1000, height=1000)
        poses = [fs_pose]
        phases = _make_phases(fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="L")
        assert result.status == "ok"
        assert result.sub_values["stride_px"] == pytest.approx(600.0, abs=1.0)


# ---------------------------------------------------------------------------
# Tests: scoring
# ---------------------------------------------------------------------------

class TestStrideLengthScoring:
    def test_optimal_stride_scores_high(self):
        """85% of body height should score near 10."""
        # Body height = 700px, stride = 85% * 700 = 595px
        stride_frac = 0.85
        nose_y = 0.1
        ankle_y = 0.8
        body_h_px = (ankle_y - nose_y) * 1000  # 700
        stride_px = stride_frac * body_h_px  # 595
        # Position ankles stride_px apart horizontally
        lead_x = 0.5 - (stride_px / 2) / 1000
        drive_x = 0.5 + (stride_px / 2) / 1000
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(lead_x, ankle_y),
            drive_ankle_norm=(drive_x, ankle_y),
            nose_norm=(0.5, nose_y),
        )
        # Also need a SET pose for direction
        set_pose = _pose_with_ankles_and_body(0, (0.5, 0.8), (0.5, 0.8), nose_norm=(0.5, nose_y))
        poses = [set_pose, fs_pose]
        phases = _make_phases(set_idx=0, fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        assert result.score >= 8.0, f"85% stride should score high, got {result.score}"

    def test_short_stride_scores_low(self):
        """60% of body height should score poorly."""
        stride_frac = 0.60
        nose_y = 0.1
        ankle_y = 0.8
        body_h_px = (ankle_y - nose_y) * 1000
        stride_px = stride_frac * body_h_px
        lead_x = 0.5 - (stride_px / 2) / 1000
        drive_x = 0.5 + (stride_px / 2) / 1000
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(lead_x, ankle_y),
            drive_ankle_norm=(drive_x, ankle_y),
            nose_norm=(0.5, nose_y),
        )
        set_pose = _pose_with_ankles_and_body(0, (0.5, 0.8), (0.5, 0.8), nose_norm=(0.5, nose_y))
        poses = [set_pose, fs_pose]
        phases = _make_phases(set_idx=0, fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        # Length score for 60% should be 3.0 (below 65%)
        assert result.sub_values.get("length_score") is not None
        assert result.sub_values["length_score"] <= 4.0

    def test_overstride_penalized(self):
        """>100% of body height gets overstride penalty."""
        stride_frac = 1.05
        nose_y = 0.1
        ankle_y = 0.8
        body_h_px = (ankle_y - nose_y) * 1000
        stride_px = stride_frac * body_h_px
        lead_x = 0.5 - (stride_px / 2) / 1000
        drive_x = 0.5 + (stride_px / 2) / 1000
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(lead_x, ankle_y),
            drive_ankle_norm=(drive_x, ankle_y),
            nose_norm=(0.5, nose_y),
        )
        set_pose = _pose_with_ankles_and_body(0, (0.5, 0.8), (0.5, 0.8), nose_norm=(0.5, nose_y))
        poses = [set_pose, fs_pose]
        phases = _make_phases(set_idx=0, fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values.get("length_score") is not None
        # At 105%, past the 100% threshold → score 5.0
        assert result.sub_values["length_score"] <= 5.5


# ---------------------------------------------------------------------------
# Tests: direction
# ---------------------------------------------------------------------------

class TestStrideDirection:
    def test_straight_stride_no_offset(self):
        """Stride aligned with midline → direction ~0°."""
        # SET pose: hips at center
        set_pose = _pose_with_ankles_and_body(
            0,
            lead_ankle_norm=(0.5, 0.8),
            drive_ankle_norm=(0.5, 0.8),
            hip_left_norm=(0.45, 0.55),
            hip_right_norm=(0.55, 0.55),
        )
        # FS pose: hips moved forward (in image, that's upward = -y)
        # Ankles spread along same direction as hip movement
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(0.5, 0.6),
            drive_ankle_norm=(0.5, 0.9),
            hip_left_norm=(0.45, 0.45),
            hip_right_norm=(0.55, 0.45),
        )
        poses = [set_pose, fs_pose]
        phases = _make_phases(set_idx=0, fs_idx=30)
        result = _compute_stride_length(poses, phases, hand="R")
        if result.sub_values.get("direction_deg") is not None:
            assert abs(result.sub_values["direction_deg"]) < 15.0

    def test_direction_score_small_angle(self):
        """Small direction offset should score high."""
        # 1° offset should give direction_score ≈ 10
        score = linear_score(1.0, 2.0, 10.0, 10.0, 3.0)
        assert score >= 9.5


# ---------------------------------------------------------------------------
# Tests: edge cases
# ---------------------------------------------------------------------------

class TestStrideEdgeCases:
    def test_missing_foot_strike(self):
        """No foot strike → insufficient_data."""
        poses = [_make_pose(0)]
        phases = PitchPhases(
            set_pos=_make_phase("set", 0),
            first_movement=None,
            peak_leg_lift=None,
            most_loaded=None,
            foot_strike=None,
            weight_bearing=None,
            arm_flip_up=None,
            ball_release=None,
            fps=30.0,
        )
        result = _compute_stride_length(poses, phases, hand="R")
        assert result.status == "insufficient_data"

    def test_missing_ankles(self):
        """Low-vis ankles → insufficient_data."""
        lm = _base_lm(vis=0.9)
        lm[KP["LEFT_ANKLE"]] = [0.5, 0.5, 0.05]  # below threshold
        lm[KP["RIGHT_ANKLE"]] = [0.5, 0.5, 0.05]
        pose = PoseResult(frame_idx=30, landmarks=lm, width=1000, height=1000)
        phases = _make_phases(fs_idx=30)
        result = _compute_stride_length([pose], phases, hand="R")
        assert result.status == "insufficient_data"

    def test_no_set_phase_still_computes_length(self):
        """Missing SET → direction not computed, but length still works."""
        fs_pose = _pose_with_ankles_and_body(
            30,
            lead_ankle_norm=(0.2, 0.8),
            drive_ankle_norm=(0.8, 0.8),
        )
        phases = PitchPhases(
            set_pos=None,
            first_movement=None,
            peak_leg_lift=None,
            most_loaded=None,
            foot_strike=_make_phase("foot_strike", 30),
            weight_bearing=None,
            arm_flip_up=None,
            ball_release=None,
            fps=30.0,
        )
        result = _compute_stride_length([fs_pose], phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values.get("direction_deg") is None
        assert result.sub_values["stride_px"] > 0

    def test_no_height_gives_px_unit(self):
        """No player height → unit is px."""
        fs_pose = _pose_with_ankles_and_body(30, (0.2, 0.8), (0.8, 0.8))
        result = _compute_stride_length([fs_pose], _make_phases(fs_idx=30), hand="R")
        assert result.unit == "px"

    def test_with_height_gives_in_unit(self):
        """Player height provided → unit is in."""
        fs_pose = _pose_with_ankles_and_body(30, (0.2, 0.8), (0.8, 0.8))
        result = _compute_stride_length(
            [fs_pose], _make_phases(fs_idx=30), hand="R", player_height_inches=74.0,
        )
        assert result.unit == "in"
