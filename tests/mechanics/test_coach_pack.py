"""
Unit tests for src/mechanics/coach_pack.py.

All tests use synthetic data — no real video or MediaPipe model required.
cv2.VideoCapture and cv2.VideoWriter are mocked where needed.

Coverage:
  - CoachPackResult dataclass fields
  - Callout table completeness and lookup logic
  - _build_notes structure and JSON serialisability
  - _build_strip dimensions and None handling
  - _write_cliplet with mocked video I/O
  - build_coach_pack end-to-end with mocked video
"""
from __future__ import annotations

import json
import math
import sys
import tempfile
from pathlib import Path
from typing import Optional
from unittest import mock

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics.pose import PoseResult, KP, NUM_LANDMARKS
from src.mechanics.phases import PitchPhases, Phase
from src.mechanics.benchmarks import (
    compute_benchmarks,
    BenchmarkReport,
    BenchmarkResult,
    official_metric_names,
)
from src.mechanics.coach_pack import (
    CoachPackResult,
    CALLOUT_TABLE,
    PHASE_METRICS,
    _get_callout,
    _get_relevant_metrics,
    _select_phase_callouts,
    _build_notes,
    _build_strip,
    _write_cliplet,
    build_coach_pack,
)


# ---------------------------------------------------------------------------
# Synthetic data helpers (replicated from test_benchmarks.py)
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
        set_pos=        _make_phase("set",            set_idx,  fps),
        first_movement= _make_phase("first_movement", 5,        fps),
        peak_leg_lift=  _make_phase("peak_leg_lift",  peak_idx, fps),
        foot_strike=    _make_phase("foot_strike",    fs_idx,   fps),
        ball_release=   _make_phase("ball_release",   rel_idx,  fps),
        fps=fps,
    )


def _make_full_pose_sequence(n: int = 60, fps: float = 30.0) -> list[PoseResult]:
    """Synthetic pitch with plausible landmark positions throughout."""
    poses = []
    for i in range(n):
        t = i / fps
        lm = _base_lm()

        lm[KP["LEFT_SHOULDER"],  0] = 0.35; lm[KP["LEFT_SHOULDER"],  1] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.65; lm[KP["RIGHT_SHOULDER"], 1] = 0.35
        lm[KP["LEFT_HIP"],       0] = 0.40; lm[KP["LEFT_HIP"],       1] = 0.55
        lm[KP["RIGHT_HIP"],      0] = 0.60; lm[KP["RIGHT_HIP"],      1] = 0.55
        lm[KP["RIGHT_ANKLE"],    0] = 0.65; lm[KP["RIGHT_ANKLE"],    1] = 0.82

        if t < 0.3:
            knee_y = 0.60
        elif t < 0.6:
            knee_y = 0.60 - 0.25 * math.sin((t - 0.3) / 0.3 * math.pi)
        else:
            knee_y = 0.60
        lm[KP["LEFT_KNEE"], 0] = 0.40; lm[KP["LEFT_KNEE"], 1] = knee_y
        lm[KP["LEFT_ANKLE"],  0] = 0.40; lm[KP["LEFT_ANKLE"],  1] = min(0.82, 0.70 + t * 0.15)
        lm[KP["LEFT_WRIST"],  0] = 0.45; lm[KP["LEFT_WRIST"],  1] = 0.40
        wrist_x = 0.60 + min(t * 0.3, 0.2)
        lm[KP["RIGHT_WRIST"], 0] = wrist_x; lm[KP["RIGHT_WRIST"], 1] = 0.40
        lm[KP["NOSE"], 0] = 0.50; lm[KP["NOSE"], 1] = 0.15

        poses.append(_make_pose(frame_idx=i, lm=lm))
    return poses


# ---------------------------------------------------------------------------
# Mock helpers for cv2 video I/O
# ---------------------------------------------------------------------------

def _make_mock_frame(width: int = 1280, height: int = 720) -> np.ndarray:
    """Create a synthetic BGR frame."""
    return np.zeros((height, width, 3), dtype=np.uint8)


