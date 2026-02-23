"""Load canonical player names and IDs from Arsenals.csv (single source of truth).

Used by import_trackman_pdf, build_trackman_leaderboards, and other scripts
to emit consistent names/IDs.
"""

import csv
import os
import re
from pathlib import Path
from typing import Dict, Optional

_REPO_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_ARSENALS = _REPO_ROOT / "web" / "public" / "data" / "Arsenals.csv"

_canonical_cache: Optional[Dict[str, str]] = None
_slug_to_name_cache: Optional[Dict[str, str]] = None


def slugify(name: str) -> str:
    """'Trafton OBrien' -> 'obrien_trafton'; 'O'Brien, Trafton' -> 'obrien_trafton'."""
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    cleaned = re.sub(r"'", "", cleaned)  # normalize O'Brien -> OBrien for slug
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    # Handle "Last, First" format
    if "," in name:
        before, _, after = name.partition(",")
        last = re.sub(r"'", "", re.sub(r"[^a-zA-Z'-]", "", before)).strip().lower()
        first = re.sub(r"'", "", re.sub(r"[^a-zA-Z'-]", "", after)).strip().lower()
        if first and last:
            return f"{last}_{first}"
    first = parts[0].lower()
    last = parts[-1].lower()
    return f"{last}_{first}"


def _load_canonical(arsenals_path: Optional[os.PathLike] = None) -> Dict[str, str]:
    """Load player_id -> canonical_name from Arsenals.csv."""
    global _canonical_cache
    if _canonical_cache is not None:
        return _canonical_cache

    path = Path(arsenals_path) if arsenals_path else _DEFAULT_ARSENALS
    result: Dict[str, str] = {}
    if not path.exists():
        _canonical_cache = result
        return result

    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if "player_id" not in (reader.fieldnames or []) or "player_name" not in (reader.fieldnames or []):
            _canonical_cache = result
            return result
        seen: set[str] = set()
        for row in reader:
            pid = (row.get("player_id") or "").strip()
            name = (row.get("player_name") or "").strip()
            if not pid or not name or pid in seen:
                continue
            seen.add(pid)
            result[pid] = name

    _canonical_cache = result
    return result


def _load_slug_to_name(arsenals_path: Optional[os.PathLike] = None) -> Dict[str, str]:
    """Load slug -> canonical_name from Arsenals.csv."""
    global _slug_to_name_cache
    if _slug_to_name_cache is not None:
        return _slug_to_name_cache

    by_id = _load_canonical(arsenals_path)
    result: Dict[str, str] = {}
    for pid, name in by_id.items():
        s = slugify(name)
        if s:
            result[s] = name
            result[pid] = name  # also allow player_id as key
    _slug_to_name_cache = result
    return result


def get_canonical_name(
    slug_or_player_id_or_raw: str,
    arsenals_path: Optional[os.PathLike] = None,
) -> str:
    """Resolve to canonical display name from Arsenals.

    Accepts: slug (obrien_trafton), playerId (TOBrien1), or raw (OBrien, Trafton).
    Returns: Arsenals format e.g. 'Trafton OBrien', or formatted fallback.
    """
    data = _load_slug_to_name(arsenals_path)
    key = slug_or_player_id_or_raw.strip()

    # Direct lookup
    if key in data:
        return data[key]

    # Try slug parsed from raw (Last, First)
    parsed = slugify(key)
    if parsed in data:
        return data[parsed]

    # Fallback: format Last, First -> First Last
    if "," in key:
        parts = key.split(",", 2)
        if len(parts) >= 2:
            last, first = parts[0].strip(), parts[1].strip()
            if first and last:
                return f"{first} {last}"
    return key


def get_all_canonical(
    arsenals_path: Optional[os.PathLike] = None,
) -> tuple[Dict[str, str], Dict[str, str], Dict[str, str]]:
    """Return (by_player_id, by_slug, slug_to_hand) for script use."""
    path = Path(arsenals_path) if arsenals_path else _DEFAULT_ARSENALS
    by_id: Dict[str, str] = {}
    by_slug: Dict[str, str] = {}
    slug_to_hand: Dict[str, str] = {}
    if path.exists():
        with open(path, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            fields = reader.fieldnames or []
            if "player_id" in fields and "player_name" in fields and "pitcher_hand" in fields:
                seen: set[str] = set()
                for row in reader:
                    pid = (row.get("player_id") or "").strip()
                    name = (row.get("player_name") or "").strip()
                    hand = (row.get("pitcher_hand") or "").strip().upper()[:1]
                    if not pid or not name or pid in seen:
                        continue
                    seen.add(pid)
                    by_id[pid] = name
                    s = slugify(name)
                    if s:
                        by_slug[s] = name
                        if hand in ("R", "L"):
                            slug_to_hand[s] = hand
    if not by_id:
        by_id = _load_canonical(arsenals_path)
        for pid, name in by_id.items():
            s = slugify(name)
            if s:
                by_slug[s] = name
    return by_id, by_slug, slug_to_hand
