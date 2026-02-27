from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from unittest import mock

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from scripts.mechanics_coach_pack import (
    _derive_slowmo_factor,
    _top_issues,
    _write_hold_review_video,
    _resolve_path,
    _write_manual_template,
)
from src.mechanics.benchmarks import compute_benchmarks
from src.mechanics.phases import Phase, PitchPhases
from src.mechanics.pose import KP, NUM_LANDMARKS, PoseResult


def _make_mock_frame(width: int = 640, height: int = 360) -> np.ndarray:
    return np.zeros((height, width, 3), dtype=np.uint8)


class MockVideoCapture:
    def __init__(self, path: str, width: int = 640, height: int = 360, frame_count: int = 30, fps: float = 10.0):
        self._width = width
        self._height = height
        self._frame_count = frame_count
        self._fps = fps
        self._pos = 0
        self._opened = True

    def isOpened(self):
        return self._opened

    def get(self, prop):
        if prop == 3:
            return float(self._width)
        if prop == 4:
            return float(self._height)
        if prop == 5:
            return float(self._fps)
        if prop == 7:
            return float(self._frame_count)
        return 0.0

    def read(self):
        if self._pos >= self._frame_count:
            return False, None
        frame = _make_mock_frame(self._width, self._height)
        self._pos += 1
        return True, frame

    def release(self):
        self._opened = False


class MockVideoWriter:
    def __init__(self, *args, **kwargs):
        self._frames_written = 0
        self._opened = True

    def isOpened(self):
        return self._opened

    def write(self, frame):
        self._frames_written += 1

    def release(self):
        self._opened = False


def _base_lm(vis: float = 0.9) -> np.ndarray:
    lm = np.zeros((NUM_LANDMARKS, 3), dtype=np.float32)
    lm[:, 0] = 0.5
    lm[:, 1] = 0.5
    lm[:, 2] = vis
    return lm


def _make_pose(frame_idx: int, lm: np.ndarray | None = None) -> PoseResult:
    if lm is None:
        lm = _base_lm()
    return PoseResult(frame_idx=frame_idx, landmarks=lm.copy(), width=640, height=360)


def _phase(name: str, frame_idx: int, fps: float = 10.0) -> Phase:
    return Phase(name=name, frame_idx=frame_idx, time_s=frame_idx / fps, confidence=0.9)


def _phases() -> PitchPhases:
    return PitchPhases(
        set_pos=_phase("set", 2),
        first_movement=_phase("first_movement", 2),
        peak_leg_lift=_phase("peak_leg_lift", 6),
        most_loaded=None,
        foot_strike=_phase("foot_strike", 10),
        weight_bearing=None,
        arm_flip_up=None,
        ball_release=_phase("ball_release", 14),
        fps=10.0,
    )


def _simple_poses(n: int = 30) -> list[PoseResult]:
    out: list[PoseResult] = []
    for i in range(n):
        lm = _base_lm()
        # Slight wrist drift to keep metrics computable.
        lm[KP["LEFT_WRIST"], 0] = 0.45
        lm[KP["RIGHT_WRIST"], 0] = min(0.9, 0.45 + i * 0.01)
        lm[KP["LEFT_SHOULDER"], 0] = 0.35
        lm[KP["RIGHT_SHOULDER"], 0] = 0.65
        lm[KP["LEFT_HIP"], 0] = 0.40
        lm[KP["RIGHT_HIP"], 0] = 0.60
        lm[KP["LEFT_ANKLE"], 1] = 0.80
        lm[KP["RIGHT_ANKLE"], 1] = 0.80
        out.append(_make_pose(i, lm))
    return out


def test_resolve_path_supports_repo_relative_inputs():
    resolved = _resolve_path("scripts/mechanics_coach_pack.py")
    assert resolved.is_absolute()
    assert resolved.exists()
    assert resolved.name == "mechanics_coach_pack.py"