class MockVideoCapture:
    """Mock cv2.VideoCapture that returns synthetic frames."""

    def __init__(self, path: str, width: int = 1280, height: int = 720,
                 frame_count: int = 60, fps: float = 30.0):
        self._width = width
        self._height = height
        self._frame_count = frame_count
        self._fps = fps
        self._pos = 0
        self._opened = True

    def isOpened(self):
        return self._opened

    def get(self, prop):
        if prop == 3:  # CAP_PROP_FRAME_WIDTH
            return float(self._width)
        if prop == 4:  # CAP_PROP_FRAME_HEIGHT
            return float(self._height)
        if prop == 5:  # CAP_PROP_FPS
            return self._fps
        if prop == 7:  # CAP_PROP_FRAME_COUNT
            return float(self._frame_count)
        return 0.0

    def set(self, prop, value):
        if prop == 1:  # CAP_PROP_POS_FRAMES
            self._pos = int(value)

    def read(self):
        if self._pos >= self._frame_count:
            return False, None
        frame = _make_mock_frame(self._width, self._height)
        self._pos += 1
        return True, frame

    def release(self):
        self._opened = False


class MockVideoWriter:
    """Mock cv2.VideoWriter that tracks written frames."""

    def __init__(self, *args, **kwargs):
        self._frames_written = 0
        self._opened = True

    def isOpened(self):
        return self._opened

    def write(self, frame):
        self._frames_written += 1

    def release(self):
        self._opened = False


# ---------------------------------------------------------------------------
# Tests: CoachPackResult dataclass
# ---------------------------------------------------------------------------

class TestCoachPackResult:
    def test_all_fields_exist(self):
        r = CoachPackResult(coach_pack_dir=Path("/tmp/test"))
        assert r.coach_pack_dir == Path("/tmp/test")
        assert r.set_png is None
        assert r.peak_leg_lift_png is None
        assert r.foot_strike_png is None
        assert r.release_png is None
        assert r.strip_png is None
        assert r.set_to_fs_mp4 is None
        assert r.fs_to_release_mp4 is None
        assert r.release_mp4 is None
        assert r.notes_json is None

    def test_fields_can_be_set(self):
        r = CoachPackResult(
            coach_pack_dir=Path("/tmp"),
            set_png=Path("/tmp/set.png"),
            notes_json=Path("/tmp/notes.json"),
        )
        assert r.set_png == Path("/tmp/set.png")
        assert r.notes_json == Path("/tmp/notes.json")


# ---------------------------------------------------------------------------
# Tests: Callout table
# ---------------------------------------------------------------------------

class TestCalloutTable:
    """Verify callout table completeness and _get_callout logic."""

    EXPECTED_METRICS = [
        "timing", "balance", "posture", "lift_thrust",
        "swivel_stabilize", "stack_track", "trunk_stability", "torque_retention",
        "front_knee_flexion_fs", "front_knee_extension_rel",
        "tilt_consistency", "release_extension_proxy",
    ]

    def test_all_metrics_have_entries(self):
        for name in self.EXPECTED_METRICS:
            assert name in CALLOUT_TABLE, f"Missing callout for {name}"

    def test_passing_metric_returns_none(self):
        r = BenchmarkResult(name="timing", status="ok", score=8.0, pass_fail=True)
        assert _get_callout("timing", r) is None

    def test_failing_metric_returns_string(self):
        r = BenchmarkResult(name="timing", status="ok", score=3.0, pass_fail=False)
        callout = _get_callout("timing", r)
        assert isinstance(callout, str)
        assert len(callout) > 10

    def test_requires_front_view_returns_none(self):
        r = BenchmarkResult.requires_front_view("torque_retention", "needs front")
        assert _get_callout("torque_retention", r) is None

    def test_insufficient_data_returns_none(self):
        r = BenchmarkResult.insufficient("balance", "no data")
        assert _get_callout("balance", r) is None

    def test_unknown_metric_gets_generic_fallback(self):
        r = BenchmarkResult(name="mystery", status="ok", score=2.0, pass_fail=False)
        callout = _get_callout("mystery", r)
        assert callout is not None
        assert "threshold" in callout.lower() or "coach" in callout.lower()

    def test_pass_fail_none_returns_none(self):
        r = BenchmarkResult(name="timing", status="ok", score=None, pass_fail=None)
        assert _get_callout("timing", r) is None


