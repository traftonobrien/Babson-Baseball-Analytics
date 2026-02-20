from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import scripts.run_mechanics_session as session_mod


def _base_args(tmp_path: Path) -> argparse.Namespace:
    return argparse.Namespace(
        outdir=str(tmp_path / "output" / "mechanics"),
        hand="R",
        slowmo=False,
        hold_review=False,
        debug_metrics=False,
        view="open_side",
        verbose=False,
    )


def test_open_side_candidate_selection_ignores_non_open_side(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    front_clip = tmp_path / "front.mp4"
    open_clip = tmp_path / "open_side.mp4"
    front_clip.touch()
    open_clip.touch()

    candidates = [
        {
            "clip_id": "front_1",
            "angle_class": "behind_home",
            "clip_path_abs": str(front_clip.resolve()),
            "confidence": 0.95,
            "fps": 30.0,
            "width": 1280,
            "height": 720,
        },
        {
            "clip_id": "open_1",
            "angle_class": "open_side_RHP",
            "clip_path_abs": str(open_clip.resolve()),
            "confidence": 0.70,
            "fps": 30.0,
            "width": 1280,
            "height": 720,
        },
    ]

    monkeypatch.setattr(session_mod, "_estimate_visibility_score", lambda _path: 0.85)

    chosen, _score, _vis, view_mode = session_mod._choose_best_open_side_candidate(
        candidates=candidates,
        hand="R",
    )
    assert chosen["clip_id"] == "open_1"
    assert view_mode == "open_side"


def test_select_open_side_manual_angle_falls_back_to_order_three():
    pitch_row = {
        "pitch_idx": 7,
        "angles": {
            "home_plate_front": {"path": "clips/pitch_007/home_plate_front.mp4", "order": 1},
            "behind": {"path": "clips/pitch_007/behind.mp4", "order": 2},
            "legacy_unknown": {"path": "clips/pitch_007/legacy_unknown.mp4", "order": 3},
        },
    }
    assert session_mod._select_open_side_manual_angle(pitch_row) == "legacy_unknown"


def test_manual_session_skips_pitch_when_open_side_missing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    args = _base_args(tmp_path)
    manual_index_path = tmp_path / "ingest" / "index.json"
    manual_index_path.parent.mkdir(parents=True, exist_ok=True)

    front_clip_rel = "clips/pitch_001/home_plate_front.mp4"
    front_clip_abs = manual_index_path.parent / front_clip_rel
    front_clip_abs.parent.mkdir(parents=True, exist_ok=True)
    front_clip_abs.touch()

    manual_index = {
        "player": "Trafton OBrien",
        "session": "all_angles_test",
        "source_video": "/tmp/all_angles.mov",
        "clips": [
            {
                "pitch_idx": 1,
                "angles": {
                    "home_plate_front": {"path": front_clip_rel, "start_frame": 100, "end_frame": 180, "order": 1},
                    "behind": {"path": "clips/pitch_001/behind.mp4", "start_frame": 220, "end_frame": 300, "order": 2},
                },
            }
        ],
    }

    def _should_not_run(*_args, **_kwargs):
        raise AssertionError("Mechanics should not run when open_side is missing.")

    monkeypatch.setattr(session_mod, "_run_mechanics_for_clip", _should_not_run)
    monkeypatch.setattr(session_mod, "_top_issues", lambda *_args, **_kwargs: [])

    session_mod._run_from_manual_index(args, manual_index_path=manual_index_path, manual_index=manual_index)

    session_index_path = (
        Path(args.outdir) / "trafton_obrien" / "all_angles_test" / "index.json"
    )
    with open(session_index_path) as f:
        session_index = json.load(f)

    row = session_index["pitches"][0]
    assert row["status"] == "skipped_missing_open_side"
    assert row["reason"] == "open_side_clip_not_found"
    assert "home_plate_front" in row["available_angles"]


def test_manual_session_uses_open_side_when_available(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    args = _base_args(tmp_path)
    manual_index_path = tmp_path / "ingest" / "index.json"
    manual_index_path.parent.mkdir(parents=True, exist_ok=True)

    open_rel = "clips/pitch_001/open_side.mp4"
    front_rel = "clips/pitch_001/home_plate_front.mp4"
    open_abs = manual_index_path.parent / open_rel
    front_abs = manual_index_path.parent / front_rel
    open_abs.parent.mkdir(parents=True, exist_ok=True)
    open_abs.touch()
    front_abs.touch()

    manual_index = {
        "player": "Trafton OBrien",
        "session": "all_angles_test",
        "source_video": "/tmp/all_angles.mov",
        "clips": [
            {
                "pitch_idx": 1,
                "angles": {
                    "home_plate_front": {"path": front_rel, "start_frame": 20, "end_frame": 80, "order": 1},
                    "open_side": {"path": open_rel, "start_frame": 100, "end_frame": 180, "order": 3},
                },
            }
        ],
    }

    called_paths: list[Path] = []

    class _FakeBench:
        efficiency_score = 7.9
        efficiency_low_confidence = False

    def _fake_run(clip_path: Path, **_kwargs):
        called_paths.append(Path(clip_path))
        return {
            "benchmarks": _FakeBench(),
            "phases": None,
            "benchmarks_json": str(tmp_path / "benchmarks.json"),
            "coach_pack_dir": str(tmp_path / "coach_pack"),
            "notes_json": str(tmp_path / "notes.json"),
            "slowmo_review_mp4": None,
            "hold_review_mp4": None,
        }

    monkeypatch.setattr(session_mod, "_run_mechanics_for_clip", _fake_run)
    monkeypatch.setattr(session_mod, "_top_issues", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(session_mod, "_estimate_visibility_score", lambda _path: 0.75)

    session_mod._run_from_manual_index(args, manual_index_path=manual_index_path, manual_index=manual_index)

    assert called_paths, "Expected mechanics run on open_side clip."
    assert called_paths[0].name == "open_side.mp4"

    session_index_path = (
        Path(args.outdir) / "trafton_obrien" / "all_angles_test" / "index.json"
    )
    with open(session_index_path) as f:
        session_index = json.load(f)
    row = session_index["pitches"][0]
    assert row["status"] == "ok"
    assert row["chosen_angle"] == "open_side"
    assert row["chosen_view_mode"] == "open_side"
