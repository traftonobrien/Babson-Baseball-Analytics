import json
from pathlib import Path

from scripts.import_boxscore import canonical_slug, load_slug_index, player_key, resolve_slug
from scripts.post_game_update import migrate_wrong_slug_paths, run

FIXTURE_PATH = Path("tests") / "fixtures" / "sidearm" / "14570.html"
URL = "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570"
TIMESTAMP = "2025-03-26T00:00:00Z"


def test_post_game_dry_run_plans(tmp_path, capsys):
    output_root = tmp_path / "public"
    code = run(
        [
            "--boxscore-url",
            URL,
            "--players",
            "Chase Burrows",
            "--fixture",
            str(FIXTURE_PATH),
            "--dry-run",
            "--output-root",
            str(output_root),
            "--timestamp",
            TIMESTAMP,
        ]
    )
    assert code == 0
    captured = capsys.readouterr().out
    assert str(output_root / "stats" / "games" / "2025" / "14570.json") in captured
    assert str(output_root / "stats" / "seasons" / "2025" / "games.json") in captured
    # No index on disk, so canonical_slug produces last_first
    assert str(output_root / "stats" / "players" / "burrows_chase" / "2025" / "14570.json") in captured
    assert not (output_root / "stats").exists()


def test_post_game_dry_run_uses_index_slug(tmp_path, capsys):
    """When index.json maps CBurrows1 -> chase_burrows, output uses that slug."""
    output_root = tmp_path / "public"
    idx_path = output_root / "stats" / "players" / "index.json"
    idx_path.parent.mkdir(parents=True, exist_ok=True)
    idx_path.write_text('{"CBurrows1": "chase_burrows"}', encoding="utf-8")

    code = run(
        [
            "--boxscore-url",
            URL,
            "--players",
            "Chase Burrows",
            "--fixture",
            str(FIXTURE_PATH),
            "--dry-run",
            "--output-root",
            str(output_root),
            "--timestamp",
            TIMESTAMP,
        ]
    )
    assert code == 0
    captured = capsys.readouterr().out
    assert "chase_burrows" in captured
    assert "burrows_chase" not in captured


def test_outing_meta_merge(tmp_path):
    output_root = tmp_path / "public"
    outing_dir = output_root / "data" / "CBurrows1" / "2025_03_26"
    outing_dir.mkdir(parents=True, exist_ok=True)
    meta_path = outing_dir / "outing_meta.json"
    meta_path.write_text(
        '{"outingId":"CBurrows1/2025_03_26","linkedGames":[{"gameId":"111","season":2025,"opponent":"MIT","date":"2025-03-20"}],"updatedAt":"2025-03-20T00:00:00Z"}',
        encoding="utf-8",
    )

    code = run(
        [
            "--boxscore-url",
            URL,
            "--players",
            "Chase Burrows",
            "--fixture",
            str(FIXTURE_PATH),
            "--output-root",
            str(output_root),
            "--timestamp",
            TIMESTAMP,
            "--outing-map",
            "CBurrows1=2025_03_26",
        ]
    )
    assert code == 0

    updated = meta_path.read_text(encoding="utf-8")
    assert "14570" in updated
    assert "111" in updated

    slug_index = output_root / "stats" / "players" / "index.json"
    assert slug_index.exists()
    assert "CBurrows1" in slug_index.read_text(encoding="utf-8")


# --- Slug resolution tests ---


def test_canonical_slug_produces_last_first():
    assert canonical_slug("Connor Doan") == "doan_connor"
    assert canonical_slug("Chase Burrows") == "burrows_chase"
    assert canonical_slug("Dillon James") == "james_dillon"


def test_canonical_slug_single_name():
    assert canonical_slug("Cher") == "cher"


def test_resolve_slug_uses_index_by_player_id():
    index = {"CDoan1": "doan_connor"}
    assert resolve_slug("Connor Doan", index, player_id="CDoan1") == "doan_connor"


