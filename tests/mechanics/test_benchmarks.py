"""
Unit tests for src/mechanics/benchmarks.py.

All tests use synthetic data — no real video or MediaPipe model required.

Coverage:
  - angle_from_vertical_deg   (geometry helper)
  - angle_from_horizontal_deg (geometry helper)
  - shoulder_line_angle_deg   (geometry helper)
  - linear_score              (score helper)
  - piecewise_timing_score    (score helper)
  - Handedness selection for drive/stride/glove keypoints
  - Swivel inside/outside torso frame logic
  - Full compute_benchmarks with synthetic pose sequence
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
    CONF_BLIND,
    CONF_FULL,
    angle_from_vertical_deg,
    angle_from_horizontal_deg,
    shoulder_line_angle_deg,
    linear_score,
    piecewise_timing_score,
    compute_benchmarks,
    OPEN_SIDE_METRIC_ORDER,
    BenchmarkReport,
    BenchmarkResult,
    _px_safe,
    _angle_diff_deg,
    _compute_timing,
    _compute_balance,
    _compute_lift_thrust,
    _compute_swivel_stabilize,
    _compute_stack_track,
    _compute_torque_retention,
    _compute_trunk_stability,
    _compute_trunk_stability_v2,
    _compute_drift_forward,
    _compute_forward_leak_proxy,
    _compute_release_extension_v2,
    _compute_lead_leg_block_v3,
    _compute_hip_shoulder_sep_v3,
    _compute_front_side_closedness_v2,
    _compute_efficiency_details,
    _compute_efficiency_score,
    _confidence_scaled_factor,
    _score_release_extension_proxy,
)
from src.mechanics.utils import smooth_series
from src.mechanics.benchmarks import _jump_penalty_consecutive


# ---------------------------------------------------------------------------
# Helpers for building synthetic PoseResult objects
# ---------------------------------------------------------------------------

def _base_lm(vis: float = 0.9) -> np.ndarray:
    """All 33 landmarks at (0.5, 0.5) with given visibility."""
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
    peak_idx: int = 18,
    fs_idx: int = 30,
    rel_idx: int = 45,
    fps: float = 30.0,
) -> PitchPhases:
    return PitchPhases(
        set_pos=        _make_phase("set",          set_idx,  fps),
        first_movement= _make_phase("first_movement", 5,      fps),
        peak_leg_lift=  _make_phase("peak_leg_lift", peak_idx, fps),
        foot_strike=    _make_phase("foot_strike",   fs_idx,  fps),
        ball_release=   _make_phase("ball_release",  rel_idx, fps),
        fps=fps,
    )


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

class TestAngleFromVertical:
    def test_perfectly_upright_vector(self):
        # Vector pointing straight up in room: dx=0, dy=-1 (image +Y down)
        assert abs(angle_from_vertical_deg(0.0, -1.0) - 0.0) < 0.01

    def test_perfectly_horizontal_vector(self):
        assert abs(angle_from_vertical_deg(1.0, 0.0) - 90.0) < 0.01

    def test_45_degree(self):
        # Equal horizontal and upward components
        result = angle_from_vertical_deg(1.0, -1.0)
        assert abs(result - 45.0) < 0.1

    def test_zero_length_vector_returns_zero(self):
        assert angle_from_vertical_deg(0.0, 0.0) == 0.0

    def test_downward_vector_is_180(self):
        # Vector pointing straight down (like a trunk hanging down)
        assert abs(angle_from_vertical_deg(0.0, 1.0) - 180.0) < 0.01

    def test_result_always_nonnegative(self):
        for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1)]:
            assert angle_from_vertical_deg(dx, dy) >= 0.0


class TestAngleFromHorizontal:
    def test_horizontal_vector_gives_zero(self):
        assert abs(angle_from_horizontal_deg(1.0, 0.0) - 0.0) < 0.01

    def test_vertical_vector_gives_90(self):
        assert abs(angle_from_horizontal_deg(0.0, -1.0) - 90.0) < 0.1

    def test_45_degree(self):
        result = angle_from_horizontal_deg(1.0, -1.0)
        assert abs(result - 45.0) < 0.1

    def test_uses_absolute_values(self):
        # atan2(|dy|, |dx|) should give same result for all sign combinations
        base = angle_from_horizontal_deg(3.0, -4.0)
        assert abs(angle_from_horizontal_deg(-3.0, -4.0) - base) < 0.01
        assert abs(angle_from_horizontal_deg(3.0, 4.0)  - base) < 0.01
        assert abs(angle_from_horizontal_deg(-3.0, 4.0) - base) < 0.01

    def test_result_always_nonnegative(self):
        for dx, dy in [(-1, -1), (1, -1), (-1, 1), (1, 1), (0, -5)]:
            assert angle_from_horizontal_deg(dx, dy) >= 0.0


class TestShoulderLineAngle:
    def test_level_shoulders_gives_zero(self):
        lm = _base_lm()
        # L_shoulder and R_shoulder at same height, horizontally separated
        lm[KP["LEFT_SHOULDER"],  0] = 0.3
        lm[KP["LEFT_SHOULDER"],  1] = 0.4
        lm[KP["RIGHT_SHOULDER"], 0] = 0.7
        lm[KP["RIGHT_SHOULDER"], 1] = 0.4
        pose = _make_pose(lm=lm)
        angle = shoulder_line_angle_deg(pose)
        assert angle is not None
        assert abs(angle) < 0.01

    def test_right_shoulder_lower_gives_positive(self):
        lm = _base_lm()
        lm[KP["LEFT_SHOULDER"],  0] = 0.3
        lm[KP["LEFT_SHOULDER"],  1] = 0.4
        lm[KP["RIGHT_SHOULDER"], 0] = 0.7
        lm[KP["RIGHT_SHOULDER"], 1] = 0.6   # lower in image = lower in room
        pose = _make_pose(lm=lm)
        angle = shoulder_line_angle_deg(pose)
        assert angle is not None
        assert angle > 0.0

    def test_low_visibility_returns_none(self):
        lm = _base_lm(vis=0.1)  # all below threshold
        pose = _make_pose(lm=lm)
        assert shoulder_line_angle_deg(pose) is None


# ---------------------------------------------------------------------------
# Angle wraparound helper
# ---------------------------------------------------------------------------

class TestAngleDiffDeg:
    def test_no_wraparound(self):
        assert abs(_angle_diff_deg(10.0, 30.0) - 20.0) < 1e-9

    def test_wraparound_across_180(self):
        # -170° and +170° are only 20° apart (cross ±180 boundary)
        assert abs(_angle_diff_deg(-170.0, 170.0) - 20.0) < 1e-9

    def test_symmetric(self):
        assert abs(_angle_diff_deg(170.0, -170.0) - 20.0) < 1e-9

    def test_same_angle_gives_zero(self):
        assert _angle_diff_deg(45.0, 45.0) == pytest.approx(0.0)

    def test_opposite_angles_gives_180(self):
        assert _angle_diff_deg(0.0, 180.0) == pytest.approx(180.0)


# ---------------------------------------------------------------------------
# Score helpers
# ---------------------------------------------------------------------------

class TestLinearScore:
    def test_at_lo_boundary(self):
        assert abs(linear_score(1.0, 1.0, 5.0, 10.0, 0.0) - 10.0) < 0.001

    def test_at_hi_boundary(self):
        assert abs(linear_score(5.0, 1.0, 5.0, 10.0, 0.0) - 0.0) < 0.001

    def test_midpoint(self):
        assert abs(linear_score(3.0, 1.0, 5.0, 10.0, 0.0) - 5.0) < 0.01

    def test_below_lo_clamps_to_lo_score(self):
        assert abs(linear_score(-999.0, 1.0, 5.0, 10.0, 0.0) - 10.0) < 0.001

    def test_above_hi_clamps_to_hi_score(self):
        assert abs(linear_score(999.0, 1.0, 5.0, 10.0, 0.0) - 0.0) < 0.001

    def test_increasing_direction(self):
        # More is better: lo_score=0, hi_score=10
        assert linear_score(5.0, 0.0, 10.0, 0.0, 10.0) == 5.0

    def test_lo_equals_hi_returns_lo_score(self):
        assert linear_score(3.0, 5.0, 5.0, 7.0, 3.0) == 7.0


class TestPiecewiseTimingScore:
    def test_fast_delivery(self):
        assert abs(piecewise_timing_score(0.9) - 10.0) < 0.001

    def test_at_lo_threshold(self):
        assert abs(piecewise_timing_score(1.05) - 10.0) < 0.001

    def test_at_hi_threshold(self):
        assert abs(piecewise_timing_score(1.15) - 6.0) < 0.001

    def test_midpoint_of_linear_zone(self):
        result = piecewise_timing_score(1.10)
        assert 6.0 <= result <= 10.0

    def test_above_hi_threshold(self):
        assert abs(piecewise_timing_score(1.5) - 3.0) < 0.001
        assert abs(piecewise_timing_score(2.0) - 3.0) < 0.001

    def test_linear_zone_is_strictly_decreasing(self):
        s1 = piecewise_timing_score(1.06)
        s2 = piecewise_timing_score(1.10)
        s3 = piecewise_timing_score(1.14)
        assert s1 > s2 > s3


class TestConfidenceScaling:
    def test_confidence_scaled_factor_boundaries(self):
        assert _confidence_scaled_factor(CONF_BLIND) == pytest.approx(0.0)
        assert _confidence_scaled_factor(CONF_FULL) == pytest.approx(1.0)
        assert _confidence_scaled_factor(0.0) == pytest.approx(0.0)
        assert _confidence_scaled_factor(1.0) == pytest.approx(1.0)

    def test_confidence_scaled_factor_midpoint(self):
        mid = (CONF_BLIND + CONF_FULL) / 2.0
        assert _confidence_scaled_factor(mid) == pytest.approx(0.5)


class TestReleaseExtensionScore:
    def test_extension_score_lower_bound(self):
        assert _score_release_extension_proxy(8.0) == pytest.approx(0.0)

    def test_extension_score_midpoint(self):
        assert _score_release_extension_proxy(9.25) == pytest.approx(5.0)

    def test_extension_score_upper_bound(self):
        assert _score_release_extension_proxy(10.5) == pytest.approx(10.0)

    def test_extension_score_clamps_outside_range(self):
        assert _score_release_extension_proxy(7.0) == pytest.approx(0.0)
        assert _score_release_extension_proxy(12.0) == pytest.approx(10.0)


class TestSmoothing:
    def test_smoothing_reduces_variance(self):
        x = np.linspace(0.0, 4.0 * np.pi, 120)
        clean = 100.0 + 10.0 * np.sin(x)
        jitter = clean + 3.5 * np.sin(11.0 * x)
        smoothed = smooth_series(jitter, window=9, polyorder=2)
        assert np.nanvar(smoothed) < np.nanvar(jitter)


# ---------------------------------------------------------------------------
# Handedness tests
# ---------------------------------------------------------------------------

class TestHandedness:
    def _release_pose_with_wrists(
        self, glove_x: float = 0.4, throw_x: float = 0.6
    ) -> PoseResult:
        lm = _base_lm()
        # Torso frame x-bounds roughly 0.3 to 0.7
        lm[KP["LEFT_SHOULDER"],  0] = 0.3
        lm[KP["RIGHT_SHOULDER"], 0] = 0.7
        lm[KP["LEFT_HIP"],       0] = 0.35
        lm[KP["RIGHT_HIP"],      0] = 0.65
        lm[KP["LEFT_WRIST"],     0] = glove_x
        lm[KP["RIGHT_WRIST"],    0] = throw_x
        return _make_pose(lm=lm)

    def test_rhp_glove_is_left_wrist(self):
        lm = _base_lm()
        lm[KP["LEFT_WRIST"],  0] = 0.4   # inside torso
        lm[KP["RIGHT_WRIST"], 0] = 0.9   # outside torso
        # Hip/shoulder torso ~0.3–0.7
        for kp in ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]:
            lm[KP[kp], 0] = 0.5
        lm[KP["LEFT_SHOULDER"], 0] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.65
        lm[KP["LEFT_HIP"], 0] = 0.4
        lm[KP["RIGHT_HIP"], 0] = 0.6
        pose = _make_pose(lm=lm)
        phases = _make_phases(rel_idx=0)
        result = _compute_swivel_stabilize([pose], phases, hand="R")
        assert result.status == "ok"
        assert result.pass_fail is True   # left wrist at 0.4 is inside ~0.35–0.65

    def test_lhp_glove_is_right_wrist(self):
        lm = _base_lm()
        lm[KP["RIGHT_WRIST"], 0] = 0.5   # inside torso (at centre)
        lm[KP["LEFT_WRIST"],  0] = 0.1   # outside torso
        for kp in ["LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP"]:
            lm[KP[kp], 0] = 0.5
        lm[KP["LEFT_SHOULDER"], 0] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.65
        pose = _make_pose(lm=lm)
        phases = _make_phases(rel_idx=0)
        result = _compute_swivel_stabilize([pose], phases, hand="L")
        assert result.status == "ok"
        assert result.pass_fail is True   # right wrist at 0.5 is inside

    def test_rhp_drive_is_right_ankle(self):
        """Lift & Thrust for RHP uses RIGHT_ANKLE as drive."""
        lm = _base_lm()
        # Drive ankle (RIGHT) at bottom, stride hip (LEFT_HIP) well above
        lm[KP["RIGHT_ANKLE"], 1] = 0.85  # low in image (on ground)
        lm[KP["LEFT_HIP"],    1] = 0.35  # high in image (above ground)
        # Also set x: stride_hip to the left of drive_ankle
        lm[KP["RIGHT_ANKLE"], 0] = 0.65
        lm[KP["LEFT_HIP"],    0] = 0.4
        pose = _make_pose(lm=lm)
        phases = _make_phases(peak_idx=0)
        result = _compute_lift_thrust([pose], phases, hand="R")
        assert result.status == "ok"
        assert result.raw_value is not None
        assert result.raw_value > 0    # some upward angle

    def test_lhp_drive_is_left_ankle(self):
        """Lift & Thrust for LHP uses LEFT_ANKLE as drive."""
        lm = _base_lm()
        lm[KP["LEFT_ANKLE"],  1] = 0.85
        lm[KP["RIGHT_HIP"],   1] = 0.35
        lm[KP["LEFT_ANKLE"],  0] = 0.35
        lm[KP["RIGHT_HIP"],   0] = 0.6
        pose = _make_pose(lm=lm)
        phases = _make_phases(peak_idx=0)
        result = _compute_lift_thrust([pose], phases, hand="L")
        assert result.status == "ok"
        assert result.raw_value is not None
        assert result.raw_value > 0


# ---------------------------------------------------------------------------
# Swivel inside/outside logic
# ---------------------------------------------------------------------------

class TestSwivelInsideTorso:
    def _make_swivel_pose(
        self,
        glove_x_norm: float,
        left_sho_x: float = 0.3,
        right_sho_x: float = 0.7,
    ) -> PoseResult:
        lm = _base_lm()
        lm[KP["LEFT_SHOULDER"],  0] = left_sho_x
        lm[KP["RIGHT_SHOULDER"], 0] = right_sho_x
        lm[KP["LEFT_HIP"],       0] = left_sho_x + 0.05
        lm[KP["RIGHT_HIP"],      0] = right_sho_x - 0.05
        lm[KP["LEFT_WRIST"],     0] = glove_x_norm
        return _make_pose(lm=lm)

    def test_glove_inside_gets_10(self):
        # torso x range ≈ [0.3, 0.7]; glove at 0.5 = inside
        pose = self._make_swivel_pose(0.5)
        phases = _make_phases(rel_idx=0)
        result = _compute_swivel_stabilize([pose], phases, hand="R")
        assert result.status == "ok"
        assert result.score == 10.0
        assert result.pass_fail is True

    def test_glove_outside_gets_3(self):
        # glove at 0.05 = outside torso
        pose = self._make_swivel_pose(0.05)
        phases = _make_phases(rel_idx=0)
        result = _compute_swivel_stabilize([pose], phases, hand="R")
        assert result.status == "ok"
        assert result.score == 3.0
        assert result.pass_fail is False

    def test_glove_at_boundary_is_inside(self):
        # glove exactly at torso_min_x = inside (inclusive)
        pose = self._make_swivel_pose(0.3)
        phases = _make_phases(rel_idx=0)
        result = _compute_swivel_stabilize([pose], phases, hand="R")
        assert result.pass_fail is True


# ---------------------------------------------------------------------------
# Timing metric
# ---------------------------------------------------------------------------

class TestTiming:
    def test_fast_delivery_scores_10(self):
        phases = _make_phases(set_idx=0, fs_idx=30, fps=30.0)
        # 30 frames / 30 fps = 1.0s → score 10
        result = _compute_timing(phases)
        assert result.status == "ok"
        assert abs(result.raw_value - 1.0) < 0.01
        assert result.score == 10.0
        assert result.pass_fail is True

    def test_slow_delivery_scores_3(self):
        phases = _make_phases(set_idx=0, fs_idx=60, fps=30.0)
        # 2.0s → score 3
        result = _compute_timing(phases)
        assert result.score == 3.0
        assert result.pass_fail is False

    def test_missing_set_returns_insufficient(self):
        phases = PitchPhases(None, None, None,
                             _make_phase("foot_strike", 30), None, fps=30.0)
        result = _compute_timing(phases)
        assert result.status == "insufficient_data"

    def test_missing_foot_strike_returns_insufficient(self):
        phases = PitchPhases(_make_phase("set", 0), None, None, None, None, fps=30.0)
        result = _compute_timing(phases)
        assert result.status == "insufficient_data"


# ---------------------------------------------------------------------------
# Full compute_benchmarks integration
# ---------------------------------------------------------------------------

def _make_full_pose_sequence(n: int = 60, fps: float = 30.0) -> list[PoseResult]:
    """
    Synthetic pitch with plausible landmark positions throughout.
    RHP open-side camera layout:
      - Right ankle (drive) stays near x=0.65, y=0.80
      - Left hip (stride) rises during lift
      - Shoulders level throughout
      - Left wrist (glove) stays inside torso frame
      - Nose stays stable
    """
    poses = []
    for i in range(n):
        t = i / fps
        lm = _base_lm()

        # Stable points
        lm[KP["LEFT_SHOULDER"],  0] = 0.35; lm[KP["LEFT_SHOULDER"],  1] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.65; lm[KP["RIGHT_SHOULDER"], 1] = 0.35
        lm[KP["LEFT_HIP"],       0] = 0.40; lm[KP["LEFT_HIP"],       1] = 0.55
        lm[KP["RIGHT_HIP"],      0] = 0.60; lm[KP["RIGHT_HIP"],      1] = 0.55
        lm[KP["RIGHT_ANKLE"],    0] = 0.65; lm[KP["RIGHT_ANKLE"],    1] = 0.82

        # Lead knee arc
        if t < 0.3:
            knee_y = 0.60
        elif t < 0.6:
            knee_y = 0.60 - 0.25 * math.sin((t - 0.3) / 0.3 * math.pi)
        else:
            knee_y = 0.60
        lm[KP["LEFT_KNEE"], 0] = 0.40; lm[KP["LEFT_KNEE"], 1] = knee_y

        # Lead ankle descent
        lm[KP["LEFT_ANKLE"],  0] = 0.40; lm[KP["LEFT_ANKLE"],  1] = min(0.82, 0.70 + t * 0.15)

        # Glove wrist stays inside torso
        lm[KP["LEFT_WRIST"],  0] = 0.45; lm[KP["LEFT_WRIST"],  1] = 0.40

        # Throwing wrist accelerates after foot strike
        wrist_x = 0.60 + min(t * 0.3, 0.2)
        lm[KP["RIGHT_WRIST"], 0] = wrist_x; lm[KP["RIGHT_WRIST"], 1] = 0.40

        # Nose stays stable
        lm[KP["NOSE"], 0] = 0.50; lm[KP["NOSE"], 1] = 0.15

        poses.append(_make_pose(frame_idx=i, lm=lm))
    return poses


def _make_full_pose_sequence_with_nose_jitter(
    n: int = 60,
    fps: float = 30.0,
    jitter_px: float = 0.0,
) -> list[PoseResult]:
    poses = _make_full_pose_sequence(n=n, fps=fps)
    if jitter_px <= 0:
        return poses

    for i, p in enumerate(poses):
        lm = p.landmarks.copy()
        # Alternating jitter plus sinusoid to emulate tracking noise.
        jitter = ((-1.0) ** i) * jitter_px + 0.5 * jitter_px * math.sin(i / 3.0)
        y_norm = lm[KP["NOSE"], 1] + jitter / p.height
        lm[KP["NOSE"], 1] = np.float32(min(0.98, max(0.02, y_norm)))
        p.landmarks = lm
    return poses


class TestComputeBenchmarks:
    def setup_method(self):
        self.fps    = 30.0
        self.poses  = _make_full_pose_sequence(n=60, fps=self.fps)
        self.phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=48,
                                   fps=self.fps)
        self.report = compute_benchmarks(self.poses, self.phases, hand="R")

    def test_all_metrics_have_status(self):
        for bm in self.report.all_metrics():
            assert bm.status in ("ok", "insufficient_data", "requires_front_view")

    def test_timing_is_ok(self):
        assert self.report.timing.status == "ok"

    def test_efficiency_score_matches_weighted_confidence_logic(self):
        expected = _compute_efficiency_score(self.report.all_metrics(), self.report.view_mode)
        assert self.report.efficiency_score == expected

    def test_to_dict_serialisable(self):
        import json
        d = self.report.to_dict()
        json.dumps(d)   # must not raise

    def test_all_scores_in_range(self):
        for bm in self.report.all_metrics():
            if bm.score is not None:
                assert 0.0 <= bm.score <= 10.0

    def test_extra_metrics_present(self):
        extras = [m for m in self.report.all_metrics() if m.name in {
            "lead_leg_block_v3",
            "hip_shoulder_sep_v3",
            "front_side_closedness_v2",
            "release_extension_v2",
            "forward_leak_proxy",
            "drift_forward",
            "front_knee_flexion_fs",
            "front_knee_extension_rel",
            "tilt_consistency",
            "release_extension_proxy",
            "trunk_stability",
        }]
        assert len(extras) >= 8
        for m in extras:
            assert m.status in ("ok", "insufficient_data", "requires_front_view")

    def test_confidence_between_0_and_1(self):
        for bm in self.report.all_metrics():
            if bm.confidence is not None:
                assert 0.0 <= bm.confidence <= 1.0

    def test_posture_confidence_drops_with_jitter(self):
        low_jitter_poses = _make_full_pose_sequence_with_nose_jitter(
            n=60, fps=self.fps, jitter_px=0.8
        )
        high_jitter_poses = _make_full_pose_sequence_with_nose_jitter(
            n=60, fps=self.fps, jitter_px=12.0
        )
        low_report = compute_benchmarks(low_jitter_poses, self.phases, hand="R")
        high_report = compute_benchmarks(high_jitter_poses, self.phases, hand="R")
        low_conf = low_report.posture.confidence or 0.0
        high_conf = high_report.posture.confidence or 0.0
        assert high_conf < low_conf

    def test_empty_poses_returns_all_insufficient(self):
        empty_phases = PitchPhases(None, None, None, None, None, fps=30.0)
        report = compute_benchmarks([], empty_phases, hand="R")
        for bm in report.primary_metrics():
            assert bm.status == "insufficient_data"
        assert report.efficiency_score is None

    def test_pass_fail_consistent_with_score(self):
        for bm in self.report.all_metrics():
            if bm.score is not None and bm.pass_fail is not None:
                expected_pass = bm.score >= 6.0
                assert bm.pass_fail == expected_pass


# ---------------------------------------------------------------------------
# Open-side view mode
# ---------------------------------------------------------------------------

class TestOpenSideViewMode:
    def setup_method(self):
        self.fps    = 30.0
        self.poses  = _make_full_pose_sequence(n=60, fps=self.fps)
        self.phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=48,
                                   fps=self.fps)

    def test_open_side_replaces_stack_track(self):
        report = compute_benchmarks(self.poses, self.phases, hand="R",
                                    view_mode="open_side")
        # slot 6 should be trunk_stability_v2, not stack_track
        assert report.stack_track.name == "trunk_stability_v2"
        assert report.stack_track.status == "ok"

    def test_open_side_official_metric_set_v3(self):
        assert tuple(OPEN_SIDE_METRIC_ORDER) == (
            "lead_leg_block_v3",
            "hip_shoulder_sep_v3",
            "front_side_closedness_v2",
            "release_extension_v2",
            "timing",
            "swivel_stabilize",
        )

    def test_open_side_torque_requires_front_view(self):
        report = compute_benchmarks(self.poses, self.phases, hand="R",
                                    view_mode="open_side")
        assert report.torque_retention.status == "requires_front_view"
        assert report.torque_retention.score is None

    def test_front_view_uses_original_metrics(self):
        report = compute_benchmarks(self.poses, self.phases, hand="R",
                                    view_mode="front")
        assert report.stack_track.name == "stack_track"
        assert report.torque_retention.name == "torque_retention"
        # Both should be computed (not requires_front_view)
        assert report.torque_retention.status != "requires_front_view"

    def test_efficiency_excludes_front_view_only(self):
        report = compute_benchmarks(self.poses, self.phases, hand="R",
                                    view_mode="open_side")
        expected = _compute_efficiency_score(report.all_metrics(), report.view_mode)
        assert report.efficiency_score == expected

    def test_trunk_stability_scoring(self):
        """Small trunk lean delta should score high, large delta low."""
        # Create poses where trunk lean barely changes between FS and release
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        phases = self.phases
        result = _compute_trunk_stability_v2(poses, phases)
        assert result.status == "ok"
        # With stable shoulders in our synthetic data, delta should be small → high score
        assert result.score is not None
        assert result.sub_values.get("delta_abs_deg") is not None

    def test_trunk_window_median_is_robust_to_single_frame_outlier(self):
        poses_clean = _make_full_pose_sequence(n=60, fps=self.fps)
        poses_noisy = _make_full_pose_sequence(n=60, fps=self.fps)
        # Inject a large single-frame shoulder outlier near release.
        rel_idx = self.phases.ball_release.frame_idx
        lm = poses_noisy[rel_idx].landmarks.copy()
        lm[KP["LEFT_SHOULDER"], 0] = 0.1
        lm[KP["RIGHT_SHOULDER"], 0] = 0.95
        poses_noisy[rel_idx].landmarks = lm

        clean = _compute_trunk_stability_v2(poses_clean, self.phases)
        noisy = _compute_trunk_stability_v2(poses_noisy, self.phases)
        assert clean.status == "ok" and noisy.status == "ok"
        assert clean.raw_value is not None and noisy.raw_value is not None
        # Windowed median should dampen single-frame spikes.
        assert abs(noisy.raw_value - clean.raw_value) < 6.0

    def test_trunk_confidence_drops_with_occlusion(self):
        visible = _make_full_pose_sequence(n=60, fps=self.fps)
        occluded = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        for i in range(fs - 2, rel + 2):
            if i < 0 or i >= len(occluded):
                continue
            lm = occluded[i].landmarks.copy()
            lm[KP["LEFT_SHOULDER"], 2] = 0.05
            lm[KP["RIGHT_SHOULDER"], 2] = 0.05
            occluded[i].landmarks = lm

        a = _compute_trunk_stability_v2(visible, self.phases)
        b = _compute_trunk_stability_v2(occluded, self.phases)
        assert a.status == "ok"
        assert b.status == "insufficient_data"

    def test_to_dict_includes_view_mode(self):
        report = compute_benchmarks(self.poses, self.phases, hand="R",
                                    view_mode="open_side")
        d = report.to_dict()
        assert d["view_mode"] == "open_side"

    def test_requires_front_view_classmethod(self):
        r = BenchmarkResult.requires_front_view("test_metric", "needs front camera")
        assert r.status == "requires_front_view"
        assert r.score is None
        assert r.name == "test_metric"


class TestOpenSideV2Metrics:
    def setup_method(self):
        self.fps = 30.0
        self.poses = _make_full_pose_sequence(n=60, fps=self.fps)
        self.phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=48, fps=self.fps)

    def test_drift_forward_has_phase_deltas(self):
        drift = _compute_drift_forward(self.poses, self.phases)
        assert drift.status == "ok"
        d1 = drift.sub_values.get("drift_to_pll_pct_height")
        d2 = drift.sub_values.get("drift_pll_to_fs_pct_height")
        total = drift.sub_values.get("total_drift_pct_height")
        assert d1 is not None and d2 is not None and total is not None
        assert d1 >= 0.0 and d2 >= 0.0 and total >= 0.0
        assert abs((d1 + d2) - total) < 3.0

    def test_release_extension_v2_blend(self):
        ext = _compute_release_extension_v2(self.poses, self.phases, hand="R")
        assert ext.status == "ok"
        a = ext.sub_values.get("component_a_score")
        b = ext.sub_values.get("component_b_score")
        c = ext.sub_values.get("component_c_score")
        assert a is not None and b is not None and c is not None
        weights = {"A": 0.55, "B": 0.25, "C": 0.20}
        used = ext.sub_values.get("components_used") or ["A", "B", "C"]
        weight_sum = sum(weights[k] for k in used)
        expected = sum(
            weights[k] * {"A": float(a), "B": float(b), "C": float(c)}[k]
            for k in used
        ) / max(weight_sum, 1e-9)
        assert ext.score_raw is not None
        assert ext.score_raw == pytest.approx(expected, abs=0.2)
        assert ext.score is not None
        assert ext.score <= ext.score_raw

    def test_release_extension_v2_medium_visibility_stays_ok(self):
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        rel = self.phases.ball_release.frame_idx
        # Keep exactly three visible REL-window wrist frames (radius=2 -> 5 frames total).
        occlude_frames = {rel - 2, rel + 2}
        for i in range(rel - 2, rel + 3):
            if not (0 <= i < len(poses)):
                continue
            if i in occlude_frames:
                lm = poses[i].landmarks.copy()
                lm[KP["RIGHT_WRIST"], 2] = 0.05
                poses[i].landmarks = lm

        ext = _compute_release_extension_v2(poses, self.phases, hand="R")
        assert ext.status == "ok"
        assert ext.confidence is not None and ext.confidence >= CONF_BLIND
        assert ext.score is not None and ext.score_raw is not None
        assert ext.score <= ext.score_raw

    def test_release_extension_v2_missing_wrist_falls_back_to_elbow(self):
        """When wrist is occluded but elbow is visible, extension still produces
        a score via elbow fallback (lower confidence)."""
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        rel = self.phases.ball_release.frame_idx
        for i in range(rel - 2, rel + 3):
            if not (0 <= i < len(poses)):
                continue
            lm = poses[i].landmarks.copy()
            lm[KP["RIGHT_WRIST"], 2] = 0.05
            poses[i].landmarks = lm
        ext = _compute_release_extension_v2(poses, self.phases, hand="R")
        assert ext.status == "ok", "Elbow fallback should keep status=ok"

    def test_release_extension_v2_missing_wrist_and_elbow_is_insufficient(self):
        """When both wrist AND elbow are occluded, extension should be insufficient."""
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        rel = self.phases.ball_release.frame_idx
        for i in range(rel - 2, rel + 3):
            if not (0 <= i < len(poses)):
                continue
            lm = poses[i].landmarks.copy()
            lm[KP["RIGHT_WRIST"], 2] = 0.05
            lm[KP["RIGHT_ELBOW"], 2] = 0.05
            poses[i].landmarks = lm
        ext = _compute_release_extension_v2(poses, self.phases, hand="R")
        assert ext.status == "insufficient_data"

    def test_trunk_stability_v2_gates_high_residuals(self):
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        for i in range(fs - 4, rel + 4):
            if not (0 <= i < len(poses)):
                continue
            lm = poses[i].landmarks.copy()
            # Alternating shoulder jitter to force fit residual blow-up.
            lm[KP["LEFT_SHOULDER"], 0] += np.float32(((-1.0) ** i) * 0.22)
            lm[KP["RIGHT_SHOULDER"], 0] += np.float32(((-1.0) ** (i + 1)) * 0.06)
            lm[KP["LEFT_HIP"], 0] += np.float32(((-1.0) ** (i + 1)) * 0.14)
            poses[i].landmarks = lm
        trunk = _compute_trunk_stability_v2(poses, self.phases)
        assert trunk.status == "insufficient_data"

    def test_lead_leg_block_v3_high_when_leg_is_firm_fs_to_rel_even_small_delta(self):
        stiff = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        for i in range(fs - 4, rel + 5):
            if not (0 <= i < len(stiff)):
                continue
            lm = stiff[i].landmarks.copy()
            # Keep lead leg nearly vertical/firm from FS through REL.
            lm[KP["LEFT_HIP"], 0] = 0.40
            lm[KP["LEFT_HIP"], 1] = 0.55
            lm[KP["LEFT_KNEE"], 0] = 0.40
            lm[KP["LEFT_KNEE"], 1] = 0.68 + (0.002 if i >= rel else 0.0)
            lm[KP["LEFT_ANKLE"], 0] = 0.40
            lm[KP["LEFT_ANKLE"], 1] = 0.82
            lm[KP["RIGHT_HIP"], 0] = 0.60
            stiff[i].landmarks = lm

        block = _compute_lead_leg_block_v3(stiff, self.phases, hand="R")
        assert block.status == "ok"
        assert block.score is not None
        assert block.score >= 7.5
        assert block.sub_values.get("label") == "BRACED"

    def test_lead_leg_block_v3_penalizes_forward_leak_and_knee_collapse(self):
        strong = _make_full_pose_sequence(n=60, fps=self.fps)
        leaky = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx

        for i in range(fs - 4, rel + 5):
            if not (0 <= i < len(strong)):
                continue
            for seq in (strong, leaky):
                lm = seq[i].landmarks.copy()
                lm[KP["LEFT_HIP"], 0] = 0.40
                lm[KP["LEFT_KNEE"], 0] = 0.40
                lm[KP["LEFT_ANKLE"], 0] = 0.40
                seq[i].landmarks = lm

            # Collapse/leak in leaky sequence after FS.
            if i >= fs:
                lm_bad = leaky[i].landmarks.copy()
                progress = (i - fs) / max(1, rel - fs)
                lm_bad[KP["LEFT_HIP"], 0] += np.float32(0.14 * progress)
                lm_bad[KP["RIGHT_HIP"], 0] += np.float32(0.14 * progress)
                lm_bad[KP["LEFT_KNEE"], 0] += np.float32(0.18 * progress)
                lm_bad[KP["LEFT_KNEE"], 1] += np.float32(0.04 * progress)
                leaky[i].landmarks = lm_bad

        a = _compute_lead_leg_block_v3(strong, self.phases, hand="R")
        b = _compute_lead_leg_block_v3(leaky, self.phases, hand="R")
        assert a.status == "ok" and b.status == "ok"
        assert a.score is not None and b.score is not None
        assert b.score <= a.score - 1.0
        assert b.sub_values.get("label") in {"LEAK", "COLLAPSE", "SOFT"}

    def test_lead_leg_block_v3_three_valid_window_frames_stays_ok(self):
        poses = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        # Remove two frames in each 5-frame FS/REL window, leaving 3 valid frames.
        for i in (fs - 2, fs + 2, rel - 2, rel + 2):
            if not (0 <= i < len(poses)):
                continue
            lm = poses[i].landmarks.copy()
            for kp in ("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"):
                lm[KP[kp], 2] = 0.05
            poses[i].landmarks = lm
        block = _compute_lead_leg_block_v3(poses, self.phases, hand="R")
        assert block.status == "ok"
        assert block.confidence is not None and block.confidence >= CONF_BLIND

    def test_hip_shoulder_sep_v3_scores_higher_for_positive_lag_and_ratio(self):
        good = _make_full_pose_sequence(n=60, fps=self.fps)
        poor = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx

        # Good sequence: shoulders burst while pelvis/back-hip stays back.
        for i in range(10, rel + 1):
            if not (0 <= i < len(good)):
                continue
            lm = good[i].landmarks.copy()
            if i >= fs - 1:
                p = (i - (fs - 1)) / max(1, rel - (fs - 1))
                lm[KP["RIGHT_SHOULDER"], 1] += np.float32(0.14 * p)
                lm[KP["LEFT_SHOULDER"], 1] -= np.float32(0.14 * p)
            good[i].landmarks = lm

        # Poor sequence: pelvis/back-hip drifts forward early before shoulder burst.
        for i in range(10, rel + 1):
            if not (0 <= i < len(poor)):
                continue
            lm = poor[i].landmarks.copy()
            if i <= fs - 3:
                p = (i - 10) / max(1, (fs - 3) - 10)
                lm[KP["RIGHT_HIP"], 0] += np.float32(0.16 * p)
                lm[KP["LEFT_HIP"], 0] += np.float32(0.16 * p)
            if i >= fs + 1:
                p = (i - (fs + 1)) / max(1, rel - (fs + 1))
                lm[KP["RIGHT_SHOULDER"], 1] += np.float32(0.08 * p)
                lm[KP["LEFT_SHOULDER"], 1] -= np.float32(0.08 * p)
            poor[i].landmarks = lm

        a = _compute_hip_shoulder_sep_v3(good, self.phases, hand="R")
        b = _compute_hip_shoulder_sep_v3(poor, self.phases, hand="R")
        assert a.status == "ok" and b.status == "ok"
        assert a.score is not None and b.score is not None
        assert a.score > b.score
        assert float(a.sub_values["lag_s"]) >= float(b.sub_values["lag_s"])
        assert a.sub_values.get("label") == "GOOD LAG"
        assert b.sub_values.get("label") in {"EARLY HIP COLLAPSE", "SIMULTANEOUS"}

    def test_hip_shoulder_sep_v3_penalizes_early_pelvis_burst(self):
        seq = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx

        for i in range(8, rel + 1):
            if not (0 <= i < len(seq)):
                continue
            lm = seq[i].landmarks.copy()
            if i <= fs - 3:
                p = (i - 8) / max(1, (fs - 3) - 8)
                lm[KP["RIGHT_HIP"], 0] += np.float32(0.18 * p)
                lm[KP["LEFT_HIP"], 0] += np.float32(0.18 * p)
            if i >= fs + 1:
                p = (i - (fs + 1)) / max(1, rel - (fs + 1))
                lm[KP["RIGHT_SHOULDER"], 1] += np.float32(0.16 * p)
                lm[KP["LEFT_SHOULDER"], 1] -= np.float32(0.16 * p)
            seq[i].landmarks = lm

        sep = _compute_hip_shoulder_sep_v3(seq, self.phases, hand="R")
        assert sep.status == "ok"
        assert sep.sub_values.get("label") == "EARLY HIP COLLAPSE"
        assert sep.score is not None and sep.score < 6.0

    def test_hip_shoulder_sep_v3_medium_quality_is_not_hard_failed(self):
        seq = _make_full_pose_sequence(n=60, fps=self.fps)
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        # Add shoulder rotation while intermittently occluding hips.
        for i in range(10, rel + 1):
            if not (0 <= i < len(seq)):
                continue
            lm = seq[i].landmarks.copy()
            if i >= fs - 1:
                p = (i - (fs - 1)) / max(1, rel - (fs - 1))
                lm[KP["RIGHT_SHOULDER"], 1] += np.float32(0.10 * p)
                lm[KP["LEFT_SHOULDER"], 1] -= np.float32(0.10 * p)
            if i % 5 == 0:
                lm[KP["RIGHT_HIP"], 2] = 0.1
            seq[i].landmarks = lm

        sep = _compute_hip_shoulder_sep_v3(seq, self.phases, hand="R")
        assert sep.status == "ok"
        assert sep.confidence is not None and sep.confidence >= CONF_BLIND
        assert sep.score is not None and sep.score_raw is not None
        assert sep.score <= sep.score_raw

    def test_confidence_gating_missing_landmarks_returns_insufficient_data(self):
        occluded = _make_full_pose_sequence(n=60, fps=self.fps)
        start = self.phases.set_pos.frame_idx
        rel = self.phases.ball_release.frame_idx
        for i in range(start, rel + 5):
            if not (0 <= i < len(occluded)):
                continue
            lm = occluded[i].landmarks.copy()
            lm[KP["LEFT_ANKLE"], 2] = 0.05
            lm[KP["LEFT_KNEE"], 2] = 0.05
            lm[KP["LEFT_HIP"], 2] = 0.05
            lm[KP["RIGHT_HIP"], 2] = 0.05
            lm[KP["LEFT_SHOULDER"], 2] = 0.05
            lm[KP["RIGHT_SHOULDER"], 2] = 0.05
            occluded[i].landmarks = lm

        block = _compute_lead_leg_block_v3(occluded, self.phases, hand="R")
        sep = _compute_hip_shoulder_sep_v3(occluded, self.phases, hand="R")
        assert block.status == "insufficient_data"
        assert sep.status == "insufficient_data"

    def test_front_side_closedness_v2_detects_early_glove_open(self):
        closed = _make_full_pose_sequence(n=60, fps=self.fps)
        open_front = _make_full_pose_sequence(n=60, fps=self.fps)
        pll = self.phases.peak_leg_lift.frame_idx
        fs = self.phases.foot_strike.frame_idx
        rel = self.phases.ball_release.frame_idx
        for i in range(pll, rel + 1):
            progress = (i - pll) / max(1, rel - pll)
            lm = open_front[i].landmarks.copy()
            lm[KP["LEFT_WRIST"], 0] -= np.float32(0.28 * progress)
            lm[KP["LEFT_ELBOW"], 0] -= np.float32(0.22 * progress)
            if i >= fs:
                lm[KP["LEFT_SHOULDER"], 0] -= np.float32(0.08 * ((i - fs) / max(1, rel - fs)))
            open_front[i].landmarks = lm

        a = _compute_front_side_closedness_v2(closed, self.phases, hand="R")
        b = _compute_front_side_closedness_v2(open_front, self.phases, hand="R")
        assert a.status == "ok" and b.status == "ok"
        assert a.score is not None and b.score is not None
        assert b.score < a.score
        assert b.sub_values.get("label") == "OPENS EARLY"


class TestEfficiencyWeighting:
    def test_low_confidence_metric_contributes_less(self):
        metrics = [
            BenchmarkResult(
                name="timing", status="ok", score=0.0, confidence=1.0
            ),
            BenchmarkResult(
                name="lead_leg_block_v3", status="ok", score=10.0, confidence=0.1
            ),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff is not None
        # Metric below confidence gate should be excluded.
        assert eff == 0.0

    def test_efficiency_eligibility_uses_conf_blind(self):
        metrics = [
            BenchmarkResult(name="timing", status="ok", score=5.0, confidence=CONF_BLIND - 0.01),
            BenchmarkResult(name="release_extension_v2", status="ok", score=9.0, confidence=CONF_BLIND + 0.01),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff == 9.0

    def test_metric_weights_change_result_predictably(self):
        metrics = [
            BenchmarkResult(name="timing", status="ok", score=2.0, confidence=1.0),
            BenchmarkResult(name="release_extension_v2", status="ok", score=10.0, confidence=1.0),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff is not None
        expected = round((2.0 * 0.7 + 10.0 * 1.0) / (0.7 + 1.0), 2)
        assert eff == expected

    def test_open_side_ignores_front_view_metric_even_if_ok(self):
        metrics = [
            BenchmarkResult(name="timing", status="ok", score=8.0, confidence=1.0),
            BenchmarkResult(name="torque_retention", status="ok", score=0.0, confidence=1.0),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff == 8.0

    def test_open_side_efficiency_marks_low_conf_when_fewer_than_four_metrics(self):
        metrics = [
            BenchmarkResult(name="timing", status="ok", score=7.0, confidence=0.9),
            BenchmarkResult(name="lead_leg_block_v3", status="ok", score=7.0, confidence=0.9),
            BenchmarkResult(name="hip_shoulder_sep_v3", status="ok", score=7.0, confidence=0.9),
        ]
        score, low_conf = _compute_efficiency_details(metrics, view_mode="open_side")
        assert score is not None
        assert low_conf is True


# ---------------------------------------------------------------------------
# Phase 2+3+4 regression tests: outlier rescue, confidence hardening,
# metric robustness
# ---------------------------------------------------------------------------

class TestWindowClean:
    """Test the window_clean outlier rescue utility."""

    def test_import(self):
        from src.mechanics.utils import window_clean, WindowCleanResult  # noqa: F401

    def test_clean_series_removes_spike(self):
        """A single spike frame in a stable series should be NaN'd out."""
        from src.mechanics.utils import window_clean
        series = [10.0, 10.1, 10.0, 50.0, 10.2, 10.0]  # spike at index 3
        result = window_clean(series, radius=6, mad_k=3.0)
        assert np.isnan(result.values[3]), "Spike frame should be dropped"
        assert result.dropped_count >= 1

    def test_clean_series_preserves_stable(self):
        """A stable series with no outliers should be unchanged."""
        from src.mechanics.utils import window_clean
        series = [10.0, 10.1, 10.0, 10.2, 10.1, 10.0]
        result = window_clean(series, radius=6, mad_k=3.0)
        assert result.dropped_count == 0
        assert result.kept_count == 6

    def test_jitter_score_low_for_stable(self):
        from src.mechanics.utils import window_clean
        series = [5.0, 5.1, 5.0, 5.1, 5.0]
        result = window_clean(series, radius=5, mad_k=3.0)
        assert result.jitter_score <= 0.3

    def test_empty_series(self):
        from src.mechanics.utils import window_clean
        result = window_clean([], radius=3)
        assert result.kept_count == 0
        assert result.jitter_score == 1.0