class TestCalloutSelection:
    def test_top_three_failures_only_and_low_conf_separated(self):
        poses = _make_full_pose_sequence(n=60, fps=30.0)
        phases = _make_phases(fps=30.0)
        report = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")
        # Force several failing metrics with varied confidence.
        target = [
            ("timing", 2.0, 0.9),
            ("swivel_stabilize", 1.0, 0.7),
            ("trunk_stability", 4.0, 0.95),
            ("front_knee_flexion_fs", 3.0, 0.8),
            ("front_knee_extension_rel", 2.5, 0.2),  # low confidence fail
        ]
        for name, score, conf in target:
            metric = report.metric_by_name(name)
            assert metric is not None
            metric.status = "ok"
            metric.score = score
            metric.pass_fail = False
            metric.confidence = conf

        callouts, low_conf = _select_phase_callouts(
            report,
            [
                "timing",
                "swivel_stabilize",
                "trunk_stability",
                "front_knee_flexion_fs",
                "front_knee_extension_rel",
            ],
            max_items=3,
        )
        assert len(callouts) == 3
        assert all((m.confidence or 0.0) >= 0.35 for m in callouts)
        assert any(m.name == "front_knee_extension_rel" for m in low_conf)

    def test_open_side_excludes_front_view_metrics_from_callouts(self):
        poses = _make_full_pose_sequence(n=60, fps=30.0)
        phases = _make_phases(fps=30.0)
        report = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")
        # Force torque into an "ok fail" state to verify it is still ignored.
        report.torque_retention.status = "ok"
        report.torque_retention.score = 0.0
        report.torque_retention.pass_fail = False
        report.torque_retention.confidence = 0.95

        callouts, low_conf = _select_phase_callouts(
            report,
            ["timing", "torque_retention", "front_knee_flexion_fs"],
            max_items=3,
        )
        names = {m.name for m in callouts + low_conf}
        assert "torque_retention" not in names


# ---------------------------------------------------------------------------
# Tests: _build_notes
# ---------------------------------------------------------------------------

class TestBuildNotes:
    def setup_method(self):
        self.fps = 30.0
        self.poses = _make_full_pose_sequence(n=60, fps=self.fps)
        self.phases = _make_phases(fps=self.fps)
        self.benchmarks = compute_benchmarks(
            self.poses, self.phases, hand="R", view_mode="open_side"
        )

    def test_json_structure(self):
        notes = _build_notes(self.benchmarks, self.phases)
        assert "efficiency_score" in notes
        assert "efficiency_low_confidence" in notes
        assert "hand" in notes
        assert "view_mode" in notes
        assert "metrics" in notes
        assert "phases" in notes
        assert "camera_limitations" in notes
        assert "official_metric_set" in notes
        assert "official_metrics" in notes
        assert "official_open_side_metrics_v1" in notes
        assert "excluded_metrics_reason" in notes

    def test_all_metrics_present(self):
        notes = _build_notes(self.benchmarks, self.phases)
        official = set(official_metric_names("open_side"))
        for name in official:
            assert name in notes["metrics"]
        # Debug-only metrics should be omitted by default in open_side notes.
        for name in ("balance", "posture", "lift_thrust", "tilt_consistency"):
            assert name not in notes["metrics"]

    def test_debug_metrics_flag_includes_full_metric_dump(self):
        notes = _build_notes(self.benchmarks, self.phases, include_debug_metrics=True)
        for m in self.benchmarks.all_metrics():
            assert m.name in notes["metrics"]

    def test_open_side_notes_have_locked_metric_set_name(self):
        notes = _build_notes(self.benchmarks, self.phases)
        assert notes["official_metric_set"] == "open_side_pro_v1"
        assert notes["official_metrics"] == list(official_metric_names("open_side"))
        assert notes["excluded_metrics_reason"]["stack_track"] == "front-view-only"
        assert notes["excluded_metrics_reason"]["balance"] == "debug-only"

    def test_metric_required_fields(self):
        notes = _build_notes(self.benchmarks, self.phases)
        for name, entry in notes["metrics"].items():
            assert "status" in entry
            assert "raw_value" in entry
            assert "unit" in entry
            assert "score" in entry
            assert "pass_fail" in entry
            assert "callout" in entry
            assert "confidence" in entry
            assert "low_confidence" in entry
            assert "coaching_cues" in entry

    def test_passing_metric_has_null_callout(self):
        notes = _build_notes(self.benchmarks, self.phases)
        for name, entry in notes["metrics"].items():
            if entry["pass_fail"] is True:
                assert entry["callout"] is None

    def test_failing_metric_has_string_callout(self):
        notes = _build_notes(self.benchmarks, self.phases)
        for name, entry in notes["metrics"].items():
            if entry["pass_fail"] is False and entry["status"] == "ok":
                assert isinstance(entry["callout"], str)

    def test_json_serialisable(self):
        notes = _build_notes(self.benchmarks, self.phases)
        json.dumps(notes)  # must not raise

    def test_phase_frames_correct(self):
        notes = _build_notes(self.benchmarks, self.phases)
        assert notes["phases"]["set"]["frame_idx"] == 0
        assert notes["phases"]["foot_strike"]["frame_idx"] == 30
        assert notes["phases"]["ball_release"]["frame_idx"] == 45


