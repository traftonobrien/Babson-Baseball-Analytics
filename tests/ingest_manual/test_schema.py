from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.ingest_manual.schema import manual_doc_from_dict, validate_manual_clips_dict


def _valid_payload() -> dict:
    return {
        "source_video": "/tmp/all_angles.mov",
        "player": "Trafton OBrien",
        "session": "all_angles_test",
        "fps": 30.0,
        "width": 1280,
        "height": 720,
        "clips": [
            {
                "pitch_idx": 1,
                "angle": "open_side",
                "start_frame": 120,
                "end_frame": 240,
            }
        ],
    }


def test_schema_valid_payload_parses():
    payload = _valid_payload()
    validate_manual_clips_dict(payload)
    doc = manual_doc_from_dict(payload)
    assert doc.player == "Trafton OBrien"
    assert len(doc.clips) == 1
    assert doc.clips[0].end_frame == 240


def test_schema_missing_required_field_raises():
    payload = _valid_payload()
    payload.pop("fps")
    with pytest.raises(ValueError, match="missing required field: fps"):
        validate_manual_clips_dict(payload)


def test_schema_end_must_be_greater_than_start():
    payload = _valid_payload()
    payload["clips"][0]["end_frame"] = 100
    with pytest.raises(ValueError, match="end_frame must be greater than start_frame"):
        validate_manual_clips_dict(payload)

