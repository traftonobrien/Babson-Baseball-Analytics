"""
Unit tests for player height lookup in src/mechanics/__init__.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.mechanics import _parse_height_inches, get_player_height_inches


class TestParseHeightInches:
    def test_standard_format(self):
        assert _parse_height_inches("6'2\"") == 74.0

    def test_no_quotes(self):
        assert _parse_height_inches("6'2") == 74.0

    def test_short_player(self):
        assert _parse_height_inches("5'10\"") == 70.0

    def test_tall_player(self):
        assert _parse_height_inches("6'6\"") == 78.0

    def test_even_feet(self):
        assert _parse_height_inches("6'0\"") == 72.0

    def test_invalid_format(self):
        assert _parse_height_inches("unknown") is None

    def test_empty_string(self):
        assert _parse_height_inches("") is None


class TestGetPlayerHeightInches:
    def test_player_found(self, tmp_path: Path):
        roster = {"obrien_trafton": {"height": "6'2\""}}
        roster_path = tmp_path / "roster.json"
        roster_path.write_text(json.dumps(roster))
        assert get_player_height_inches("obrien_trafton", roster_path=roster_path) == 74.0

    def test_player_not_found(self, tmp_path: Path):
        roster = {"other_player": {"height": "6'0\""}}
        roster_path = tmp_path / "roster.json"
        roster_path.write_text(json.dumps(roster))
        assert get_player_height_inches("missing_player", roster_path=roster_path) is None

    def test_missing_roster_file(self, tmp_path: Path):
        fake_path = tmp_path / "nonexistent.json"
        assert get_player_height_inches("anyone", roster_path=fake_path) is None

    def test_no_height_field(self, tmp_path: Path):
        roster = {"obrien_trafton": {"name": "Trafton OBrien"}}
        roster_path = tmp_path / "roster.json"
        roster_path.write_text(json.dumps(roster))
        assert get_player_height_inches("obrien_trafton", roster_path=roster_path) is None
