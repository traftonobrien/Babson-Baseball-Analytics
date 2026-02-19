#!/usr/bin/env python3
import argparse
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import requests

TEAM_KEYS = [
    "team",
    "team_name",
    "school",
    "school_name",
    "college",
    "college_name",
    "institution",
]

NAME_KEYS = [
    "player",
    "player_name",
    "name",
    "full_name",
    "fullname",
]

ID_KEYS = ["player_id", "playerid", "id"]


def normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z]", "", value.lower())


def slugify_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    first = parts[0]
    last = parts[-1]
    return f"{last.lower()}_{first.lower()}"


def get_value_by_candidates(row: Dict[str, Any], candidates: Iterable[str]) -> Optional[Any]:
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


def pick_best_match(rows: List[Dict[str, Any]], name: str, team_hint: str) -> Optional[Dict[str, Any]]:
    name_target = normalize_name(name)
    team_target = team_hint.lower() if team_hint else ""
    best = None
    best_score = -1
    for row in rows:
        row_name = get_value_by_candidates(row, NAME_KEYS) or ""
        row_team = get_value_by_candidates(row, TEAM_KEYS) or ""
        if not row_name:
            continue
        score = 0
        if team_target and team_target in str(row_team).lower():
            score += 10
        row_normalized = normalize_name(str(row_name))
        if row_normalized == name_target:
            score += 5
        elif row_normalized in name_target or name_target in row_normalized:
            score += 2
        if score > best_score:
            best = row
            best_score = score
    return best


def resolve_player_id(base_url: str, name: str, team_hint: str) -> Optional[str]:
    url = f"{base_url.rstrip('/')}/api/d3db/search/players"
    try:
        response = requests.get(url, params={"q": name}, timeout=30)
    except requests.RequestException as exc:
        print(f"ERROR: search failed for {name}: {exc}", file=sys.stderr)
        return None

    if response.status_code != 200:
        print(
            f"ERROR: search failed for {name}: {response.status_code} {response.text}",
            file=sys.stderr,
        )
        return None

    rows = extract_rows(response.json())
    if not rows:
        return None

    if team_hint:
        team_matches = [
            row
            for row in rows
            if team_hint.lower() in str(get_value_by_candidates(row, TEAM_KEYS) or "").lower()
        ]
    else:
        team_matches = []

    candidates = team_matches if team_matches else rows
    best = pick_best_match(candidates, name, team_hint) or candidates[0]
    player_id = get_value_by_candidates(best, ID_KEYS)
    return str(player_id) if player_id else None


def load_players_from_json(path: Path) -> List[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("players.json must be a list")
    return data


def load_players_from_csv(path: Path, team: str, role: str) -> List[Dict[str, Any]]:
    players: List[Dict[str, Any]] = []
    seen = set()
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name = row.get("player_name") or row.get("name")
            if not name:
                continue
            name = name.strip()
            if not name or name in seen:
                continue
            seen.add(name)
            slug = slugify_name(name)
            players.append(
                {
                    "slug": slug,
                    "name": name,
                    "team": team,
                    "role": role,
                    "d3_player_id": None,
                }
            )
    return players


def normalize_entry(entry: Dict[str, Any]) -> Dict[str, Any]:
    slug = entry.get("slug") or entry.get("player_slug") or entry.get("playerSlug")
    name = entry.get("name") or entry.get("full_name") or entry.get("player_name")
    team = entry.get("team") or entry.get("school") or entry.get("school_name")
    role = entry.get("role")
    entry.setdefault("slug", slug)
    entry.setdefault("name", name)
    entry.setdefault("team", team)
    entry.setdefault("role", role)
    return entry


def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve D3 Dashboard player IDs.")
    parser.add_argument(
        "--source",
        default="web/data/players.json",
        help="Path to players.json or a CSV file (default: web/data/players.json)",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output path for updated JSON (default: overwrite JSON source)",
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
        help="Role used when importing from CSV (default: Pitcher)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write output; only print summary",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Resolve IDs even if d3_player_id is already set",
    )

    args = parser.parse_args()

    source_path = Path(args.source)
    if not source_path.exists():
        print(f"Source not found: {source_path}", file=sys.stderr)
        sys.exit(1)

    if source_path.suffix.lower() == ".csv":
        players_list = load_players_from_csv(source_path, args.team, args.role)
        output_path = Path(args.out) if args.out else Path("web/data/players_resolved.json")
    else:
        players_list = load_players_from_json(source_path)
        output_path = Path(args.out) if args.out else source_path

    updated: List[Dict[str, Any]] = []
    resolved_count = 0
    for entry in players_list:
        entry = normalize_entry(entry)
        name = entry.get("name") or entry.get("full_name")
        team = entry.get("team") or args.team

        if not name:
            updated.append(entry)
            continue

        if entry.get("d3_player_id") and not args.force:
            updated.append(entry)
            continue

        resolved_id = resolve_player_id(args.base_url, name, team)
        if resolved_id:
            resolved_count += 1
            entry["d3_player_id"] = resolved_id
        else:
            entry.setdefault("d3_player_id", None)

        updated.append(entry)

    for entry in updated:
        name = entry.get("name") or entry.get("full_name") or "Unknown"
        player_id = entry.get("d3_player_id")
        status = player_id if player_id else "NOT FOUND"
        print(f"{name} -> {status}")

    print(f"Resolved {resolved_count} player IDs.")

    if args.dry_run:
        print("Dry run enabled; no file written.")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(updated, handle, indent=2)
        handle.write("\n")

    print(f"Wrote updated roster to {output_path}")


if __name__ == "__main__":
    main()
