#!/usr/bin/env python3
"""Sync web/data/players.json from data/Arsenals.csv.

Reads the arsenals CSV, resolves D3 Dashboard player IDs via the local
Next.js proxy, and writes a deterministic players.json.  Existing manual
edits in the output file are preserved (merge semantics).

Usage:
  python3 scripts/sync_players_from_arsenals.py \
      --arsenals data/Arsenals.csv \
      --out web/data/players.json

  Add --dry-run to preview without writing.
  Add --prune to remove players no longer in the CSV.
  Add --force to re-resolve IDs even if already set.
"""

import argparse
import csv
import json
import re
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TEAM_KEYS = [
    "team", "team_name", "school", "school_name",
    "college", "college_name", "institution",
]

NAME_KEYS = [
    "player", "player_name", "name", "full_name", "fullname",
]

ID_KEYS = ["player_id", "playerid", "id"]

AMBIGUITY_THRESHOLD = 3  # minimum score gap between top two candidates

# ---------------------------------------------------------------------------
# Name helpers
# ---------------------------------------------------------------------------


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.lower())


def slugify_name(name: str) -> str:
    """'James Clark' -> 'clark_james', 'Trafton OBrien' -> 'obrien_trafton'."""
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    first = parts[0]
    last = parts[-1]
    return f"{last.lower()}_{first.lower()}"


def parse_first_last(name: str) -> Tuple[str, str]:
    """Parse 'First Last' into (first, last).  Handles 'Last, First' too."""
    name = name.strip()
    if "," in name:
        last, _, first = name.partition(",")
        return first.strip(), last.strip()
    parts = name.split()
    if len(parts) < 2:
        return name, ""
    return parts[0], parts[-1]


# ---------------------------------------------------------------------------
# API helpers (reused from resolve_d3_ids.py)
# ---------------------------------------------------------------------------


def get_value_by_candidates(row: Dict[str, Any], candidates: List[str]) -> Optional[Any]:
    for candidate in candidates:
        needle = normalize_key(candidate)
        for key, value in row.items():
            if normalize_key(str(key)) == needle:
                return value
    return None


