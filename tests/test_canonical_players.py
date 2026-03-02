from scripts.import_boxscore import resolve_slug
from scripts.lib.canonical_players import get_canonical_name, get_player_id_by_alias


def test_player_id_aliases_cover_common_name_variants():
    assert get_player_id_by_alias("TOBrien1") == "TOBrien1"
    assert get_player_id_by_alias("TOBrien 1") == "TOBrien1"
    assert get_player_id_by_alias("T OBrien") == "TOBrien1"
    assert get_player_id_by_alias("Trafton O'Brien") == "TOBrien1"
    assert get_player_id_by_alias("OBrien, Trafton") == "TOBrien1"
    assert get_player_id_by_alias("OBrien") == "TOBrien1"
    assert get_player_id_by_alias("Trafton") == "TOBrien1"


def test_ambiguous_short_aliases_are_not_resolved():
    assert get_player_id_by_alias("James") is None


def test_canonical_name_uses_alias_resolution():
    assert get_canonical_name("T OBrien") == "Trafton OBrien"


def test_import_slug_resolution_uses_arsenals_aliases():
    assert resolve_slug("T O'Brien", {}) == "obrien_trafton"
