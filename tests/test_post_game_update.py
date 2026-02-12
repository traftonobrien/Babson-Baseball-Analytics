from pathlib import Path

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
    assert str(output_root / "stats" / "players" / "chase_burrows" / "2025" / "14570.json") in captured
    assert not (output_root / "stats").exists()


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
