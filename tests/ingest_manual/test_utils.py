from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest_manual.utils import build_manual_index, choose_preferred_angle


def test_preferred_angle_selection_priority():
    assert choose_preferred_angle(["front", "open_side", "back"]) == "open_side"
    assert choose_preferred_angle(["center", "back"]) == "back"
    assert choose_preferred_angle(["unknown"]) == "unknown"


def test_manual_index_groups_clips_by_pitch_idx():
    clips = [
        {"pitch_idx": 1, "angle": "front", "start_frame": 100, "end_frame": 200, "path": "clips/pitch_001/front.mp4"},
        {"pitch_idx": 1, "angle": "open_side", "start_frame": 220, "end_frame": 330, "path": "clips/pitch_001/open_side.mp4"},
        {"pitch_idx": 2, "angle": "center", "start_frame": 500, "end_frame": 610, "path": "clips/pitch_002/center.mp4"},
    ]
    idx = build_manual_index(
        source_video="/tmp/all_angles.mov",
        player="Trafton OBrien",
        session="all_angles_test",
        clips=clips,
    )
    assert len(idx["clips"]) == 2
    row1 = idx["clips"][0]
    row2 = idx["clips"][1]
    assert row1["pitch_idx"] == 1
    assert row1["preferred_angle"] == "open_side"
    assert "front" in row1["angles"] and "open_side" in row1["angles"]
    assert row2["pitch_idx"] == 2
    assert row2["preferred_angle"] == "center"

