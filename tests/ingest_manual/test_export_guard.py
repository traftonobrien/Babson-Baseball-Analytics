from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import src.ingest_manual.export as export_mod
from src.ingest_manual.export import export_manual_clips


def test_export_keeps_only_first_three_ordered_angles_per_pitch(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    manual_path = tmp_path / "manual_clips.json"
    payload = {
        "source_video": "/tmp/source.mov",
        "player": "Trafton OBrien",
        "session": "all_angles_test",
        "fps": 30.0,
        "width": 1280,
        "height": 720,
        "clips": [
            {"pitch_idx": 1, "angle": "behind", "start_frame": 30, "end_frame": 59, "order": 2},
            {"pitch_idx": 1, "angle": "extra", "start_frame": 60, "end_frame": 90, "order": 4},
            {"pitch_idx": 1, "angle": "home_plate_front", "start_frame": 0, "end_frame": 29, "order": 1},
            {"pitch_idx": 1, "angle": "open_side", "start_frame": 91, "end_frame": 130, "order": 3},
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
    assert len(commands) == 3

    with open(index_path) as f:
        index = json.load(f)
    assert len(index["clips"]) == 1
    row = index["clips"][0]
    assert set(row["angles"].keys()) == {"home_plate_front", "behind", "open_side"}
    assert "extra" not in row["angles"]
