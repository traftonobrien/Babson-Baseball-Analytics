"""Shared arsenal loader from data/Arsenals.csv.

Provides player metadata and pitch arsenal lookups, cached after first load.
"""

import csv
import os

_DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                             "data", "Arsenals.csv")

_cache: dict | None = None


def _load(csv_path: str | None = None) -> dict:
    """Load and cache arsenals CSV. Returns dict keyed by player_id."""
    global _cache
    if _cache is not None:
        return _cache

    path = csv_path or _DEFAULT_PATH
    _cache = {}
    if not os.path.exists(path):
        return _cache

    try:
        with open(path, newline="") as f:
            reader = csv.DictReader(f)
            # Validate required columns
            required = {"player_id", "abbreviation", "pitch_type"}
            if not required.issubset(set(reader.fieldnames or [])):
                print(f"WARNING: {path} missing columns {required - set(reader.fieldnames or [])}")
                return _cache

            for row in reader:
                pid = row.get("player_id", "").strip()
                if not pid:
                    continue
                if pid not in _cache:
                    _cache[pid] = {
                        "player_name": row.get("player_name", "").strip() or None,
                        "pitcher_hand": row.get("pitcher_hand", "").strip() or None,
                        "arsenal": [],
                    }
                abbrev = row.get("abbreviation", "").strip()
                ptype = row.get("pitch_type", "").strip()
                if abbrev:
                    _cache[pid]["arsenal"].append({
                        "abbreviation": abbrev,
                        "pitch_type": ptype,
                    })
    except Exception as e:
        print(f"WARNING: Could not load arsenals from {path}: {e}")

    return _cache


def reload(csv_path: str | None = None) -> None:
    """Force reload of arsenals cache."""
    global _cache
    _cache = None
    _load(csv_path)


def get_player_name(player_id: str, csv_path: str | None = None) -> str | None:
    data = _load(csv_path)
    entry = data.get(player_id)
    return entry["player_name"] if entry else None


def get_player_hand(player_id: str, csv_path: str | None = None) -> str | None:
    data = _load(csv_path)
    entry = data.get(player_id)
    return entry["pitcher_hand"] if entry else None


def get_player_arsenal(player_id: str, csv_path: str | None = None) -> list[dict]:
    """Return list of {abbreviation, pitch_type} dicts for the player."""
    data = _load(csv_path)
    entry = data.get(player_id)
    return entry["arsenal"] if entry else []
