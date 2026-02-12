import json
from pathlib import Path
from tempfile import TemporaryDirectory

from scripts.import_boxscore import iso_timestamp, parse_url_metadata, write_json
from scripts.sidearm_parser import normalize_name, normalize_team_name, parse_all_teams, parse_game_meta

FIXTURE_PATH = Path("tests") / "fixtures" / "sidearm" / "14570.html"


def load_fixture() -> str:
    return FIXTURE_PATH.read_text(encoding="utf-8")


def test_parse_url_metadata():
    season, game_id = parse_url_metadata(
        "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570"
    )
    assert season == 2025
    assert game_id == "14570"


def test_extract_known_player():
    html = load_fixture()
    teams = parse_all_teams(html)
    assert teams
    target = normalize_name("Chase Burrows").lower()
    babson_name = None
    for name in teams.keys():
        if normalize_team_name(name) == "babson":
            babson_name = name
            break
    assert babson_name is not None, "Expected Babson team to be present in fixture"
    babson_team = teams[babson_name]
    assert len(babson_team.get("batting", [])) > 0
    found = any(
        normalize_name(row.get("name", "")).lower() == target
        for row in babson_team.get("batting", []) + babson_team.get("pitching", [])
    )
    assert found, "Expected to find Chase Burrows in Babson rows"


def test_batting_structure_is_deterministic():
    html = load_fixture()
    teams = parse_all_teams(html)
    babson_name = None
    for name in teams.keys():
        if normalize_team_name(name) == "babson":
            babson_name = name
            break
    assert babson_name is not None
    batting_rows = teams[babson_name]["batting"]
    assert batting_rows, "Expected batting rows for Babson"
    expected_keys = {
        "name",
        "pos",
        "ab",
        "r",
        "h",
        "rbi",
        "bb",
        "so",
        "hr",
        "sb",
        "hbp",
        "avg",
    }
    assert set(batting_rows[0].keys()) == expected_keys


def test_parse_pipeline_writes_game_json():
    html = load_fixture()
    season, game_id = parse_url_metadata(
        "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570"
    )
    meta = parse_game_meta(html)
    teams = parse_all_teams(html)
    imported_at = iso_timestamp()
    game_payload = {
        "season": season,
        "gameId": str(game_id),
        "url": "https://babsonathletics.com/sports/baseball/stats/2025/suffolk/boxscore/14570",
        "date": meta.get("date"),
        "opponent": meta.get("opponent"),
        "teams": {
            "babson": teams.get("Babson 13", teams.get("Babson", {})),
            "opponent": teams.get("Suffolk 3", teams.get("Suffolk", {})),
        },
        "importedAt": imported_at,
    }
    with TemporaryDirectory() as tmp_dir:
        out_path = Path(tmp_dir) / "game.json"
        write_json(str(out_path), game_payload)
        assert out_path.exists()
        data = json.loads(out_path.read_text(encoding="utf-8"))
        for key in ["season", "gameId", "url", "date", "opponent", "teams", "importedAt"]:
            assert key in data