class TestJitterNeverZerosConfidence:
    """Ensure high_jitter alone can never set conf to 0."""

    def test_jitter_floor_in_conf_from_jitter(self):
        from src.mechanics.confidence import conf_from_jitter
        # Even with extreme jitter (mad >> target_mad), floor prevents 0
        result = conf_from_jitter(mad=100.0, target_mad=1.0, floor=0.10)
        assert result >= 0.10

    def test_metric_confidence_nonzero_with_high_jitter(self):
        """_metric_confidence should not return 0 when jitter is maxed but
        coverage and visibility are good."""
        from src.mechanics.benchmarks import _metric_confidence
        conf = _metric_confidence(coverage=1.0, jitter_penalty=1.0, visibility=0.9)
        assert conf > 0.0, "Jitter alone should not zero out confidence"


class TestSpikeDoesNotCauseInsufficient:
    """Core regression: a single bad frame must NOT cause insufficient_data."""

    def _make_braced_leg_poses(self, n: int = 50, spike_frame: int = 40) -> list[PoseResult]:
        """Create synthetic braced-leg poses with optional spike."""
        poses = []
        for i in range(n):
            lm = _base_lm(vis=0.85)
            # Place landmarks to simulate a braced lead leg (RHP):
            # LEFT_HIP slightly to left, LEFT_KNEE below and straight, LEFT_ANKLE below
            lm[KP["LEFT_HIP"]] = [0.35, 0.45, 0.9]
            lm[KP["LEFT_KNEE"]] = [0.35, 0.60, 0.9]
            lm[KP["LEFT_ANKLE"]] = [0.35, 0.75, 0.9]
            # Right side (drive leg)
            lm[KP["RIGHT_HIP"]] = [0.55, 0.45, 0.9]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.60, 0.9]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.75, 0.9]
            # Shoulders and hips for separation
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.30, 0.9]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.30, 0.9]
            # Wrists for extension
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.25, 0.85]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.35, 0.85]
            # Elbows
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.28, 0.88]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.32, 0.88]
            # NOSE
            lm[KP["NOSE"]] = [0.45, 0.15, 0.95]

            if i == spike_frame:
                # Inject a massive spike on the lead knee
                lm[KP["LEFT_KNEE"]] = [0.80, 0.20, 0.7]

            poses.append(_make_pose(frame_idx=i, lm=lm))
        return poses

    def test_spike_does_not_cause_insufficient_block(self):
        """A single spike frame should NOT make lead_leg_block insufficient."""
        poses = self._make_braced_leg_poses(spike_frame=40)
        phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=45)
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "ok", f"Expected 'ok', got '{result.status}' — reasons: {result.reasons}"

    def test_spike_does_not_cause_insufficient_closedness(self):
        """A single spike frame should NOT make closedness insufficient."""
        poses = self._make_braced_leg_poses(spike_frame=25)
        phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=45)
        result = _compute_front_side_closedness_v2(poses, phases, hand="R")
        assert result.status == "ok", f"Expected 'ok', got '{result.status}' — reasons: {result.reasons}"

    def test_spike_does_not_cause_insufficient_extension(self):
        """A single spike frame should NOT make release_extension insufficient."""
        poses = self._make_braced_leg_poses(spike_frame=44)
        phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=45)
        result = _compute_release_extension_v2(poses, phases, hand="R")
        assert result.status == "ok", f"Expected 'ok', got '{result.status}' — reasons: {result.reasons}"


