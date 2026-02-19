from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest_manual.clipper_ui import scrub_x_to_frame


def test_scrub_x_to_frame_exact_positions():
    assert scrub_x_to_frame(100, 100, 1100, 1001) == 0
    assert scrub_x_to_frame(600, 100, 1100, 1001) == 500
    assert scrub_x_to_frame(1100, 100, 1100, 1001) == 1000


def test_scrub_x_to_frame_clamps_out_of_bounds():
    assert scrub_x_to_frame(0, 100, 1100, 301) == 0
    assert scrub_x_to_frame(5000, 100, 1100, 301) == 300