# ---------------------------------------------------------------------------
# Tests: _build_strip
# ---------------------------------------------------------------------------

class TestBuildStrip:
    def test_correct_height(self):
        frames = [_make_mock_frame(640, 480) for _ in range(4)]
        strip = _build_strip(frames, target_height=300)
        assert strip is not None
        assert strip.shape[0] == 300

    def test_width_is_sum_of_panels(self):
        frames = [_make_mock_frame(640, 480) for _ in range(4)]
        strip = _build_strip(frames, target_height=300)
        assert strip is not None
        # Each panel: 300 * (640/480) = 400
        expected_panel_w = int(300 * 640 / 480)
        assert strip.shape[1] == expected_panel_w * 4

    def test_one_none_frame_still_works(self):
        frames = [_make_mock_frame(640, 480), None,
                  _make_mock_frame(640, 480), _make_mock_frame(640, 480)]
        strip = _build_strip(frames, target_height=300)
        assert strip is not None
        assert strip.shape[0] == 300

    def test_all_none_returns_none(self):
        strip = _build_strip([None, None, None, None])
        assert strip is None


# ---------------------------------------------------------------------------
# Tests: _write_cliplet
# ---------------------------------------------------------------------------

class TestWriteCliplet:
    def test_valid_range_writes_frames(self):
        poses = _make_full_pose_sequence(n=60)

        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "clip.mp4"
            fake_video = Path(tmpdir) / "fake.mp4"
            fake_video.touch()

            with mock.patch("src.mechanics.coach_pack.cv2") as mock_cv2:
                mock_cap = MockVideoCapture(str(fake_video))
                mock_writer = MockVideoWriter()
                mock_cv2.VideoCapture.return_value = mock_cap
                mock_cv2.VideoWriter.return_value = mock_writer
                mock_cv2.VideoWriter_fourcc.return_value = 0x7634706D

                ok = _write_cliplet(fake_video, 10, 20, out_path, 30.0, poses, overlay_cb=None)

            assert ok is True
            assert mock_writer._frames_written == 10

    def test_empty_range_returns_false(self):
        poses = _make_full_pose_sequence(n=60)
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "clip.mp4"
            ok = _write_cliplet(Path("/nonexistent.mp4"), 10, 10, out_path, 30.0, poses, overlay_cb=None)
            assert ok is False

    def test_bad_video_returns_false(self):
        poses = _make_full_pose_sequence(n=60)
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "clip.mp4"

            with mock.patch("src.mechanics.coach_pack.cv2") as mock_cv2:
                mock_cap = mock.MagicMock()
                mock_cap.isOpened.return_value = False
                mock_cv2.VideoCapture.return_value = mock_cap

                ok = _write_cliplet(Path("/nonexistent.mp4"), 0, 10, out_path, 30.0, poses, overlay_cb=None)

            assert ok is False


# ---------------------------------------------------------------------------
# Tests: build_coach_pack (integration, mocked video)
# ---------------------------------------------------------------------------

