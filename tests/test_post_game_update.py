import json
from pathlib import Path

from scripts.import_boxscore import canonical_slug, player_key, resolve_slug
from scripts.normalize_stats_player_slugs import normalize_stats_player_slugs
from scripts.post_game_update import run

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
    assert str(output_root / "stats" / "players-by-id" / "CBurrows1" / "2025" / "14570.json") in captured
    assert not (output_root / "stats").exists()


def test_post_game_dry_run_uses_player_id_paths_with_legacy_index(tmp_path, capsys):
    """A legacy slug index does not reintroduce slug-path player writes."""
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
    assert str(output_root / "stats" / "players-by-id" / "CBurrows1" / "2025" / "14570.json") in captured
    assert str(output_root / "stats" / "players" / "chase_burrows" / "2025" / "14570.json") not in captured


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
    assert not slug_index.exists()


# --- Slug resolution tests ---


def test_canonical_slug_produces_last_first():
    assert canonical_slug("Connor Doan") == "doan_connor"
    assert canonical_slug("Chase Burrows") == "burrows_chase"
    assert canonical_slug("Dillon James") == "james_dillon"


def test_canonical_slug_single_name():
    assert canonical_slug("Cher") == "cher"


def test_resolve_slug_uses_player_id_from_arsenals():
    index = {"CDoan1": "doan_connor"}
    assert resolve_slug("Connor Doan", index, player_id="CDoan1") == "doan_connor"


def test_resolve_slug_uses_arsenals_alias_from_display():
    """When no player_id is supplied, Arsenals aliases still resolve correctly."""
    index = {"CDoan1": "doan_connor"}
    assert resolve_slug("Connor Doan", index) == "doan_connor"


def test_resolve_slug_ignores_legacy_index_values():
    """Arsenals canonical slug overrides any legacy first_last index value."""
    index = {"CBurrows1": "chase_burrows"}
    assert resolve_slug("Chase Burrows", index) == "burrows_chase"


def test_resolve_slug_derives_last_first_when_no_index():
    assert resolve_slug("Connor Doan", {}) == "doan_connor"
    assert resolve_slug("Chase Burrows", {}) == "burrows_chase"


def test_player_id_pipeline_ignores_legacy_slug_index(tmp_path):
    """Full pipeline writes only playerId-first stats and removes legacy index files."""
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
            "--output-root",
            str(output_root),
            "--timestamp",
            TIMESTAMP,
        ]
    )
    assert code == 0
    player_id_file = output_root / "stats" / "players-by-id" / "CBurrows1" / "2025" / "14570.json"
    assert player_id_file.exists()
    data = json.loads(player_id_file.read_text(encoding="utf-8"))
    assert data["playerId"] == "CBurrows1"
    assert "playerKey" not in data
    assert not idx_path.exists()
    season_index = output_root / "stats" / "seasons" / "2025" / "games.json"
    season_data = json.loads(season_index.read_text(encoding="utf-8"))
    assert season_data[0]["playerIdsIncluded"] == ["CBurrows1"]
    assert "playersIncluded" not in season_data[0]


def test_player_key_differs_from_arsenals_slug():
    """Arsenals canonical slug is preserved even when naive slug differs."""
    index = {"CDoan1": "doan_connor"}
    result = resolve_slug("Connor Doan", index, player_id="CDoan1")
    assert result == "doan_connor"
    assert result != player_key("Connor Doan")  # connor_doan would be wrong


def test_normalize_stats_player_slugs_updates_existing_outputs(tmp_path):
    public_root = tmp_path / "public"
    players_dir = public_root / "stats" / "players"
    wrong_dir = players_dir / "chase_burrows" / "2025"
    wrong_dir.mkdir(parents=True)
    (wrong_dir / "14570.json").write_text(
        '{"playerKey":"chase_burrows","season":2025,"gameId":"14570"}',
        encoding="utf-8",
    )
    (players_dir / "index.json").write_text(
        '{"CBurrows1":"chase_burrows"}',
        encoding="utf-8",
    )
    season_index = public_root / "stats" / "seasons" / "2025"
    season_index.mkdir(parents=True)
    (season_index / "games.json").write_text(
        '[{"gameId":"14570","playersIncluded":["chase_burrows"]}]',
        encoding="utf-8",
    )

    actions = normalize_stats_player_slugs(public_root)

    assert actions
    assert not players_dir.exists()
    player_id_file = public_root / "stats" / "players-by-id" / "CBurrows1" / "2025" / "14570.json"
    assert player_id_file.exists()
    player_data = player_id_file.read_text(encoding="utf-8")
    season_data = (season_index / "games.json").read_text(encoding="utf-8")
    assert '"playerId": "CBurrows1"' in player_data
    assert '"playerKey"' not in player_data
    assert '"playersIncluded"' not in season_data
    assert '"playerIdsIncluded": [' in season_data
    assert '"CBurrows1"' in season_data
