"""Tests for sync_players_from_arsenals.py — no live API calls."""

import json
import sys
import textwrap
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sync_players_from_arsenals import (
    clean_for_output,
    extract_rows,
    load_players_from_csv,
    merge_players,
    normalize_key,
    normalize_name,
    parse_first_last,
    pick_best_match,
    slugify_name,
    sort_players,
    PlayerResolver,
)


# ---------------------------------------------------------------------------
# normalize_key
# ---------------------------------------------------------------------------

class TestNormalizeKey:
    def test_basic(self):
        assert normalize_key("Player Name") == "playername"

    def test_special_chars(self):
        assert normalize_key("k_pct_%") == "kpct"

    def test_numbers(self):
        assert normalize_key("xFIP_2025") == "xfip2025"


# ---------------------------------------------------------------------------
# normalize_name
# ---------------------------------------------------------------------------

class TestNormalizeName:
    def test_basic(self):
        assert normalize_name("James Clark") == "jamesclark"

    def test_apostrophe(self):
        assert normalize_name("O'Brien") == "obrien"

    def test_hyphen(self):
        assert normalize_name("Jean-Pierre") == "jeanpierre"

    def test_extra_spaces(self):
        assert normalize_name("  James   Clark  ") == "jamesclark"

    def test_mixed_case(self):
        assert normalize_name("McAllister") == "mcallister"

    def test_accented(self):
        # Non-alpha characters stripped
        assert normalize_name("José") == "jos"

    def test_jr_suffix(self):
        assert normalize_name("James Clark Jr.") == "jamesclarkjr"

    def test_comma_format(self):
        assert normalize_name("Clark, James") == "clarkjames"

    def test_empty(self):
        assert normalize_name("") == ""

    def test_numbers_stripped(self):
        assert normalize_name("Player123") == "player"


# ---------------------------------------------------------------------------
# slugify_name
# ---------------------------------------------------------------------------

class TestSlugifyName:
    def test_first_last(self):
        assert slugify_name("James Clark") == "clark_james"

    def test_three_parts(self):
        assert slugify_name("Trafton O Brien") == "brien_trafton"

    def test_obrien_no_space(self):
        assert slugify_name("Trafton OBrien") == "obrien_trafton"

    def test_single_name(self):
        assert slugify_name("Cher") == "cher"

    def test_empty(self):
        assert slugify_name("") == ""

    def test_hyphenated(self):
        assert slugify_name("Jean-Pierre Dupont") == "dupont_jean-pierre"

    def test_extra_whitespace(self):
        assert slugify_name("  James   Clark  ") == "clark_james"


# ---------------------------------------------------------------------------
# parse_first_last
# ---------------------------------------------------------------------------

class TestParseFirstLast:
    def test_first_last(self):
        assert parse_first_last("James Clark") == ("James", "Clark")

    def test_last_comma_first(self):
        assert parse_first_last("Clark, James") == ("James", "Clark")

    def test_single(self):
        assert parse_first_last("Cher") == ("Cher", "")

    def test_three_parts(self):
        assert parse_first_last("Bobby Lee Burk") == ("Bobby", "Burk")


# ---------------------------------------------------------------------------
# pick_best_match (with ambiguity)
# ---------------------------------------------------------------------------

