"""
Tests for src/mechanics/phases.py.

Uses synthetic keypoint sequences to test each phase detector in isolation.
No real video required.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.pose import PoseResult, KP, NUM_LANDMARKS
from src.mechanics.phases import (
    detect_phases, _smooth, _velocity, _get_y,
    _detect_delivery_start, _compute_motion_energy,
)


# ---------------------------------------------------------------------------
# Helpers to build synthetic pose sequences
# ---------------------------------------------------------------------------

def _make_pose(frame_idx: int, landmarks: np.ndarray,
               width: int = 1920, height: int = 1080) -> PoseResult:
    return PoseResult(frame_idx=frame_idx, landmarks=landmarks.copy(),
                      width=width, height=height)


def _base_lm(vis: float = 0.9) -> np.ndarray:
    """All keypoints at center with given visibility."""
    lm = np.zeros((NUM_LANDMARKS, 3), dtype=np.float32)
    lm[:, 0] = 0.5    # x
    lm[:, 1] = 0.5    # y
    lm[:, 2] = vis    # visibility
    return lm


def make_synthetic_pitch(n: int = 90, fps: float = 30.0) -> list[PoseResult]:
    """
    Synthetic RHP pitch sequence with a clear leg-lift arc.

    Timeline (normalized image coords, +Y = down):
      0 to 0.3s  : set  — both ankles and lead knee stable near y=0.7
      0.3 to 0.6s: lift — lead knee rises from y=0.55 to y=0.28 (peak at midpoint)
      0.6 to 0.8s: stride — lead knee descends, lead ankle descends then stops at y=0.80
      0.8 to end : follow-through — throwing wrist moves fast
    """
    poses = []
    for i in range(n):
        t = i / fps
        lm = _base_lm()

        # Left hip (lead hip for RHP) stays roughly constant
        lm[KP["LEFT_HIP"],  1] = 0.55

        # Lead knee arc
        if t < 0.3:
            knee_y = 0.55
        elif t < 0.6:
            progress = (t - 0.3) / 0.3
            knee_y = 0.55 - 0.27 * np.sin(progress * np.pi)  # peak = 0.28
        else:
            knee_y = 0.55 + min((t - 0.6) / 0.2, 1.0) * 0.10  # back down

        lm[KP["LEFT_KNEE"],  1] = knee_y

        # Lead ankle: descends during stride, stabilizes at foot strike
        if t < 0.6:
            ankle_y = 0.75
        elif t < 0.75:
            ankle_y = 0.75 + (t - 0.6) / 0.15 * 0.07  # descends
        else:
            ankle_y = 0.82  # stopped

        lm[KP["LEFT_ANKLE"], 1] = ankle_y

        # Drive ankle stays put
        lm[KP["RIGHT_ANKLE"], 1] = 0.78

        # Throwing wrist: fast during follow-through (t > 0.75)
        if t < 0.75:
            wrist_x = 0.55
        else:
            wrist_x = 0.55 + (t - 0.75) * 2.0  # fast horizontal motion

        lm[KP["RIGHT_WRIST"], 0] = min(wrist_x, 1.0)
        lm[KP["RIGHT_WRIST"], 1] = 0.45

        # Shoulders and hips for metric tests
        lm[KP["LEFT_SHOULDER"],  0] = 0.40
        lm[KP["LEFT_SHOULDER"],  1] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.60
        lm[KP["RIGHT_SHOULDER"], 1] = 0.35
        lm[KP["RIGHT_HIP"],      0] = 0.60
        lm[KP["RIGHT_HIP"],      1] = 0.55

        poses.append(_make_pose(frame_idx=i, landmarks=lm))

    return poses


# ---------------------------------------------------------------------------
# Helper function tests
# ---------------------------------------------------------------------------

class TestSmooth:
    def test_no_nans_passthrough(self):
        s = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        out = _smooth(s, window=3)
        assert len(out) == len(s)
        assert not np.any(np.isnan(out))

    def test_output_length_unchanged(self):
        for n in (1, 5, 30):
            s = np.ones(n)
            assert len(_smooth(s, window=5)) == n

    def test_nan_window_propagates(self):
        # If entire input is NaN, output should be NaN
        s = np.full(5, np.nan)
        out = _smooth(s, window=3)
        assert np.all(np.isnan(out))

    def test_partial_nan(self):
        s = np.array([1.0, np.nan, 3.0, 4.0, 5.0])
        out = _smooth(s, window=3)
        # No crash; non-nan values smoothed
        assert len(out) == len(s)


class TestVelocity:
    def test_first_frame_is_nan(self):
        s = np.array([0.0, 1.0, 2.0])
        v = _velocity(s)
        assert np.isnan(v[0])

    def test_constant_series_is_zero(self):
        s = np.ones(10)
        v = _velocity(s)
        # All frames after first should be 0.0
        assert np.all(v[1:] == 0.0)

    def test_linear_series_is_constant(self):
        s = np.arange(5, dtype=float)   # 0, 1, 2, 3, 4
        v = _velocity(s)
        np.testing.assert_allclose(v[1:], 1.0)

    def test_nan_propagates(self):
        s = np.array([1.0, np.nan, 3.0])
        v = _velocity(s)
        assert np.isnan(v[1])
        assert np.isnan(v[2])  # index 2 uses nan at index 1


class TestGetY:
    def test_returns_correct_length(self):
        poses = make_synthetic_pitch(n=30)
        y = _get_y(poses, "LEFT_KNEE")
        assert len(y) == 30

    def test_low_visibility_returns_nan(self):
        lm = _base_lm(vis=0.1)  # below default threshold of 0.3
        pose = _make_pose(0, lm)
        y = _get_y([pose], "LEFT_KNEE", min_vis=0.3)
        assert np.isnan(y[0])

    def test_high_visibility_returns_value(self):
        lm = _base_lm(vis=0.9)
        lm[KP["LEFT_KNEE"], 1] = 0.4
        pose = _make_pose(0, lm, height=1080)
        y = _get_y([pose], "LEFT_KNEE")
        assert abs(y[0] - 0.4 * 1080) < 1.0


# ---------------------------------------------------------------------------
# Phase detection integration tests
# ---------------------------------------------------------------------------

class TestDetectPhasesEmpty:
    def test_empty_list(self):
        phases = detect_phases([], fps=30.0)
        assert phases.set_pos is None
        assert phases.first_movement is None
        assert phases.peak_leg_lift is None
        assert phases.foot_strike is None
        assert phases.ball_release is None
        assert phases.fps == 30.0

    def test_too_few_frames(self):
        poses = make_synthetic_pitch(n=3)
        phases = detect_phases(poses, fps=30.0)
        # Should not crash; results may be None
        assert phases is not None


class TestDetectPhasesSynthetic:
    def setup_method(self):
        self.fps = 30.0
        self.poses = make_synthetic_pitch(n=90, fps=self.fps)
        self.phases = detect_phases(self.poses, fps=self.fps, hand="R")

    def test_set_detected_in_first_third(self):
        if self.phases.set_pos:
            # set phase should be in the first ~27 frames (30% of 90)
            assert self.phases.set_pos.frame_idx < 35

    def test_peak_leg_lift_detected(self):
        assert self.phases.peak_leg_lift is not None

    def test_peak_leg_lift_around_midpoint(self):
        # Peak is at t=0.45s in our synthetic data → frame ~13-14
        if self.phases.peak_leg_lift:
            assert 5 < self.phases.peak_leg_lift.frame_idx < 40

    def test_foot_strike_after_peak(self):
        if self.phases.peak_leg_lift and self.phases.foot_strike:
            assert self.phases.foot_strike.frame_idx > self.phases.peak_leg_lift.frame_idx

    def test_ball_release_after_foot_strike(self):
        if self.phases.foot_strike and self.phases.ball_release:
            assert self.phases.ball_release.frame_idx >= self.phases.foot_strike.frame_idx

    def test_phase_timestamps_match_frame_indices(self):
        for phase in (self.phases.set_pos, self.phases.peak_leg_lift,
                      self.phases.foot_strike, self.phases.ball_release):
            if phase is not None:
                expected_t = phase.frame_idx / self.fps
                assert abs(phase.time_s - expected_t) < 0.01

    def test_confidence_in_range(self):
        for phase in (self.phases.set_pos, self.phases.peak_leg_lift,
                      self.phases.foot_strike, self.phases.ball_release):
            if phase is not None:
                assert 0.0 <= phase.confidence <= 1.0

    def test_to_dict_serializable(self):
        import json
        d = self.phases.to_dict()
        # Should not raise
        json.dumps(d)

    def test_lhp_does_not_crash(self):
        poses = make_synthetic_pitch(n=60, fps=30.0)
        phases = detect_phases(poses, fps=30.0, hand="L")
        assert phases is not None

    def test_peak_leg_lift_fallback_keeps_nonzero_confidence_with_sparse_knee_points(self):
        poses = make_synthetic_pitch(n=90, fps=30.0)
        # Keep some lead-knee points visible but make coverage sparse and noisy.
        for i, pose in enumerate(poses):
            if (i % 6) != 0:
                pose.landmarks[KP["LEFT_KNEE"], 2] = 0.1  # below min visibility threshold
            pose.landmarks[KP["LEFT_HIP"], 1] = 0.40
            pose.landmarks[KP["LEFT_KNEE"], 1] = 0.62 - 0.04 * np.sin(i / 8.0)

        phases = detect_phases(poses, fps=30.0, hand="R")
        assert phases.peak_leg_lift is not None
        # Sparse knee visibility should still produce low (but non-zero) confidence.
        assert phases.peak_leg_lift.confidence > 0.0


# ---------------------------------------------------------------------------
# Delivery-start detection tests
# ---------------------------------------------------------------------------

def _make_idle_then_pitch(
    n_idle: int,
    n_pitch: int,
    fps: float = 30.0,
) -> list[PoseResult]:
    """
    Synthetic sequence: n_idle frames of near-zero motion,
    then n_pitch frames of a normal pitch delivery.

    Idle frames have all keypoints stationary.
    Pitch frames reuse the synthetic pitch motion from make_synthetic_pitch.
    """
    idle_poses = []
    for i in range(n_idle):
        lm = _base_lm()
        # Everything stationary — pitcher standing still
        lm[KP["LEFT_SHOULDER"],  0] = 0.40; lm[KP["LEFT_SHOULDER"],  1] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.60; lm[KP["RIGHT_SHOULDER"], 1] = 0.35
        lm[KP["LEFT_HIP"],       0] = 0.42; lm[KP["LEFT_HIP"],       1] = 0.55
        lm[KP["RIGHT_HIP"],      0] = 0.58; lm[KP["RIGHT_HIP"],      1] = 0.55
        lm[KP["LEFT_KNEE"],      0] = 0.42; lm[KP["LEFT_KNEE"],      1] = 0.70
        lm[KP["RIGHT_KNEE"],     0] = 0.58; lm[KP["RIGHT_KNEE"],     1] = 0.70
        lm[KP["LEFT_ANKLE"],     0] = 0.42; lm[KP["LEFT_ANKLE"],     1] = 0.85
        lm[KP["RIGHT_ANKLE"],    0] = 0.58; lm[KP["RIGHT_ANKLE"],    1] = 0.85
        lm[KP["NOSE"],           0] = 0.50; lm[KP["NOSE"],           1] = 0.15
        lm[KP["RIGHT_WRIST"],    0] = 0.55; lm[KP["RIGHT_WRIST"],    1] = 0.45
        lm[KP["LEFT_WRIST"],     0] = 0.45; lm[KP["LEFT_WRIST"],     1] = 0.45
        idle_poses.append(_make_pose(frame_idx=i, landmarks=lm))

    pitch_poses = make_synthetic_pitch(n=n_pitch, fps=fps)
    # Offset frame indices
    for p in pitch_poses:
        p.frame_idx += n_idle

    return idle_poses + pitch_poses


class TestDeliveryStartDetection:
    def test_idle_then_delivery_finds_correct_set(self):
        """60 idle + 90 pitch should place SET near real motion start, not early idle."""
        poses = _make_idle_then_pitch(60, 90)
        phases = detect_phases(poses, fps=30.0, hand="R")
        assert phases.set_pos is not None
        # SET should be around the true transition (close to frame 60).
        assert phases.set_pos.frame_idx >= 56, (
            f"SET at frame {phases.set_pos.frame_idx}, expected >= 56"
        )
        assert phases.set_pos.confidence >= 0.7

    def test_no_idle_period_still_works(self):
        """Existing make_synthetic_pitch(90) with no idle → SET in first ~15 frames."""
        poses = make_synthetic_pitch(n=90, fps=30.0)
        phases = detect_phases(poses, fps=30.0, hand="R")
        assert phases.set_pos is not None
        assert phases.set_pos.frame_idx < 30

    def test_long_idle_then_delivery(self):
        """150 idle + 90 pitch should not inflate SET to early idle."""
        poses = _make_idle_then_pitch(150, 90)
        phases = detect_phases(poses, fps=30.0, hand="R")
        assert phases.set_pos is not None
        assert phases.set_pos.frame_idx >= 146, (
            f"SET at frame {phases.set_pos.frame_idx}, expected >= 146"
        )

    def test_long_idle_prefix_does_not_inflate_timing(self):
        """SET->FS should reflect delivery tempo, not total clip idle duration."""
        poses = _make_idle_then_pitch(120, 90)
        phases = detect_phases(poses, fps=30.0, hand="R")
        assert phases.set_pos is not None
        assert phases.foot_strike is not None
        timing = phases.foot_strike.time_s - phases.set_pos.time_s
        assert 0.15 <= timing <= 2.0, f"Unexpected timing with long idle prefix: {timing:.3f}s"

    def test_motion_energy_idle_is_near_zero(self):
        """Idle frames should have near-zero motion energy."""
        poses = _make_idle_then_pitch(60, 90)
        energy = _compute_motion_energy(poses)
        # Idle frames (1-59) should have very low energy
        idle_energy = energy[1:55]
        assert np.max(idle_energy) < 0.001, (
            f"Max idle energy {np.max(idle_energy):.6f} should be < 0.001"
        )

    def test_delivery_start_returns_none_for_short_input(self):
        """Very short input should return None."""
        poses = make_synthetic_pitch(n=5)
        result = _detect_delivery_start(poses, fps=30.0)
        assert result is None

    def test_single_frame_spike_does_not_trigger_start(self):
        """One-frame motion spike should not pass consecutive-frame transition gate."""
        poses = _make_idle_then_pitch(80, 0)
        lm = poses[25].landmarks.copy()
        lm[KP["RIGHT_WRIST"], 0] = min(0.95, lm[KP["RIGHT_WRIST"], 0] + 0.30)
        poses[25] = _make_pose(frame_idx=poses[25].frame_idx, landmarks=lm)
        result = _detect_delivery_start(
            poses,
            fps=30.0,
            ignore_initial_s=0.5,
            min_consecutive=5,
        )
        assert result is None