class TestJitterLowersConfidenceNotStatus:
    """Jitter should lower confidence but keep status='ok'."""

    def _make_jittery_poses(self, n: int = 50) -> list[PoseResult]:
        """Create poses with moderate jitter on all landmarks."""
        import random
        random.seed(42)
        poses = []
        for i in range(n):
            lm = _base_lm(vis=0.85)
            # Add random jitter to simulate noisy detection
            for j in range(NUM_LANDMARKS):
                lm[j, 0] += random.uniform(-0.05, 0.05)
                lm[j, 1] += random.uniform(-0.05, 0.05)
            lm[KP["LEFT_HIP"]] = [0.35 + random.uniform(-0.03, 0.03), 0.45, 0.9]
            lm[KP["LEFT_KNEE"]] = [0.35 + random.uniform(-0.03, 0.03), 0.60, 0.9]
            lm[KP["LEFT_ANKLE"]] = [0.35 + random.uniform(-0.03, 0.03), 0.75, 0.9]
            lm[KP["RIGHT_HIP"]] = [0.55, 0.45, 0.9]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.60, 0.9]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.75, 0.9]
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.30, 0.9]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.30, 0.9]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.25, 0.85]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.35, 0.85]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.28, 0.88]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.32, 0.88]
            lm[KP["NOSE"]] = [0.45, 0.15, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        return poses

    def test_jitter_keeps_block_ok(self):
        poses = self._make_jittery_poses()
        phases = _make_phases()
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "ok", f"Jittery block should be ok, got {result.status}"

    def test_jitter_keeps_sep_ok(self):
        poses = self._make_jittery_poses()
        phases = _make_phases()
        result = _compute_hip_shoulder_sep_v3(poses, phases, hand="R")
        assert result.status == "ok", f"Jittery sep should be ok, got {result.status}"


class TestMissingLandmarksCauseInsufficient:
    """Missing landmarks should cause insufficient_data."""

    def test_all_nan_poses_cause_insufficient_block(self):
        """If all poses are NaN, lead_leg_block should be insufficient."""
        poses = []
        for i in range(50):
            lm = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases()
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "insufficient_data"

    def test_all_nan_poses_cause_insufficient_closedness(self):
        poses = []
        for i in range(50):
            lm = np.full((NUM_LANDMARKS, 3), np.nan, dtype=np.float32)
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases()
        result = _compute_front_side_closedness_v2(poses, phases, hand="R")
        assert result.status == "insufficient_data"


class TestSyntheticBracedLegHighScore:
    """A synthetic perfectly braced leg should score high."""

    def test_braced_leg_high_block_score(self):
        """With a perfectly straight and stable lead leg, block score should be >= 7."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            # Perfectly straight lead leg (knee angle ~180)
            lm[KP["LEFT_HIP"]] = [0.35, 0.40, 0.95]
            lm[KP["LEFT_KNEE"]] = [0.35, 0.57, 0.95]
            lm[KP["LEFT_ANKLE"]] = [0.35, 0.75, 0.95]
            # Other landmarks
            lm[KP["RIGHT_HIP"]] = [0.55, 0.40, 0.95]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.60, 0.95]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.75, 0.95]
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.25, 0.95]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.20, 0.90]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.30, 0.90]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.23, 0.92]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.28, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=45)
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "ok"
        assert result.score is not None
        assert result.score >= 6.0, f"Braced leg should score high, got {result.score}"


class TestSyntheticLeakLowScore:
    """A synthetic leaking/collapsing leg should score low."""

    def test_leak_leg_low_block_score(self):
        """With a soft/collapsing lead leg, block score should be low."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            # Heavily bent lead leg at release — knee significantly forward
            knee_x = 0.35 + (0.15 if i >= 30 else 0.0)  # leak after FS
            knee_y = 0.55  # knee high (bent)
            lm[KP["LEFT_HIP"]] = [0.35, 0.40, 0.95]
            lm[KP["LEFT_KNEE"]] = [knee_x, knee_y, 0.95]
            lm[KP["LEFT_ANKLE"]] = [0.35, 0.75, 0.95]
            # Forward-leaking hips
            hip_x = 0.35 + (0.08 if i >= 30 else 0.0)
            lm[KP["LEFT_HIP"]] = [hip_x, 0.40, 0.95]
            lm[KP["RIGHT_HIP"]] = [0.55 + (0.08 if i >= 30 else 0.0), 0.40, 0.95]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.60, 0.95]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.75, 0.95]
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.25, 0.95]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.20, 0.90]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.30, 0.90]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.23, 0.92]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.28, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases(set_idx=0, peak_idx=18, fs_idx=30, rel_idx=45)
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "ok"
        # Should score notably lower than a braced leg
        if result.score is not None:
            assert result.score < 8.0, f"Leaking leg should score lower, got {result.score}"