def extract_rows(payload: Any) -> List[Dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ["data", "rows", "players", "results", "leaderboard"]:
        value = payload.get(key)
        if isinstance(value, list):
            return [row for row in value if isinstance(row, dict)]
    data = payload.get("data")
    if isinstance(data, dict):
        for key in ["data", "rows", "players", "results", "leaderboard"]:
            value = data.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
    return []


def pick_best_match(
    rows: List[Dict[str, Any]],
    name: str,
    team_hint: str,
) -> Tuple[Optional[Dict[str, Any]], bool, str]:
    """Return (best_row, is_ambiguous, reason).

    Ambiguous when top two candidates score within AMBIGUITY_THRESHOLD and
    both match the team hint.
    """
    name_target = normalize_name(name)
    team_target = team_hint.lower() if team_hint else ""

    scored: List[Tuple[Dict[str, Any], int]] = []
    for row in rows:
        row_name = get_value_by_candidates(row, NAME_KEYS) or ""
        row_team = get_value_by_candidates(row, TEAM_KEYS) or ""
        if not row_name:
            continue
        score = 0
        team_match = team_target and team_target in str(row_team).lower()
        if team_match:
            score += 10
        row_normalized = normalize_name(str(row_name))
        if row_normalized == name_target:
            score += 5
        elif row_normalized in name_target or name_target in row_normalized:
            score += 2
        scored.append((row, score))

    if not scored:
        return None, False, "no candidates"

    scored.sort(key=lambda x: x[1], reverse=True)
    best_row, best_score = scored[0]

    if best_score == 0:
        return None, False, "no confident match"

    if len(scored) >= 2:
        second_score = scored[1][1]
        gap = best_score - second_score
        # Both have team match and score gap is tight
        if gap < AMBIGUITY_THRESHOLD and best_score >= 10 and second_score >= 10:
            row1_name = get_value_by_candidates(scored[0][0], NAME_KEYS) or "?"
            row2_name = get_value_by_candidates(scored[1][0], NAME_KEYS) or "?"
            return None, True, f"ambiguous: '{row1_name}' vs '{row2_name}' (gap={gap})"

    return best_row, False, ""


# ---------------------------------------------------------------------------
# Search with caching and rate limiting
# ---------------------------------------------------------------------------


class PlayerResolver:
    def __init__(self, base_url: str, team_hint: str):
        self.base_url = base_url.rstrip("/")
        self.team_hint = team_hint
        self._cache: Dict[str, Optional[List[Dict[str, Any]]]] = {}

    def _search(self, query: str) -> Optional[List[Dict[str, Any]]]:
        cache_key = normalize_name(query)
        if cache_key in self._cache:
            return self._cache[cache_key]

        url = f"{self.base_url}/api/d3db/search/players"
        try:
            response = requests.get(url, params={"q": query}, timeout=30)
        except requests.RequestException as exc:
            print(f"  ERROR: search failed for '{query}': {exc}", file=sys.stderr)
            self._cache[cache_key] = None
            return None

        # Rate limit backoff
        remaining = response.headers.get("X-RateLimit-Remaining")
        if remaining is not None:
            try:
                if int(remaining) < 5:
                    time.sleep(1.0)
            except ValueError:
                pass

        if response.status_code != 200:
            print(
                f"  ERROR: search failed for '{query}': {response.status_code}",
                file=sys.stderr,
            )
            self._cache[cache_key] = None
            return None

        rows = extract_rows(response.json())
        self._cache[cache_key] = rows
        return rows

    def resolve(self, name: str) -> Tuple[Optional[str], str]:
        """Return (player_id or None, reason_if_unresolved)."""
        rows = self._search(name)
        if not rows:
            return None, "no search results"

        # Filter to team matches first
        team_target = self.team_hint.lower()
        team_matches = [
            row for row in rows
            if team_target in str(get_value_by_candidates(row, TEAM_KEYS) or "").lower()
        ]
        candidates = team_matches if team_matches else rows

        best, is_ambiguous, reason = pick_best_match(candidates, name, self.team_hint)

        if is_ambiguous:
            return None, reason

        if best is None:
            return None, reason or "no match"

        player_id = get_value_by_candidates(best, ID_KEYS)
        return (str(player_id) if player_id else None), ""


# ---------------------------------------------------------------------------
# CSV loading
# ---------------------------------------------------------------------------


def load_players_from_csv(csv_path: Path, team: str, role: str) -> List[Dict[str, Any]]:
    players: List[Dict[str, Any]] = []
    seen: set = set()

    with csv_path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = row.get("player_name") or row.get("name")
            if not name:
                continue
            name = name.strip()
            if not name or name in seen:
                continue
            seen.add(name)

            first, last = parse_first_last(name)
            slug = slugify_name(name)
            players.append({
                "slug": slug,
                "name": name,
                "first_name": first,
                "last_name": last,
                "team": team,
                "role": role,
                "d3_player_id": None,
            })
    return players


# ---------------------------------------------------------------------------
# Merge logic
# ---------------------------------------------------------------------------


def merge_players(
    existing: List[Dict[str, Any]],
    from_csv: List[Dict[str, Any]],
    prune: bool,
) -> List[Dict[str, Any]]:
    """Merge CSV entries into existing players.json.

    - New players are added.
    - Existing entries keep manually-set fields; only missing fields are filled.
    - If prune=True, players not in CSV are removed.
    """
    existing_by_slug: Dict[str, Dict[str, Any]] = {}
    for entry in existing:
        slug = entry.get("slug") or entry.get("player_slug") or ""
        if slug:
            existing_by_slug[slug] = entry

    csv_slugs = {p["slug"] for p in from_csv}
    merged: List[Dict[str, Any]] = []

    for csv_player in from_csv:
        slug = csv_player["slug"]
        if slug in existing_by_slug:
            # Merge: existing values take priority
            merged_entry = dict(csv_player)
            for key, value in existing_by_slug[slug].items():
                if value is not None:
                    merged_entry[key] = value
            merged.append(merged_entry)
        else:
            merged.append(dict(csv_player))

    if not prune:
        for slug, entry in existing_by_slug.items():
            if slug not in csv_slugs:
                merged.append(entry)

    return merged


def sort_players(players: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deterministic sort by last_name, first_name, slug."""
    def sort_key(p: Dict[str, Any]) -> Tuple[str, str, str]:
        last = (p.get("last_name") or "").lower()
        first = (p.get("first_name") or "").lower()
        slug = (p.get("slug") or "").lower()
        return (last, first, slug)
    return sorted(players, key=sort_key)


def clean_for_output(player: Dict[str, Any]) -> Dict[str, Any]:
    """Return a player dict with only the fields needed in players.json."""
    return {
        "slug": player.get("slug", ""),
        "name": player.get("name", ""),
        "team": player.get("team", ""),
        "role": player.get("role", ""),
        "d3_player_id": player.get("d3_player_id"),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Sync players.json from Arsenals.csv with D3 Dashboard IDs.",
    )
    parser.add_argument(
        "--arsenals",
        default="data/Arsenals.csv",
        help="Path to Arsenals.csv (default: data/Arsenals.csv)",
    )
    parser.add_argument(
        "--out",
        default="web/data/players.json",
        help="Output path for players.json (default: web/data/players.json)",
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:3000",
        help="Base URL for the Next.js dev server (default: http://localhost:3000)",
    )
    parser.add_argument(
        "--team",
        default="Babson",
        help="Team hint for matching (default: Babson)",
    )
    parser.add_argument(
        "--role",
        default="Pitcher",
        help="Default role for new entries (default: Pitcher)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print report without writing output.",
    )
    parser.add_argument(
        "--prune",
        action="store_true",
        help="Remove players not present in the CSV.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-resolve IDs even if d3_player_id is already set.",
    )

    args = parser.parse_args()

    arsenals_path = Path(args.arsenals)
    out_path = Path(args.out)

    if not arsenals_path.exists():
        print(f"Arsenals CSV not found: {arsenals_path}", file=sys.stderr)
        sys.exit(1)

    # Load CSV
    csv_players = load_players_from_csv(arsenals_path, args.team, args.role)
    print(f"Loaded {len(csv_players)} players from {arsenals_path}")

    # Load existing players.json if it exists
    existing: List[Dict[str, Any]] = []
    if out_path.exists():
        with out_path.open("r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                existing = data

    # Merge
    merged = merge_players(existing, csv_players, prune=args.prune)

    # Resolve D3 IDs
    resolver = PlayerResolver(args.base_url, args.team)
    added: List[str] = []
    updated: List[str] = []
    unresolved: List[Tuple[str, str]] = []

    existing_slugs = {e.get("slug") for e in existing}

    for player in merged:
        name = player.get("name", "")
        slug = player.get("slug", "")

        if slug not in existing_slugs:
            added.append(f"{name} ({slug})")

        if player.get("d3_player_id") and not args.force:
            continue

        print(f"  Resolving: {name} ...")
        player_id, reason = resolver.resolve(name)
        if player_id:
            old_id = player.get("d3_player_id")
            player["d3_player_id"] = player_id
            if old_id and old_id != player_id:
                updated.append(f"{name} (d3_player_id: {old_id} -> {player_id})")
            elif not old_id:
                updated.append(f"{name} (d3_player_id: {player_id})")
        else:
            player.setdefault("d3_player_id", None)
            unresolved.append((name, reason))

    # Sort and clean
    merged = sort_players(merged)
    output = [clean_for_output(p) for p in merged]

    # Report
    print()
    print("=" * 50)
    print("SYNC REPORT")
    print("=" * 50)

    if added:
        for entry in added:
            print(f"  ADDED:      {entry}")
    if updated:
        for entry in updated:
            print(f"  UPDATED:    {entry}")
    if unresolved:
        for name, reason in unresolved:
            print(f"  UNRESOLVED: {name} ({reason})")

    pruned_slugs = existing_slugs - {p.get("slug") for p in merged}
    if pruned_slugs:
        for slug in sorted(pruned_slugs):
            print(f"  PRUNED:     {slug}")

    print()
    print(f"Total: {len(output)} players")

    if args.dry_run:
        print("\nDry run; no file written.")
        print("\nPreview:")
        print(json.dumps(output, indent=2))
        return

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
        f.write("\n")

    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()
