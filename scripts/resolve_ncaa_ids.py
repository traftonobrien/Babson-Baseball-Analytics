#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path
from typing import Any


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def load_rows(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    return []


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve NCAA player ids from cached leaderboard rows.")
    parser.add_argument("--year", default="2026")
    parser.add_argument("--team", default="Babson")
    parser.add_argument("--write", action="store_true", help="Write updated ids back to web/data/players.json")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent
    cache_dir = repo_root / "web" / "public" / "college-stats"
    players_path = repo_root / "web" / "data" / "players.json"

    batting_rows = load_rows(cache_dir / f"batting-{args.year}.json")
    pitching_rows = load_rows(cache_dir / f"pitching-{args.year}.json")
    players = json.loads(players_path.read_text(encoding="utf-8"))

    by_name: dict[str, str] = {}
    for row in batting_rows + pitching_rows:
      team_name = str(row.get("team_name") or "")
      player_name = str(row.get("player_name") or "")
      player_id = row.get("player_id")
      if not player_name or not player_id:
        continue
      if args.team.lower() not in team_name.lower():
        continue
      by_name[normalize_name(player_name)] = str(player_id)

    updated = []
    for entry in players:
        if not isinstance(entry, dict):
            updated.append(entry)
            continue
        name = str(entry.get("name") or entry.get("full_name") or "")
        ncaa_id = by_name.get(normalize_name(name))
        if ncaa_id:
            entry["ncaa_player_id"] = ncaa_id
        else:
            entry.setdefault("ncaa_player_id", None)
        updated.append(entry)

    matched = sum(1 for entry in updated if isinstance(entry, dict) and entry.get("ncaa_player_id"))
    print(f"Matched {matched} players for {args.team} in {args.year}")

    if args.write:
        players_path.write_text(json.dumps(updated, indent=2), encoding="utf-8")
        print(f"Wrote {players_path}")
    else:
        print(json.dumps(updated[:10], indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