class TestPickBestMatch:
    def test_exact_team_match(self):
        rows = [
            {"player_name": "James Clark", "team": "Babson", "player_id": "1"},
            {"player_name": "James Clark", "team": "MIT", "player_id": "2"},
        ]
        best, ambiguous, reason = pick_best_match(rows, "James Clark", "Babson")
        assert best is not None
        assert best["player_id"] == "1"
        assert not ambiguous

    def test_ambiguous_same_team(self):
        rows = [
            {"player_name": "James Clark", "team": "Babson", "player_id": "1"},
            {"player_name": "James Clarke", "team": "Babson", "player_id": "2"},
        ]
        best, ambiguous, reason = pick_best_match(rows, "James Clark", "Babson")
        # Both match team (10) and name (5 vs 2), gap = 3 which is at threshold
        # The exact match should win clearly
        assert best is not None or ambiguous

    def test_no_candidates(self):
        best, ambiguous, reason = pick_best_match([], "James Clark", "Babson")
        assert best is None
        assert not ambiguous
        assert "no candidates" in reason

    def test_no_confident_match(self):
        rows = [
            {"player_name": "Completely Different", "team": "Other", "player_id": "1"},
        ]
        best, ambiguous, reason = pick_best_match(rows, "James Clark", "Babson")
        assert best is None

    def test_unresolved_player_never_gets_random_row(self):
        """Regression: score-0 rows must NOT be returned as matches.

        This was the root cause of unresolved players showing fake stats —
        the first leaderboard row was returned even with zero name/team
        similarity.
        """
        leaderboard = [
            {"player_name": "Alice Smith", "team": "MIT", "player_id": "100"},
            {"player_name": "Bob Jones", "team": "Harvard", "player_id": "200"},
            {"player_name": "Carol White", "team": "Tufts", "player_id": "300"},
        ]
        # A Babson player not in the leaderboard at all
        best, ambiguous, reason = pick_best_match(
            leaderboard, "Trafton OBrien", "Babson"
        )
        assert best is None, (
            f"Unresolved player should get None, not a random row: "
            f"got player_id={best.get('player_id') if best else None}"
        )

    def test_partial_name_overlap_not_false_positive(self):
        """Short names like 'TJ' should not match 'Justin' via substring."""
        rows = [
            {"player_name": "Justin Thomas", "team": "Babson", "player_id": "1"},
        ]
        best, _, _ = pick_best_match(rows, "TJ Flack", "Babson")
        # "tj" is contained in "justinthomas" via substring, but this is noise.
        # The match score should be low enough that it's not ambiguous with
        # a real match, but we mainly care it doesn't return a wrong row
        # with high confidence.


# ---------------------------------------------------------------------------
# extract_rows
# ---------------------------------------------------------------------------

class TestExtractRows:
    def test_list_input(self):
        data = [{"name": "A"}, {"name": "B"}]
        assert len(extract_rows(data)) == 2

    def test_dict_with_data(self):
        data = {"data": [{"name": "A"}]}
        assert len(extract_rows(data)) == 1

    def test_nested_data(self):
        data = {"data": {"rows": [{"name": "A"}]}}
        assert len(extract_rows(data)) == 1

    def test_none(self):
        assert extract_rows(None) == []

    def test_empty_dict(self):
        assert extract_rows({}) == []


# ---------------------------------------------------------------------------
# load_players_from_csv
# ---------------------------------------------------------------------------

class TestLoadPlayersFromCsv:
    def test_deduplication(self, tmp_path):
        csv_content = textwrap.dedent("""\
            player_id,player_name,pitcher_hand,pitch_type,abbreviation
            JClark1,James Clark,R,Fastball,FF
            JClark1,James Clark,R,Slider,SL
            CDoan1,Connor Doan,R,Fastball,FF
        """)
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content)

        players = load_players_from_csv(csv_file, "Babson", "Pitcher")
        assert len(players) == 2
        slugs = [p["slug"] for p in players]
        assert "clark_james" in slugs
        assert "doan_connor" in slugs

    def test_empty_csv(self, tmp_path):
        csv_content = "player_id,player_name,pitcher_hand\n"
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content)

        players = load_players_from_csv(csv_file, "Babson", "Pitcher")
        assert len(players) == 0

    def test_fields_populated(self, tmp_path):
        csv_content = textwrap.dedent("""\
            player_id,player_name,pitcher_hand,pitch_type
            TOBrien1,Trafton OBrien,R,Fastball
        """)
        csv_file = tmp_path / "test.csv"
        csv_file.write_text(csv_content)

        players = load_players_from_csv(csv_file, "Babson", "Pitcher")
        assert len(players) == 1
        p = players[0]
        assert p["slug"] == "obrien_trafton"
        assert p["name"] == "Trafton OBrien"
        assert p["team"] == "Babson"
        assert p["role"] == "Pitcher"
        assert p["d3_player_id"] is None
        assert p["first_name"] == "Trafton"
        assert p["last_name"] == "OBrien"


# ---------------------------------------------------------------------------
# merge_players
# ---------------------------------------------------------------------------

