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
    angle_from_vertical_deg,
    angle_from_horizontal_deg,
    shoulder_line_angle_deg,
    linear_score,
    piecewise_timing_score,
    compute_benchmarks,
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
    _compute_efficiency_details,
    _compute_efficiency_score,
    _score_release_extension_proxy,
)
from src.mechanics.utils import smooth_series


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
        extras = [m for m in self.report.all_metrics() if m.name.startswith("front_") or m.name in {"tilt_consistency", "release_extension_proxy"}]
        assert len(extras) >= 4
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
        # slot 6 should be trunk_stability, not stack_track
        assert report.stack_track.name == "trunk_stability"
        assert report.stack_track.status == "ok"

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
        result = _compute_trunk_stability(poses, phases)
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

        clean = _compute_trunk_stability(poses_clean, self.phases)
        noisy = _compute_trunk_stability(poses_noisy, self.phases)
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

        a = _compute_trunk_stability(visible, self.phases)
        b = _compute_trunk_stability(occluded, self.phases)
        assert a.status == "ok"
        # Hard gating may mark heavily occluded windows as insufficient.
        assert b.status in ("ok", "insufficient_data")
        if b.status == "ok":
            assert (b.confidence or 0.0) < (a.confidence or 0.0)

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


class TestEfficiencyWeighting:
    def test_low_confidence_metric_contributes_less(self):
        metrics = [
            BenchmarkResult(
                name="timing", status="ok", score=0.0, confidence=1.0
            ),
            BenchmarkResult(
                name="front_knee_extension_rel", status="ok", score=10.0, confidence=0.1
            ),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff is not None
        # Metric below confidence gate should be excluded.
        assert eff == 0.0

    def test_metric_weights_change_result_predictably(self):
        metrics = [
            BenchmarkResult(name="timing", status="ok", score=2.0, confidence=1.0),
            BenchmarkResult(name="release_extension_proxy", status="ok", score=10.0, confidence=1.0),
        ]
        eff = _compute_efficiency_score(metrics, view_mode="open_side")
        assert eff is not None
        expected = round((2.0 * 1.0 + 10.0 * 1.8) / (1.0 + 1.8), 2)
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
            BenchmarkResult(name="front_knee_flexion_fs", status="ok", score=7.0, confidence=0.9),
            BenchmarkResult(name="front_knee_extension_rel", status="ok", score=7.0, confidence=0.9),
        ]
        score, low_conf = _compute_efficiency_details(metrics, view_mode="open_side")
        assert score is not None
        assert low_conf is True
