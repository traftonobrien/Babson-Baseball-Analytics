"""Tests for scripts/mechanics_validate.py."""
from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT = REPO_ROOT / "scripts" / "mechanics_validate.py"
TEMPLATE = REPO_ROOT / "tests" / "mechanics" / "manual_phases_template.json"


def _run(args: list[str], *, check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        check=check,
        cwd=str(REPO_ROOT),
    )


class TestLoadLabels:
    """_load_labels should parse the JSON and return clip entries."""

    def test_parses_template(self):
        sys.path.insert(0, str(REPO_ROOT))
        from scripts.mechanics_validate import _load_labels

        clips = _load_labels(TEMPLATE)
        assert isinstance(clips, list)
        assert len(clips) == 1
        assert clips[0]["hand"] == "R"

    def test_parses_custom_labels(self, tmp_path: Path):
        sys.path.insert(0, str(REPO_ROOT))
        from scripts.mechanics_validate import _load_labels

        labels = {
            "clips": [
                {"clip_path": "a.mp4", "hand": "L", "fps": 60.0, "phases": {}},
                {"clip_path": "b.mp4", "hand": "R", "fps": 30.0, "phases": {}},
            ]
        }
        f = tmp_path / "labels.json"
        f.write_text(json.dumps(labels))
        clips = _load_labels(f)
        assert len(clips) == 2
        assert clips[0]["hand"] == "L"

    def test_empty_clips_key(self, tmp_path: Path):
        sys.path.insert(0, str(REPO_ROOT))
        from scripts.mechanics_validate import _load_labels

        f = tmp_path / "empty.json"
        f.write_text(json.dumps({"clips": []}))
        assert _load_labels(f) == []

    def test_missing_clips_key(self, tmp_path: Path):
        sys.path.insert(0, str(REPO_ROOT))
        from scripts.mechanics_validate import _load_labels

        f = tmp_path / "no_clips.json"
        f.write_text(json.dumps({"other": "data"}))
        assert _load_labels(f) == []


class TestScriptExitCodes:
    """End-to-end smoke tests via subprocess."""

    def test_template_exits_zero(self):
        """Template has a placeholder clip that won't exist — script should still exit 0."""
        result = _run(["--labels", str(TEMPLATE)])
        assert result.returncode == 0
        assert "PASSED" in result.stdout

    def test_empty_clips_exits_zero(self, tmp_path: Path):
        """Labels file with no clips should print a message and exit 0."""
        f = tmp_path / "empty.json"
        f.write_text(json.dumps({"clips": []}))
        result = _run(["--labels", str(f)])
        assert result.returncode == 0
        assert "No labeled clips" in result.stdout

    def test_missing_file_exits_nonzero(self, tmp_path: Path):
        result = _run(["--labels", str(tmp_path / "nonexistent.json")], check=False)
        assert result.returncode != 0

    def test_all_clips_skipped_still_passes(self, tmp_path: Path):
        """All clips missing on disk → all skipped → PASSED (no errors to fail on)."""
        labels = {
            "clips": [
                {
                    "clip_path": "/nonexistent/clip1.mp4",
                    "hand": "R",
                    "fps": 30.0,
                    "phases": {
                        "foot_strike": {"frame_idx": 40, "notes": ""},
                    },
                },
            ]
        }
        f = tmp_path / "labels.json"
        f.write_text(json.dumps(labels))
        result = _run(["--labels", str(f)])
        assert result.returncode == 0
        assert "SKIP" in result.stdout
        assert "PASSED" in result.stdout

    def test_verbose_flag_accepted(self):
        result = _run(["--labels", str(TEMPLATE), "--verbose"])
        assert result.returncode == 0