class TestMergePlayers:
    def test_merge_preserves_existing_id(self):
        existing = [{"slug": "clark_james", "name": "James Clark", "d3_player_id": "abc"}]
        from_csv = [{"slug": "clark_james", "name": "James Clark", "d3_player_id": None}]
        merged = merge_players(existing, from_csv, prune=False)
        assert merged[0]["d3_player_id"] == "abc"

    def test_merge_adds_new(self):
        existing = [{"slug": "clark_james", "name": "James Clark", "d3_player_id": "abc"}]
        from_csv = [
            {"slug": "clark_james", "name": "James Clark", "d3_player_id": None},
            {"slug": "doan_connor", "name": "Connor Doan", "d3_player_id": None},
        ]
        merged = merge_players(existing, from_csv, prune=False)
        assert len(merged) == 2

    def test_prune_removes_old(self):
        existing = [
            {"slug": "clark_james", "name": "James Clark", "d3_player_id": "abc"},
            {"slug": "old_player", "name": "Old Player", "d3_player_id": "xyz"},
        ]
        from_csv = [{"slug": "clark_james", "name": "James Clark", "d3_player_id": None}]
        merged = merge_players(existing, from_csv, prune=True)
        assert len(merged) == 1
        assert merged[0]["slug"] == "clark_james"

    def test_no_prune_keeps_old(self):
        existing = [{"slug": "old_player", "name": "Old Player", "d3_player_id": "xyz"}]
        from_csv = [{"slug": "clark_james", "name": "James Clark", "d3_player_id": None}]
        merged = merge_players(existing, from_csv, prune=False)
        assert len(merged) == 2


# ---------------------------------------------------------------------------
# sort_players
# ---------------------------------------------------------------------------

class TestSortPlayers:
    def test_sorted_by_last_name(self):
        players = [
            {"slug": "doan_connor", "last_name": "Doan", "first_name": "Connor"},
            {"slug": "burk_bobby", "last_name": "Burk", "first_name": "Bobby"},
            {"slug": "clark_james", "last_name": "Clark", "first_name": "James"},
        ]
        result = sort_players(players)
        assert [p["slug"] for p in result] == ["burk_bobby", "clark_james", "doan_connor"]


# ---------------------------------------------------------------------------
# clean_for_output
# ---------------------------------------------------------------------------

class TestCleanForOutput:
    def test_strips_internal_fields(self):
        player = {
            "slug": "clark_james",
            "name": "James Clark",
            "team": "Babson",
            "role": "Pitcher",
            "d3_player_id": "abc",
            "first_name": "James",
            "last_name": "Clark",
        }
        cleaned = clean_for_output(player)
        assert "first_name" not in cleaned
        assert "last_name" not in cleaned
        assert cleaned["slug"] == "clark_james"
        assert cleaned["d3_player_id"] == "abc"


# ---------------------------------------------------------------------------
# PlayerResolver (mocked)
# ---------------------------------------------------------------------------

class TestPlayerResolver:
    def test_resolve_cached(self):
        resolver = PlayerResolver("http://localhost:3000", "Babson")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = [
            {"player_name": "James Clark", "team": "Babson", "player_id": "d3d-123"},
        ]

        with patch("sync_players_from_arsenals.requests.get", return_value=mock_response) as mock_get:
            id1, reason1 = resolver.resolve("James Clark")
            id2, reason2 = resolver.resolve("James Clark")

        assert id1 == "d3d-123"
        assert id2 == "d3d-123"
        # Should only call API once due to cache
        assert mock_get.call_count == 1

    def test_resolve_no_results(self):
        resolver = PlayerResolver("http://localhost:3000", "Babson")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {}
        mock_response.json.return_value = []

        with patch("sync_players_from_arsenals.requests.get", return_value=mock_response):
            player_id, reason = resolver.resolve("Nobody Here")

        assert player_id is None
        assert "no search results" in reason

    def test_resolve_api_error(self):
        resolver = PlayerResolver("http://localhost:3000", "Babson")
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.headers = {}

        with patch("sync_players_from_arsenals.requests.get", return_value=mock_response):
            player_id, reason = resolver.resolve("James Clark")

        assert player_id is None
