from __future__ import annotations

import re
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


def test_derive_session_slug_appends_batch_suffix_without_date(tmp_path: Path):
    player_dir = tmp_path / "Bobby Burk"
    player_dir.mkdir(parents=True, exist_ok=True)

    session_slug = batch_mod._derive_session_slug("bobby_burk", player_dir)
    assert session_slug.startswith("bobby_burk_mechanics_")
    assert session_slug.endswith("_mechanics_batch")
    assert re.search(r"bobby_burk_mechanics_\d{4}_\d{2}_\d{2}_mechanics_batch$", session_slug)


def test_derive_session_slug_uses_folder_date_token(tmp_path: Path):
    player_dir = tmp_path / "Bobby Burk 2026-01-18"
    player_dir.mkdir(parents=True, exist_ok=True)

    session_slug = batch_mod._derive_session_slug("bobby_burk", player_dir)
    assert session_slug == "bobby_burk_mechanics_2026_01_18"
