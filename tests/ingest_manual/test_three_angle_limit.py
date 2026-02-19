from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest_manual.clipper_ui import ManualClipperUI
from src.ingest_manual.schema import ManualClipsDoc


def _stub_ui_with_three_clips() -> ManualClipperUI:
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
    ui.current_pitch_idx = 5
    ui.pitch_clip_counts = {5: 3}
    ui.start_marker = 120
    ui.end_marker = 170
    ui.dirty = False
    ui.last_message = ""
    ui._safe_write = lambda: None
    return ui


def test_fourth_commit_is_blocked_for_same_pitch():
    ui = _stub_ui_with_three_clips()
    ui._commit_clip()
    assert len(ui.doc.clips) == 0
    assert ui.last_message == "Commit blocked: only 3 angles allowed (front/behind/open-side)."


def test_clip_ready_false_when_pitch_limit_reached():
    ui = _stub_ui_with_three_clips()
    assert ui._clip_ready() is False