def test_resolve_slug_matches_index_value_by_display():
    """When no player_id given, resolve_slug finds matching index value."""
    index = {"CDoan1": "doan_connor"}
    # canonical_slug("Connor Doan") == "doan_connor" matches an index value
    assert resolve_slug("Connor Doan", index) == "doan_connor"


def test_resolve_slug_matches_naive_form_in_index():
    """Index value stored as first_last (legacy) is still matched."""
    index = {"CBurrows1": "chase_burrows"}
    # player_key("Chase Burrows") == "chase_burrows" matches an index value
    assert resolve_slug("Chase Burrows", index) == "chase_burrows"


def test_resolve_slug_derives_last_first_when_no_index():
    assert resolve_slug("Connor Doan", {}) == "doan_connor"
    assert resolve_slug("Chase Burrows", {}) == "burrows_chase"


def test_index_slug_wins_over_naive(tmp_path):
    """Full pipeline: CDoan1 in index as doan_connor writes to doan_connor, not connor_doan."""
    output_root = tmp_path / "public"
    idx_path = output_root / "stats" / "players" / "index.json"
    idx_path.parent.mkdir(parents=True, exist_ok=True)
    idx_path.write_text('{"CDoan1": "doan_connor"}', encoding="utf-8")

    code = run(
        [
            "--boxscore-url",
            URL,
            "--players",
            "Chase Burrows",
            "--fixture",
            str(FIXTURE_PATH),
            "--output-root",
            str(output_root),
            "--timestamp",
            TIMESTAMP,
        ]
    )
    assert code == 0
    # Chase Burrows isn't CDoan1, so no index match.
    # Without an index match, canonical_slug("Chase Burrows") = "burrows_chase"
    player_file = output_root / "stats" / "players" / "burrows_chase" / "2025" / "14570.json"
    assert player_file.exists()
    data = json.loads(player_file.read_text(encoding="utf-8"))
    assert data["playerKey"] == "burrows_chase"


def test_player_key_in_index_writes_correct_path(tmp_path):
    """CDoan1 with index doan_connor: player file lands at doan_connor path."""
    # We can't test CDoan1 with the 14570 fixture (Suffolk game), because
    # Doan isn't in that boxscore.  Instead test resolve_slug directly.
    index = {"CDoan1": "doan_connor"}
    result = resolve_slug("Connor Doan", index, player_id="CDoan1")
    assert result == "doan_connor"
    assert result != player_key("Connor Doan")  # connor_doan would be wrong


# --- Migration tests ---


def test_migrate_wrong_slug_moves_files(tmp_path):
    """Files under connor_doan/ are moved to doan_connor/ when index says doan_connor."""
    players_dir = tmp_path / "players"
    wrong_dir = players_dir / "connor_doan" / "2025"
    wrong_dir.mkdir(parents=True)
    wrong_file = wrong_dir / "14590.json"
    wrong_file.write_text('{"playerKey": "connor_doan"}', encoding="utf-8")

    slug_index = {"CDoan1": "doan_connor"}
    actions = migrate_wrong_slug_paths(players_dir, slug_index)

    assert len(actions) == 1
    assert "connor_doan" in actions[0]
    assert "doan_connor" in actions[0]

    # Old path gone
    assert not (players_dir / "connor_doan").exists()
    # New path exists
    canonical = players_dir / "doan_connor" / "2025" / "14590.json"
    assert canonical.exists()


def test_migrate_skips_correct_slug(tmp_path):
    """Files already at the canonical slug are not touched."""
    players_dir = tmp_path / "players"
    correct_dir = players_dir / "doan_connor" / "2025"
    correct_dir.mkdir(parents=True)
    correct_file = correct_dir / "14590.json"
    correct_file.write_text('{"ok": true}', encoding="utf-8")

    slug_index = {"CDoan1": "doan_connor"}
    actions = migrate_wrong_slug_paths(players_dir, slug_index)

    assert len(actions) == 0
    assert correct_file.exists()
