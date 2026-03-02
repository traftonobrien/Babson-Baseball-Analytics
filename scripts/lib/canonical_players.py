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
_player_id_by_alias_cache: Optional[Dict[str, str]] = None


def normalize_player_alias(value: str) -> str:
    """Normalize arbitrary player labels to an alias-safe lookup key."""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


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


def _player_alias_candidates(player_id: str, name: str) -> set[str]:
    aliases: set[str] = set()
    pid = player_id.strip()
    display = name.strip()
    if pid:
        aliases.add(pid)
        stem = re.sub(r"\d+$", "", pid)
        digits = pid[len(stem):]
        if stem:
            aliases.add(stem)
            if digits:
                aliases.add(f"{stem} {digits}")
            if len(stem) > 1:
                aliases.add(f"{stem[0]} {stem[1:]}")
                if digits:
                    aliases.add(f"{stem[0]} {stem[1:]} {digits}")

    cleaned = re.sub(r"[^a-zA-Z\s,'-]", "", display).strip()
    cleaned = re.sub(r"'", "", cleaned)

    if "," in cleaned:
        before, _, after = cleaned.partition(",")
        last = before.strip()
        given = after.strip()
    else:
        parts = [p for p in re.split(r"\s+", cleaned) if p]
        if not parts:
            return aliases
        last = parts[-1]
        given = " ".join(parts[:-1]) if len(parts) > 1 else parts[0]

    given_parts = [p for p in re.split(r"\s+", given) if p]
    first_token = given_parts[0] if given_parts else ""
    first_initial = first_token[:1]

    if given and last:
        aliases.add(f"{given} {last}")
        aliases.add(f"{last}, {given}")
        aliases.add(f"{last} {given}")
    if first_initial and last:
        aliases.add(f"{first_initial} {last}")
        aliases.add(f"{first_initial}{last}")
        aliases.add(f"{last}, {first_initial}")
        aliases.add(f"{last} {first_initial}")
    if given:
        aliases.add(given)
    if last:
        aliases.add(last)

    return aliases


def _build_player_id_by_alias(
    arsenals_path: Optional[os.PathLike] = None,
) -> Dict[str, str]:
    global _player_id_by_alias_cache
    if arsenals_path is None and _player_id_by_alias_cache is not None:
        return _player_id_by_alias_cache

    by_id = _load_canonical(arsenals_path)
    collisions: Dict[str, set[str]] = {}

    for pid, name in by_id.items():
        aliases = {
            normalize_player_alias(alias)
            for alias in _player_alias_candidates(pid, name)
            if normalize_player_alias(alias)
        }
        for alias in aliases:
            collisions.setdefault(alias, set()).add(pid)

    resolved = {
        alias: next(iter(player_ids))
        for alias, player_ids in collisions.items()
        if len(player_ids) == 1
    }

    if arsenals_path is None:
        _player_id_by_alias_cache = resolved
    return resolved


def get_player_id_by_alias(
    value: str,
    arsenals_path: Optional[os.PathLike] = None,
) -> Optional[str]:
    """Resolve any supported name/id alias to the canonical playerId."""
    key = normalize_player_alias(value.strip())
    if not key:
        return None
    return _build_player_id_by_alias(arsenals_path).get(key)


def get_player_alias_map(
    arsenals_path: Optional[os.PathLike] = None,
) -> Dict[str, str]:
    """Return normalized alias -> playerId for unique aliases."""
    return dict(_build_player_id_by_alias(arsenals_path))


def get_slug_for_player_id(
    player_id: str,
    arsenals_path: Optional[os.PathLike] = None,
) -> Optional[str]:
    """Resolve canonical last_first slug for a playerId or alias."""
    resolved_id = get_player_id_by_alias(player_id, arsenals_path)
    if not resolved_id:
        resolved_id = player_id.strip() if player_id.strip() in _load_canonical(arsenals_path) else None
    if not resolved_id:
        return None
    name = _load_canonical(arsenals_path).get(resolved_id)
    if not name:
        return None
    slug = slugify(name)
    return slug or None


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

    player_id = get_player_id_by_alias(key, arsenals_path)
    if player_id:
        canonical = _load_canonical(arsenals_path).get(player_id)
        if canonical:
            return canonical

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