def test_write_manual_template_creates_expected_schema(tmp_path: Path):
    out_dir = tmp_path / "output" / "mechanics" / "player" / "clip"
    out_dir.mkdir(parents=True, exist_ok=True)
    template_path = _write_manual_template(out_dir, hand="R", view_mode="open_side")
    assert template_path.exists()

    with open(template_path) as f:
        data = json.load(f)
    assert data["schema_version"] == 1
    assert data["view_mode"] == "open_side"
    assert "manual_measurements" in data
    assert "front_knee_flexion_fs_deg" in data["manual_measurements"]


def test_merge_manual_script_writes_manual_key(tmp_path: Path):
    clip_dir = tmp_path / "output" / "mechanics" / "player" / "clip"
    notes_dir = clip_dir / "coach_pack"
    notes_dir.mkdir(parents=True, exist_ok=True)

    manual = {
        "schema_version": 1,
        "view_mode": "open_side",
        "hand": "R",
        "manual_measurements": {
            "front_knee_flexion_fs_deg": 48.0,
            "front_knee_flexion_rel_deg": 26.0,
            "front_knee_bracing_delta_deg": 22.0,
            "trunk_tilt_rel_deg": 14.5,
            "stride_estimate_pct_height": 86.0,
        },
        "notes": ["Looks better from stretch than windup."],
    }
    with open(clip_dir / "manual_template.json", "w") as f:
        json.dump(manual, f)

    base_notes = {"efficiency_score": 7.4, "metrics": {}, "phases": {}}
    notes_path = notes_dir / "notes.json"
    with open(notes_path, "w") as f:
        json.dump(base_notes, f)

    script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "mechanics_merge_manual.py"
    cmd = [sys.executable, str(script_path), "--clip-dir", str(clip_dir)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stderr

    with open(notes_path) as f:
        merged = json.load(f)
    assert "manual" in merged
    assert merged["manual"]["manual_measurements"]["front_knee_bracing_delta_deg"] == 22.0


def test_derive_slowmo_factor_exact_ratio_case():
    factor = _derive_slowmo_factor(
        original_total_frames=100,
        slowmo_total_frames=400,
        original_fps=30.0,
        slowmo_fps=30.0,
    )
    assert factor == 4.0


def test_derive_slowmo_factor_fuzzy_ratio_case():
    factor = _derive_slowmo_factor(
        original_total_frames=120,
        slowmo_total_frames=478,
        original_fps=30.0,
        slowmo_fps=30.0,
    )
    assert factor == pytest.approx(478 / 120, abs=0.03)


def test_hold_review_adds_expected_hold_frames():
    poses = _simple_poses(30)
    phases = _phases()
    benchmarks = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")

    with tempfile.TemporaryDirectory() as tmpdir:
        fake_video = Path(tmpdir) / "slowmo_review.mp4"
        fake_video.touch()
        out_path = Path(tmpdir) / "hold_review.mp4"

        with mock.patch("scripts.mechanics_coach_pack.cv2") as mock_cv2:
            mock_cap = MockVideoCapture(str(fake_video), frame_count=30, fps=10.0)
            mock_writer = MockVideoWriter()
            mock_cv2.VideoCapture.return_value = mock_cap
            mock_cv2.VideoWriter.return_value = mock_writer
            mock_cv2.VideoWriter_fourcc.return_value = 0x7634706D
            mock_cv2.CAP_PROP_FRAME_WIDTH = 3
            mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
            mock_cv2.CAP_PROP_FPS = 5
            mock_cv2.CAP_PROP_FRAME_COUNT = 7
            mock_cv2.LINE_AA = 16
            mock_cv2.FONT_HERSHEY_SIMPLEX = 0
            mock_cv2.line = lambda *a, **kw: None
            mock_cv2.circle = lambda *a, **kw: None
            mock_cv2.rectangle = lambda *a, **kw: None
            mock_cv2.putText = lambda *a, **kw: None
            mock_cv2.getTextSize = lambda *a, **kw: ((120, 20), 5)
            mock_cv2.addWeighted = lambda src1, alpha, src2, beta, gamma, dst=None: dst if dst is not None else src1

            out = _write_hold_review_video(
                slowmo_path=fake_video,
                out_path=out_path,
                poses=poses,
                phases=phases,
                benchmarks=benchmarks,
                original_total_frames=30,
                original_fps=10.0,
                hold_seconds=2.0,
            )

        assert out == out_path
        base_frames = 30
        hold_frames = round(10.0 * 2.0)
        assert mock_writer._frames_written == base_frames + hold_frames * 4


def test_hold_review_invokes_phase_card_hook_for_each_breakpoint():
    poses = _simple_poses(30)
    phases = _phases()
    benchmarks = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")
    calls: list[tuple[str, int]] = []

    with tempfile.TemporaryDirectory() as tmpdir:
        fake_video = Path(tmpdir) / "slowmo_review.mp4"
        fake_video.touch()
        out_path = Path(tmpdir) / "hold_review.mp4"

        with mock.patch("scripts.mechanics_coach_pack.cv2") as mock_cv2:
            mock_cap = MockVideoCapture(str(fake_video), frame_count=30, fps=10.0)
            mock_writer = MockVideoWriter()
            mock_cv2.VideoCapture.return_value = mock_cap
            mock_cv2.VideoWriter.return_value = mock_writer
            mock_cv2.VideoWriter_fourcc.return_value = 0x7634706D
            mock_cv2.CAP_PROP_FRAME_WIDTH = 3
            mock_cv2.CAP_PROP_FRAME_HEIGHT = 4
            mock_cv2.CAP_PROP_FPS = 5
            mock_cv2.CAP_PROP_FRAME_COUNT = 7
            mock_cv2.LINE_AA = 16
            mock_cv2.FONT_HERSHEY_SIMPLEX = 0
            mock_cv2.line = lambda *a, **kw: None
            mock_cv2.circle = lambda *a, **kw: None
            mock_cv2.rectangle = lambda *a, **kw: None
            mock_cv2.putText = lambda *a, **kw: None
            mock_cv2.getTextSize = lambda *a, **kw: ((120, 20), 5)
            mock_cv2.addWeighted = lambda src1, alpha, src2, beta, gamma, dst=None: dst if dst is not None else src1

            _write_hold_review_video(
                slowmo_path=fake_video,
                out_path=out_path,
                poses=poses,
                phases=phases,
                benchmarks=benchmarks,
                original_total_frames=30,
                original_fps=10.0,
                hold_seconds=2.0,
                phase_card_hook=lambda phase_key, idx: calls.append((phase_key, idx)),
            )

    assert calls == [
        ("set", 2),
        ("peak_leg_lift", 6),
        ("foot_strike", 10),
        ("ball_release", 14),
    ]


def test_top_issues_excludes_debug_only_metrics_in_open_side():
    poses = _simple_poses(30)
    phases = _phases()
    report = compute_benchmarks(poses, phases, hand="R", view_mode="open_side")

    # Force excluded metrics to look very bad.
    for name in ("balance", "posture", "lift_thrust", "tilt_consistency", "trunk_stability", "release_extension_proxy"):
        m = report.metric_by_name(name)
        assert m is not None
        m.status = "ok"
        m.score = 0.0
        m.pass_fail = False
        m.confidence = 0.95

    # Ensure at least one official metric fails.
    timing = report.metric_by_name("timing")
    assert timing is not None
    timing.status = "ok"
    timing.score = 2.0
    timing.pass_fail = False
    timing.confidence = 0.95

    issues = _top_issues(report, limit=5)
    names = {item["metric"] for item in issues}
    assert "timing" in names
    assert "balance" not in names
    assert "posture" not in names
    assert "lift_thrust" not in names
    assert "tilt_consistency" not in names
    assert "trunk_stability" not in names
    assert "release_extension_proxy" not in names