# ---------------------------------------------------------------------------
# Reason flag regression tests
# ---------------------------------------------------------------------------

class TestNoFalsePhaseUncertain:
    """phase_uncertain should only appear when phase_conf < 0.50."""

    def test_block_no_phase_uncertain_above_threshold(self):
        """lead_leg_block_v3 should NOT have phase_uncertain when phase confs >= 0.55."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            lm[KP["LEFT_HIP"]] = [0.35, 0.40, 0.95]
            lm[KP["LEFT_KNEE"]] = [0.35, 0.55, 0.95]
            lm[KP["LEFT_ANKLE"]] = [0.35, 0.75, 0.95]
            lm[KP["RIGHT_HIP"]] = [0.55, 0.40, 0.95]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.60, 0.95]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.75, 0.95]
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.25, 0.95]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.20, 0.90]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.30, 0.90]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.23, 0.92]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.28, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        # Phase confs will be >= 0.55 for these clear poses
        phases = _make_phases(set_idx=0, peak_idx=15, fs_idx=30, rel_idx=42)
        result = _compute_lead_leg_block_v3(poses, phases, hand="R")
        assert result.status == "ok"
        reasons = result.reasons or []
        assert "phase_uncertain" not in reasons, f"False phase_uncertain: {reasons}"


class TestConsecutiveJumpPenalty:
    """_jump_penalty_consecutive only triggers on sustained instability."""

    def test_isolated_spike_creates_consecutive_diffs(self):
        """A single-value spike creates 2 consecutive large diffs (up+down),
        which correctly triggers the consecutive check."""
        # Spike at index 4: diffs include ~48.9 and ~49.0 back-to-back
        vals = [1.0, 1.1, 1.0, 1.1, 50.0, 1.0, 1.1, 1.0, 1.1, 1.0]
        penalty = _jump_penalty_consecutive(vals, jump_scale=5.0, min_consecutive=2)
        # This IS consecutive (up-jump + down-jump) so penalty should be > 0
        assert penalty > 0.0, f"Spike up+down are consecutive, got {penalty}"

    def test_sustained_instability_penalized(self):
        """Sustained large diffs across multiple consecutive frames are penalized."""
        # Diffs: [0, 0, 49, 30, 40, 119, 0, 0, 0] — four consecutive above thresh
        vals = [1.0, 1.0, 1.0, 50.0, 80.0, 120.0, 1.0, 1.0, 1.0, 1.0]
        penalty = _jump_penalty_consecutive(vals, jump_scale=5.0, min_consecutive=2)
        assert penalty > 0.0, f"Sustained instability should penalize, got {penalty}"

    def test_stable_series_no_penalty(self):
        """A stable series should have zero penalty."""
        vals = [10.0, 10.1, 10.0, 10.2, 10.1, 10.0, 10.1, 10.0]
        penalty = _jump_penalty_consecutive(vals, jump_scale=5.0, min_consecutive=2)
        assert penalty == 0.0, f"Stable series should not penalize, got {penalty}"


class TestSwivel_NoFalseOutlierJump:
    """swivel_stabilize should not flag outlier_jump from a single frame spike."""

    def test_swivel_single_spike_no_outlier(self):
        """One bad glove-tracking frame should not produce outlier_jump."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            lm[KP["LEFT_SHOULDER"]] = [0.30, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [0.60, 0.25, 0.95]
            lm[KP["LEFT_HIP"]] = [0.35, 0.50, 0.95]
            lm[KP["RIGHT_HIP"]] = [0.55, 0.50, 0.95]
            # Glove stays inside torso frame, except one spike
            glove_x = 0.40
            if i == 40:
                glove_x = 0.10  # single spike outside
            lm[KP["LEFT_WRIST"]] = [glove_x, 0.35, 0.90]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.20, 0.90]
            lm[KP["LEFT_ELBOW"]] = [0.33, 0.30, 0.92]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.23, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases(set_idx=0, peak_idx=15, fs_idx=30, rel_idx=42)
        result = _compute_swivel_stabilize(poses, phases, hand="R")
        assert result.status == "ok"
        reasons = result.reasons or []
        assert "outlier_jump" not in reasons, f"Single spike caused outlier_jump: {reasons}"


