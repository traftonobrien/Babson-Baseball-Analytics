from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import src.ingest_manual.export as export_mod
from src.ingest_manual.export import export_manual_clips, frame_range_to_timestamps


def test_frame_range_to_timestamps_math():
    start_s, end_s = frame_range_to_timestamps(start_frame=30, end_frame=59, fps=30.0)
    assert start_s == pytest.approx(1.0)
    assert end_s == pytest.approx(2.0)


def test_export_manual_clips_uses_expected_ffmpeg_timestamps(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    manual_path = tmp_path / "manual_clips.json"
    payload = {
        "source_video": "/tmp/source.mov",
        "player": "Trafton OBrien",
        "session": "all_angles_test",
        "fps": 30.0,
        "width": 1280,
        "height": 720,
        "clips": [
            {
                "pitch_idx": 1,
                "angle": "open_side",
                "start_frame": 30,
                "end_frame": 59,
            },
            {
                "pitch_idx": 1,
                "angle": "front",
                "start_frame": 90,
                "end_frame": 149,
            },
        ],
    }
    with open(manual_path, "w") as f:
        json.dump(payload, f, indent=2)

    commands: list[list[str]] = []

    def fake_runner(cmd, check, capture_output):
        commands.append(list(cmd))
        return subprocess.CompletedProcess(cmd, 0, b"", b"")

    monkeypatch.setattr(export_mod.shutil, "which", lambda name: "/usr/bin/ffmpeg")

    index_path = export_manual_clips(
        manual_clips_path=manual_path,
        out_root=tmp_path / "output",
        overwrite=True,
        keep_audio=False,
        runner=fake_runner,
    )
    assert index_path.exists()
    assert len(commands) == 2

    first = commands[0]
    assert "-ss" in first and "-t" in first
    ss = first[first.index("-ss") + 1]
    dur = first[first.index("-t") + 1]
    assert ss == "1.000"
    assert dur == "1.000"

    with open(index_path) as f:
        idx = json.load(f)
    assert len(idx["clips"]) == 1
    assert idx["clips"][0]["preferred_angle"] == "open_side"
    assert "front" in idx["clips"][0]["angles"]
    assert "open_side" in idx["clips"][0]["angles"]

