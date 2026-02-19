from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest_manual.clipper_ui import ManualClipperUI, auto_angle_for_order
from src.ingest_manual.schema import ManualClipsDoc


def _stub_ui(pitch_idx: int = 1) -> ManualClipperUI:
    ui = ManualClipperUI.__new__(ManualClipperUI)
    ui.doc = ManualClipsDoc(
        source_video="/tmp/all_angles.mov",
        player="Pitcher",
        session="session",
        fps=30.0,
        width=1280,
        height=720,
        clips=[],
    )
    ui.current_pitch_idx = pitch_idx
    ui.pitch_clip_counts = {}
    ui.start_marker = 100
    ui.end_marker = 140
    ui.dirty = False
    ui.last_message = ""
    ui._safe_write = lambda: None
    return ui


def test_auto_angle_for_order_mapping():
    assert auto_angle_for_order(1) == "home_plate_front"
    assert auto_angle_for_order(2) == "behind"
    assert auto_angle_for_order(3) == "open_side"
    assert auto_angle_for_order(4) is None


def test_commit_assigns_angle_by_pitch_order():
    ui = _stub_ui()

    ui._commit_clip()
    assert ui.doc.clips[-1].angle == "home_plate_front"
    assert ui.doc.clips[-1].order == 1

    ui.start_marker = 200
    ui.end_marker = 250
    ui._commit_clip()
    assert ui.doc.clips[-1].angle == "behind"
    assert ui.doc.clips[-1].order == 2

    ui.start_marker = 300
    ui.end_marker = 360
    ui._commit_clip()
    assert ui.doc.clips[-1].angle == "open_side"
    assert ui.doc.clips[-1].order == 3
