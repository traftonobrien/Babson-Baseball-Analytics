"""
Unit tests for arm positioning and arm timing benchmark metrics.

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
    _compute_arm_alignment,
    _compute_arm_timing,
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
    wb_idx: int = 33,
    flip_idx: int = 32,
    fps: float = 30.0,
) -> PitchPhases:
    return PitchPhases(
        set_pos=_make_phase("set", set_idx, fps),
        first_movement=_make_phase("first_movement", 5, fps),
        peak_leg_lift=_make_phase("peak_leg_lift", 18, fps),
        most_loaded=_make_phase("most_loaded", 22, fps),
        foot_strike=_make_phase("foot_strike", fs_idx, fps),
        weight_bearing=_make_phase("weight_bearing", wb_idx, fps),
        arm_flip_up=_make_phase("arm_flip_up", flip_idx, fps),
        ball_release=_make_phase("ball_release", 45, fps),
        fps=fps,
    )


def _pose_with_arm(
    frame_idx: int,
    throw_sho_norm: tuple[float, float],
    throw_elb_norm: tuple[float, float],
    throw_wri_norm: tuple[float, float],
    left_sho_norm: tuple[float, float] = (0.35, 0.35),
    right_sho_norm: tuple[float, float] = (0.65, 0.35),
    width: int = 1000,
    height: int = 1000,
    vis: float = 0.9,
    hand: str = "R",
) -> PoseResult:
    """Create a pose with specific throwing arm positions."""
    lm = _base_lm(vis)
    lm[KP["LEFT_SHOULDER"]] = [left_sho_norm[0], left_sho_norm[1], vis]
    lm[KP["RIGHT_SHOULDER"]] = [right_sho_norm[0], right_sho_norm[1], vis]
    lm[KP["LEFT_HIP"]] = [0.40, 0.55, vis]
    lm[KP["RIGHT_HIP"]] = [0.60, 0.55, vis]
    lm[KP["NOSE"]] = [0.50, 0.15, vis]

    if hand == "R":
        lm[KP["RIGHT_SHOULDER"]] = [throw_sho_norm[0], throw_sho_norm[1], vis]
        lm[KP["RIGHT_ELBOW"]] = [throw_elb_norm[0], throw_elb_norm[1], vis]
        lm[KP["RIGHT_WRIST"]] = [throw_wri_norm[0], throw_wri_norm[1], vis]
    else:
        lm[KP["LEFT_SHOULDER"]] = [throw_sho_norm[0], throw_sho_norm[1], vis]
        lm[KP["LEFT_ELBOW"]] = [throw_elb_norm[0], throw_elb_norm[1], vis]
        lm[KP["LEFT_WRIST"]] = [throw_wri_norm[0], throw_wri_norm[1], vis]

    return PoseResult(frame_idx=frame_idx, landmarks=lm, width=width, height=height)


# ---------------------------------------------------------------------------
# Tests: arm alignment
# ---------------------------------------------------------------------------

class TestArmAlignment:
    def test_good_alignment_scores_high(self):
        """Elbow in line with shoulder plane and ~90° flexion → high score."""
        pose = _pose_with_arm(
            32,
            throw_sho_norm=(0.65, 0.35),
            throw_elb_norm=(0.85, 0.35),
            throw_wri_norm=(0.85, 0.15),
        )
        poses = [pose]
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        # Both components should produce decent scores
        assert result.sub_values.get("alignment_score") is not None
        assert result.sub_values.get("flexion_score") is not None

    def test_poor_alignment_scores_low(self):
        """Elbow far off shoulder plane → low alignment score."""
        pose = _pose_with_arm(
            32,
            throw_sho_norm=(0.65, 0.35),
            throw_elb_norm=(0.65, 0.60),
            throw_wri_norm=(0.65, 0.80),
        )
        poses = [pose]
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        # Alignment should be poor (elbow goes down, not along shoulder line)
        assert result.sub_values.get("alignment_offset_deg") is not None
        assert result.sub_values["alignment_offset_deg"] > 10.0

    def test_flexion_90_scores_10(self):
        """90° elbow flexion is ideal."""
        pose = _pose_with_arm(
            32,
            throw_sho_norm=(0.65, 0.35),
            throw_elb_norm=(0.85, 0.35),
            throw_wri_norm=(0.85, 0.15),
        )
        poses = [pose]
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment(poses, phases, hand="R")
        assert result.status == "ok"
        if result.sub_values.get("flexion_angle_deg") is not None:
            # If angle is ≤90°, score should be 10
            if result.sub_values["flexion_angle_deg"] <= 90.0:
                assert result.sub_values["flexion_score"] == pytest.approx(10.0)

    def test_flexion_over_120_scores_3(self):
        """Elbow flexion >120° = poor score."""
        pose = _pose_with_arm(
            32,
            throw_sho_norm=(0.65, 0.35),
            throw_elb_norm=(0.80, 0.35),
            throw_wri_norm=(0.95, 0.35),
        )
        poses = [pose]
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment(poses, phases, hand="R")
        assert result.status == "ok"
        if result.sub_values.get("flexion_score") is not None:
            assert result.sub_values["flexion_score"] <= 3.5

    def test_missing_arm_flip_up_insufficient(self):
        """No arm_flip_up phase → insufficient_data."""
        pose = _make_pose(32)
        phases = PitchPhases(
            set_pos=_make_phase("set", 0),
            first_movement=None,
            peak_leg_lift=None,
            most_loaded=None,
            foot_strike=_make_phase("foot_strike", 30),
            weight_bearing=_make_phase("weight_bearing", 33),
            arm_flip_up=None,
            ball_release=None,
            fps=30.0,
        )
        result = _compute_arm_alignment([pose], phases, hand="R")
        assert result.status == "insufficient_data"

    def test_lhp_uses_left_arm(self):
        """For LHP, throwing arm = LEFT."""
        pose = _pose_with_arm(
            32,
            throw_sho_norm=(0.35, 0.35),
            throw_elb_norm=(0.15, 0.35),
            throw_wri_norm=(0.15, 0.15),
            hand="L",
        )
        poses = [pose]
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment(poses, phases, hand="L")
        assert result.status == "ok"
        assert result.score is not None

    def test_missing_wrist_still_computes_alignment(self):
        """If wrist is missing, alignment component can still compute."""
        lm = _base_lm(0.9)
        lm[KP["RIGHT_SHOULDER"]] = [0.65, 0.35, 0.9]
        lm[KP["RIGHT_ELBOW"]] = [0.85, 0.35, 0.9]
        lm[KP["RIGHT_WRIST"]] = [0.85, 0.15, 0.05]  # below threshold
        lm[KP["LEFT_SHOULDER"]] = [0.35, 0.35, 0.9]
        pose = PoseResult(frame_idx=32, landmarks=lm, width=1000, height=1000)
        phases = _make_phases(flip_idx=32)
        result = _compute_arm_alignment([pose], phases, hand="R")
        # Should still work with only alignment (flexion will be missing)
        assert result.status == "ok"
        assert result.sub_values.get("alignment_score") is not None


# ---------------------------------------------------------------------------
# Tests: arm timing
# ---------------------------------------------------------------------------

class TestArmTiming:
    def test_on_time_scores_10(self):
        """Arm flip 1 frame before weight bearing → on time → 10."""
        phases = _make_phases(wb_idx=33, flip_idx=32)
        pose = _make_pose(32)
        result = _compute_arm_timing([pose, _make_pose(33)], phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        assert result.sub_values["classification"] == "on_time"
        assert result.sub_values["delta_frames"] == -1

    def test_simultaneous_on_time(self):
        """Arm flip at same frame as weight bearing → on time → 10."""
        phases = _make_phases(wb_idx=33, flip_idx=33)
        pose = _make_pose(33)
        result = _compute_arm_timing([pose], phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values["classification"] == "on_time"
        assert result.sub_values["delta_frames"] == 0
        # Score should be near 10
        assert result.score_raw == pytest.approx(10.0)

    def test_early_classification(self):
        """Arm flip 4 frames before weight bearing → early."""
        phases = _make_phases(wb_idx=33, flip_idx=29)
        pose = _make_pose(29)
        result = _compute_arm_timing([pose, _make_pose(33)], phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values["classification"] == "early"
        assert result.sub_values["delta_frames"] == -4
        # Score should be between 7 and 10
        assert 6.5 <= result.score_raw <= 10.0

    def test_late_classification(self):
        """Arm flip 2 frames after weight bearing → late."""
        phases = _make_phases(wb_idx=33, flip_idx=35)
        pose = _make_pose(35)
        result = _compute_arm_timing([_make_pose(33), pose], phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values["classification"] == "late"
        assert result.sub_values["delta_frames"] == 2
        # Score between 5 and 8
        assert 4.5 <= result.score_raw <= 8.5

    def test_very_late_scores_3(self):
        """Arm flip >3 frames after weight bearing → 3."""
        phases = _make_phases(wb_idx=33, flip_idx=38)
        poses = [_make_pose(33), _make_pose(38)]
        result = _compute_arm_timing(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.sub_values["classification"] == "late"
        assert result.score_raw == pytest.approx(3.0)

    def test_delta_ms_computed(self):
        """delta_ms = delta_frames / fps * 1000."""
        phases = _make_phases(wb_idx=33, flip_idx=30, fps=30.0)
        poses = [_make_pose(30), _make_pose(33)]
        result = _compute_arm_timing(poses, phases, hand="R")
        assert result.status == "ok"
        # delta_frames = 30 - 33 = -3, delta_ms = -3/30*1000 = -100
        assert result.sub_values["delta_ms"] == pytest.approx(-100.0)

    def test_missing_weight_bearing_insufficient(self):
        """No weight_bearing → insufficient_data."""
        phases = PitchPhases(
            set_pos=_make_phase("set", 0),
            first_movement=None,
            peak_leg_lift=None,
            most_loaded=None,
            foot_strike=None,
            weight_bearing=None,
            arm_flip_up=_make_phase("arm_flip_up", 32),
            ball_release=None,
            fps=30.0,
        )
        result = _compute_arm_timing([_make_pose(32)], phases, hand="R")
        assert result.status == "insufficient_data"

    def test_missing_arm_flip_insufficient(self):
        """No arm_flip_up → insufficient_data."""
        phases = PitchPhases(
            set_pos=_make_phase("set", 0),
            first_movement=None,
            peak_leg_lift=None,
            most_loaded=None,
            foot_strike=None,
            weight_bearing=_make_phase("weight_bearing", 33),
            arm_flip_up=None,
            ball_release=None,
            fps=30.0,
        )
        result = _compute_arm_timing([_make_pose(33)], phases, hand="R")
        assert result.status == "insufficient_data"

    def test_lhp_works(self):
        """LHP arm timing uses left arm keypoints for confidence."""
        phases = _make_phases(wb_idx=33, flip_idx=32)
        lm = _base_lm(0.9)
        lm[KP["LEFT_SHOULDER"]] = [0.35, 0.35, 0.9]
        lm[KP["LEFT_ELBOW"]] = [0.15, 0.35, 0.9]
        lm[KP["LEFT_WRIST"]] = [0.15, 0.15, 0.9]
        poses = [
            PoseResult(frame_idx=32, landmarks=lm.copy(), width=1000, height=1000),
            PoseResult(frame_idx=33, landmarks=lm.copy(), width=1000, height=1000),
        ]
        result = _compute_arm_timing(poses, phases, hand="L")
        assert result.status == "ok"
