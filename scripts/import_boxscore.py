import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

try:
    from sidearm_parser import (
        normalize_name,
        normalize_player_name,
        normalize_team_name,
        parse_all_teams,
        parse_game_meta,
    )
except ImportError:  # pragma: no cover - support module imports
    from scripts.sidearm_parser import (  # type: ignore
        normalize_name,
        normalize_player_name,
        normalize_team_name,
        parse_all_teams,
        parse_game_meta,
    )


def _warn_uncommitted_stats(stats_dir: str) -> None:
    if not os.path.isdir(stats_dir):
        return
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain", stats_dir],
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            print(
                "Note: web/public/stats/ has uncommitted changes. "
                "Use the post-game-stats-importer skill to commit and deploy.",
                file=sys.stderr,
            )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass


def parse_url_metadata(url: str) -> Tuple[int, str]:
    parsed = urlparse(url)
    match = re.search(r"/stats/(\d{4})/.*/boxscore/(\d+)", parsed.path)
    if not match:
        raise ValueError(f"Could not parse season/gameId from URL path: {parsed.path}")
    season = int(match.group(1))
    game_id = match.group(2)
    return season, game_id


def fetch_html(url: str) -> str:
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    return response.text


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def player_key(display: str) -> str:
    key = re.sub(r"[^a-z0-9]+", "_", display.lower())
    return key.strip("_")


def canonical_slug(display: str) -> str:
    """Derive slug as last_first from a 'First Last' display name."""
    parts = re.sub(r"[^a-z0-9 ]+", "", display.lower()).split()
    if len(parts) >= 2:
        return "_".join([parts[-1]] + parts[:-1])
    return "_".join(parts) if parts else ""


def load_slug_index(index_path: str) -> Dict[str, str]:
    """Load the playerId -> slug mapping from index.json."""
    if not os.path.exists(index_path):
        return {}
    with open(index_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, dict) else {}


def resolve_slug(
    display: str,
    slug_index: Dict[str, str],
    player_id: Optional[str] = None,
) -> str:
    """Resolve canonical slug for a player.

    Priority:
    1. Direct playerId lookup in index
    2. Match display name forms against index values
    3. Derive using last_first rule
    """
    if player_id and player_id in slug_index:
        return slug_index[player_id]
    naive = player_key(display)
    canon = canonical_slug(display)
    for slug in slug_index.values():
        if slug in (naive, canon):
            return slug
    return canon


def find_player(rows: List[Dict[str, Optional[object]]], target_norm: str) -> Optional[Dict[str, Optional[object]]]:
    for row in rows:
        name = normalize_player_name(str(row.get("name", "")))
        if not name:
            continue
        if name == target_norm:
            return row
    return None


def strip_score_suffix(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = re.sub(r"\s+\d+$", "", value).strip()
    return cleaned or value


def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def write_json(path: str, payload: Dict[str, object]) -> None:
    ensure_dir(os.path.dirname(path))
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=True)
        handle.write("\n")


def load_index(path: str) -> List[Dict[str, object]]:
    if not os.path.exists(path):
        return []
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def update_index(path: str, entry: Dict[str, object]) -> None:
    entries = load_index(path)
    entries = [item for item in entries if str(item.get("gameId")) != str(entry.get("gameId"))]
    entries.append(entry)
    write_json(path, entries)


def map_teams(teams: Dict[str, Dict[str, List[Dict[str, Optional[object]]]]], team_label: str) -> Tuple[str, Optional[str]]:
    if not teams:
        return "", None
    normalized_target = normalize_team_name(team_label)
    babson_name = None
    for name in teams.keys():
        if normalize_team_name(name) == normalized_target and "composite" not in name.lower():
            babson_name = name
            break
    if babson_name is None:
        babson_name = list(teams.keys())[0]
    opponent_candidates = [
        name
        for name in teams.keys()
        if name != babson_name and "composite" not in name.lower()
    ]
    if not opponent_candidates:
        opponent_candidates = [name for name in teams.keys() if name != babson_name]
    opponent_name = None
    if opponent_candidates:
        opponent_name = max(
            opponent_candidates,
            key=lambda n: len(teams.get(n, {}).get("batting", []))
            + len(teams.get(n, {}).get("pitching", [])),
        )
    return babson_name, opponent_name


