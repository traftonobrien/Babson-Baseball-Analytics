from __future__ import annotations
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import scripts.run_mechanics_batch as batch_mod


def test_parse_filter_tokens_supports_repeat_and_csv():
    tokens = batch_mod._parse_filter_tokens(["burk_bobby,langan", "  Vinny  "])
    assert tokens == ["burkbobby", "langan", "vinny"]


def test_discover_video_prefers_last_name_and_mp4(tmp_path: Path):
    player_dir = tmp_path / "Anthony LaPierre"
    player_dir.mkdir(parents=True, exist_ok=True)

    (player_dir / "LaPierre Mechanics.mov").touch()
    (player_dir / "LaPierre Mechanics.mp4").touch()
    (player_dir / "misc_mechanics.mp4").touch()

    chosen, attempts, candidates = batch_mod._discover_video(player_dir)
    assert chosen is not None
    assert chosen.name == "LaPierre Mechanics.mp4"
    assert attempts
    assert candidates


def test_target_output_dir_uses_single_session_slug():
    out_dir = batch_mod._target_output_dir("bobby_burk", "mechanics_latest")
    assert str(out_dir).endswith("output/mechanics/bobby_burk/mechanics_latest")


def test_build_plan_entries_does_not_auto_skip_trafton(tmp_path: Path):
    player_dir = tmp_path / "Trafton OBrien"
    player_dir.mkdir(parents=True, exist_ok=True)
    (player_dir / "OBrien Mechanics.mp4").touch()

    rows = batch_mod._build_plan_entries(
        player_dirs=[player_dir],
        only_tokens=[],
        skip_tokens=[],
        force=True,
        session_slug="mechanics_latest",
        runner_python="python3",
        runner_path=Path("/tmp/mechanics_coach_pack.py"),
        defaults={"hand": "R", "view_mode": "open_side"},
    )
    assert len(rows) == 1
    assert rows[0]["player_slug"] == "trafton_obrien"
    assert rows[0]["status"] == "planned"
    assert rows[0]["skip_reason"] is None