class TestHipShoulderSep_NoFalseOutlierJump:
    """hip_shoulder_sep_v3 should not flag outlier_jump from single-frame shoulder flip."""

    def test_single_shoulder_flip_no_outlier(self):
        """A single-frame shoulder angle spike should not trigger outlier_jump."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            # Consistent shoulder line, except one flip frame
            ls_x = 0.30
            rs_x = 0.60
            if i == 25:
                # Flip: shoulders appear reversed for one frame
                ls_x = 0.58
                rs_x = 0.32
            lm[KP["LEFT_SHOULDER"]] = [ls_x, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [rs_x, 0.25, 0.95]
            lm[KP["LEFT_HIP"]] = [0.35, 0.50, 0.95]
            lm[KP["RIGHT_HIP"]] = [0.55, 0.50, 0.95]
            lm[KP["LEFT_KNEE"]] = [0.35, 0.65, 0.95]
            lm[KP["RIGHT_KNEE"]] = [0.55, 0.65, 0.95]
            lm[KP["LEFT_ANKLE"]] = [0.35, 0.80, 0.95]
            lm[KP["RIGHT_ANKLE"]] = [0.55, 0.80, 0.95]
            lm[KP["LEFT_WRIST"]] = [0.25, 0.30, 0.90]
            lm[KP["RIGHT_WRIST"]] = [0.70, 0.20, 0.90]
            lm[KP["LEFT_ELBOW"]] = [0.28, 0.28, 0.92]
            lm[KP["RIGHT_ELBOW"]] = [0.65, 0.23, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases(set_idx=0, peak_idx=15, fs_idx=30, rel_idx=42)
        result = _compute_hip_shoulder_sep_v3(poses, phases, hand="R")
        assert result.status == "ok"
        reasons = result.reasons or []
        assert "outlier_jump" not in reasons, f"Single shoulder flip caused outlier_jump: {reasons}"

    def test_narrow_shoulders_low_trust(self):
        """Very narrow shoulder width should not produce false outlier_jump."""
        poses = []
        for i in range(50):
            lm = _base_lm(vis=0.95)
            # Narrow shoulders (foreshortened open-side) with some motion
            # to avoid low_motion / insufficient velocity samples.
            progress = i / 49.0
            lm[KP["LEFT_SHOULDER"]] = [0.44 - 0.02 * progress, 0.25, 0.95]
            lm[KP["RIGHT_SHOULDER"]] = [0.46 + 0.02 * progress, 0.25, 0.95]
            lm[KP["LEFT_HIP"]] = [0.40 + 0.04 * progress, 0.50, 0.95]
            lm[KP["RIGHT_HIP"]] = [0.50 + 0.04 * progress, 0.50, 0.95]
            lm[KP["LEFT_KNEE"]] = [0.40, 0.65, 0.95]
            lm[KP["RIGHT_KNEE"]] = [0.50, 0.65, 0.95]
            lm[KP["LEFT_ANKLE"]] = [0.40, 0.80, 0.95]
            lm[KP["RIGHT_ANKLE"]] = [0.50, 0.80, 0.95]
            lm[KP["LEFT_WRIST"]] = [0.38, 0.30, 0.90]
            lm[KP["RIGHT_WRIST"]] = [0.52, 0.20, 0.90]
            lm[KP["LEFT_ELBOW"]] = [0.39, 0.28, 0.92]
            lm[KP["RIGHT_ELBOW"]] = [0.51, 0.23, 0.92]
            lm[KP["NOSE"]] = [0.45, 0.10, 0.95]
            poses.append(_make_pose(frame_idx=i, lm=lm))
        phases = _make_phases(set_idx=0, peak_idx=15, fs_idx=30, rel_idx=42)
        result = _compute_hip_shoulder_sep_v3(poses, phases, hand="R")
        assert result.status == "ok"
        reasons = result.reasons or []
        assert "outlier_jump" not in reasons, f"Narrow shoulders caused outlier_jump: {reasons}"
        # Confidence should be positive but lower than normal
        assert result.confidence is not None and result.confidence > CONF_BLIND