def main() -> None:
    parser = argparse.ArgumentParser(description="Import a Sidearm boxscore and extract player stats.")
    parser.add_argument("--url", required=True, help="Sidearm boxscore URL")
    parser.add_argument("--player", required=True, help="Target player name, e.g. 'First Last'")
    parser.add_argument("--team", default="Babson", help="Team name to disambiguate (default: Babson)")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print output without writing files")
    parser.add_argument("--debug", action="store_true", help="Print table classification debug output")
    args = parser.parse_args()

    if not args.dry_run:
        _warn_uncommitted_stats(os.path.join("web", "public", "stats"))

    season, game_id = parse_url_metadata(args.url)
    html = fetch_html(args.url)

    meta = parse_game_meta(html, debug=args.debug)
    teams = parse_all_teams(html, debug=args.debug)
    babson_name, opponent_name = map_teams(teams, args.team)

    babson_batting = teams.get(babson_name, {}).get("batting", [])
    babson_pitching = teams.get(babson_name, {}).get("pitching", [])
    opponent_batting = teams.get(opponent_name, {}).get("batting", []) if opponent_name else []
    opponent_pitching = teams.get(opponent_name, {}).get("pitching", []) if opponent_name else []

    opponent_display = meta.get("opponent") or opponent_name
    opponent_display = strip_score_suffix(opponent_display)

    imported_at = iso_timestamp()

    game_payload = {
        "season": season,
        "gameId": str(game_id),
        "url": args.url,
        "date": meta.get("date"),
        "opponent": opponent_display,
        "teams": {
            "babson": {"batting": babson_batting, "pitching": babson_pitching},
            "opponent": {"batting": opponent_batting, "pitching": opponent_pitching},
        },
        "importedAt": imported_at,
    }

    target_norm = normalize_player_name(args.player)
    player_team_key = "babson"
    batting_row = find_player(babson_batting, target_norm)
    pitching_row = find_player(babson_pitching, target_norm)
    if batting_row is None and pitching_row is None and opponent_name:
        opponent_batting_match = find_player(opponent_batting, target_norm)
        opponent_pitching_match = find_player(opponent_pitching, target_norm)
        if opponent_batting_match or opponent_pitching_match:
            player_team_key = "opponent"
            batting_row = opponent_batting_match
            pitching_row = opponent_pitching_match

    slug_index_path = os.path.join("web", "public", "stats", "players", "index.json")
    slug_index = load_slug_index(slug_index_path)

    player_payload = None
    player_display = None
    if batting_row or pitching_row:
        player_display = (batting_row or pitching_row).get("name")
        resolved = resolve_slug(player_display, slug_index)
        player_payload = {
            "season": season,
            "gameId": str(game_id),
            "playerKey": resolved,
            "playerDisplay": player_display,
            "team": player_team_key,
            "batting": batting_row,
            "pitching": pitching_row,
            "source": {"url": args.url, "importedAt": imported_at},
        }

    game_path = os.path.join("web", "public", "stats", "games", str(season), f"{game_id}.json")
    season_index_path = os.path.join("web", "public", "stats", "seasons", str(season), "games.json")

    player_path = None
    if player_payload:
        player_path = os.path.join(
            "web",
            "public",
            "stats",
            "players",
            player_payload["playerKey"],
            str(season),
            f"{game_id}.json",
        )

    index_entry = {
        "gameId": str(game_id),
        "url": args.url,
        "opponent": opponent_display,
        "date": meta.get("date"),
        "importedAt": imported_at,
        "playersIncluded": [player_payload["playerKey"]] if player_payload else [],
    }

    if args.dry_run:
        print(json.dumps(game_payload, indent=2, sort_keys=True))
        if player_payload:
            print(json.dumps(player_payload, indent=2, sort_keys=True))
    else:
        write_json(game_path, game_payload)
        if player_payload and player_path:
            write_json(player_path, player_payload)
            if not os.path.exists(player_path):
                print(f"ERROR: player file missing after write: {player_path}", file=sys.stderr)
                sys.exit(1)
        update_index(season_index_path, index_entry)

    print("Import summary")
    print(f"- gameId: {game_id}")
    print(f"- season: {season}")
    print(f"- opponent: {opponent_display}")
    print(f"- date: {meta.get('date')}")
    print(f"- player found: {'yes' if player_payload else 'no'}")
    print(f"- batting line: {'yes' if batting_row else 'no'}")
    print(f"- pitching line: {'yes' if pitching_row else 'no'}")
    if args.dry_run:
        print("- dry run: no files written")
    else:
        print(f"- game file: {game_path}")
        if player_path:
            print(f"- player file: {player_path}")
        print(f"- season index: {season_index_path}")


if __name__ == "__main__":
    main()