class TestBuildCoachPack:
    def setup_method(self):
        self.fps = 30.0
        self.poses = _make_full_pose_sequence(n=60, fps=self.fps)
        self.phases = _make_phases(fps=self.fps)
        self.benchmarks = compute_benchmarks(
            self.poses, self.phases, hand="R", view_mode="open_side"
        )

    def _run_coach_pack(self, phases=None, hand="R"):
        """Run build_coach_pack with mocked cv2 in a temp directory.

        Returns (result, notes_content) where notes_content is the parsed
        notes.json (read before the temp dir is cleaned up).
        """
        if phases is None:
            phases = self.phases

        with tempfile.TemporaryDirectory() as tmpdir:
            out_dir = Path(tmpdir)
            fake_video = out_dir / "fake.mp4"
            fake_video.touch()

            with mock.patch("src.mechanics.coach_pack.cv2") as mock_cv2:
                # Mock VideoCapture
                mock_cap = MockVideoCapture(str(fake_video), frame_count=60)
                mock_cv2.VideoCapture.return_value = mock_cap

                # Mock VideoWriter
                mock_writer = MockVideoWriter()
                mock_cv2.VideoWriter.return_value = mock_writer
                mock_cv2.VideoWriter_fourcc.return_value = 0x7634706D

                # Mock drawing functions to be pass-through
                mock_cv2.line = lambda *a, **kw: None
                mock_cv2.circle = lambda *a, **kw: None
                mock_cv2.rectangle = lambda *a, **kw: None
                mock_cv2.arrowedLine = lambda *a, **kw: None
                mock_cv2.putText = lambda *a, **kw: None
                mock_cv2.getTextSize = lambda *a, **kw: ((100, 20), 5)
                mock_cv2.resize = lambda img, size: np.zeros((size[1], size[0], 3), dtype=np.uint8)
                mock_cv2.imwrite = lambda path, img: True
                mock_cv2.LINE_AA = 16
                mock_cv2.FONT_HERSHEY_SIMPLEX = 0
                mock_cv2.CAP_PROP_POS_FRAMES = 1
                mock_cv2.CAP_PROP_FRAME_WIDTH = 3
                mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
                mock_cv2.CAP_PROP_FPS = 5
                mock_cv2.CAP_PROP_FRAME_COUNT = 7
                mock_cv2.COLOR_BGR2RGB = 4

                benchmarks = compute_benchmarks(
                    self.poses, phases, hand=hand, view_mode="open_side"
                )
                result = build_coach_pack(
                    fake_video, self.poses, phases, benchmarks, out_dir
                )

            # Read notes.json before temp dir cleanup
            notes_content = None
            if result.notes_json is not None and result.notes_json.exists():
                with open(result.notes_json) as f:
                    notes_content = json.load(f)

            return result, notes_content

    def test_coach_pack_dir_correct(self):
        result, _ = self._run_coach_pack()
        assert result.coach_pack_dir.name == "coach_pack"

    def test_notes_json_created(self):
        result, notes = self._run_coach_pack()
        assert result.notes_json is not None
        assert notes is not None
        assert "metrics" in notes
        assert "phases" in notes

    def test_missing_phase_skips_cliplet(self):
        """If foot_strike is None, set_to_fs cliplet should be None."""
        phases = PitchPhases(
            set_pos=_make_phase("set", 0),
            first_movement=None,
            peak_leg_lift=_make_phase("peak_leg_lift", 18),
            foot_strike=None,
            ball_release=_make_phase("ball_release", 45),
            fps=30.0,
        )
        result, _ = self._run_coach_pack(phases=phases)
        assert result.set_to_fs_mp4 is None
        assert result.fs_to_release_mp4 is None

    def test_lhp_same_file_set(self):
        """LHP should produce the same set of output files as RHP."""
        result_r, _ = self._run_coach_pack(hand="R")
        result_l, _ = self._run_coach_pack(hand="L")
        # Both should have notes.json
        assert result_r.notes_json is not None
        assert result_l.notes_json is not None


# ---------------------------------------------------------------------------
# Tests: PHASE_METRICS mapping
# ---------------------------------------------------------------------------

class TestPhaseMetrics:
    def test_all_phases_have_entries(self):
        for phase in ["set", "peak_leg_lift", "foot_strike", "ball_release"]:
            assert phase in PHASE_METRICS

    def test_no_duplicate_metrics_across_phases(self):
        """Each metric should appear in at most one phase."""
        seen = set()
        for phase, metrics in PHASE_METRICS.items():
            for m in metrics:
                assert m not in seen, f"{m} appears in multiple phases"
                seen.add(m)

    def test_open_side_phase_mapping_excludes_front_view_only_metrics(self):
        poses = _make_full_pose_sequence(n=60, fps=30.0)
        phases = _make_phases(fps=30.0)
        report = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")
        fs_metrics = _get_relevant_metrics("foot_strike", report)
        rel_metrics = _get_relevant_metrics("ball_release", report)
        assert "torque_retention" not in fs_metrics
        assert "stack_track" not in rel_metrics
        assert "balance" not in rel_metrics
        assert "posture" not in rel_metrics

    def test_debug_phase_mapping_allows_debug_metrics(self):
        poses = _make_full_pose_sequence(n=60, fps=30.0)
        phases = _make_phases(fps=30.0)
        report = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")
        rel_metrics = _get_relevant_metrics("ball_release", report, include_debug_metrics=True)
        assert "balance" in rel_metrics
        assert "posture" in rel_metrics
        assert "tilt_consistency" in rel_metrics
