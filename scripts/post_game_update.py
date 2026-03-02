import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from import_boxscore import (
        fetch_html,
        find_player,
        iso_timestamp,
        map_teams,
        parse_url_metadata,
        update_index,
        write_json,
    )
except ImportError:  # pragma: no cover
    from scripts.import_boxscore import (  # type: ignore
        fetch_html,
        find_player,
        iso_timestamp,
        map_teams,
        parse_url_metadata,
        update_index,
        write_json,
    )

try:
    from normalize_stats_player_slugs import normalize_stats_player_slugs
except ImportError:  # pragma: no cover
    from scripts.normalize_stats_player_slugs import normalize_stats_player_slugs  # type: ignore

try:
    from lib.canonical_players import get_player_id_by_alias
except ImportError:  # pragma: no cover
    from scripts.lib.canonical_players import get_player_id_by_alias  # type: ignore

try:
    from sidearm_parser import normalize_player_name, parse_all_teams, parse_game_meta
except ImportError:  # pragma: no cover
    from scripts.sidearm_parser import normalize_player_name, parse_all_teams, parse_game_meta  # type: ignore


def _warn_uncommitted_stats(output_root: str) -> None:
    stats_dir = os.path.join(output_root, "stats")
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


def strip_score_suffix(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    cleaned = value.strip()
    if cleaned and cleaned.split()[-1].isdigit():
        cleaned = " ".join(cleaned.split()[:-1])
    return cleaned or value


def read_fixture(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def parse_outing_map(entries: Optional[List[str]]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    if not entries:
        return mapping
    for entry in entries:
        if "=" not in entry:
            raise ValueError(f"Invalid outing map entry '{entry}', expected PlayerId=DateId")
        player_id, date_id = entry.split("=", 1)
        mapping[player_id.strip()] = date_id.strip()
    return mapping


def load_json(path: Path) -> Optional[Dict[str, object]]:
    if not path.exists():
        return None
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json_path(path: Path, payload: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=True)
        handle.write("\n")


def build_game_payload(
    season: int,
    game_id: str,
    url: str,
    meta: Dict[str, Optional[object]],
    teams: Dict[str, Dict[str, List[Dict[str, Optional[object]]]]],
    babson_name: str,
    opponent_name: Optional[str],
    imported_at: str,
) -> Dict[str, object]:
    opponent_display = meta.get("opponent") or opponent_name
    opponent_display = strip_score_suffix(opponent_display)
    return {
        "season": season,
        "gameId": str(game_id),
        "url": url,
        "date": meta.get("date"),
        "opponent": opponent_display,
        "teams": {
            "babson": {
                "batting": teams.get(babson_name, {}).get("batting", []),
                "pitching": teams.get(babson_name, {}).get("pitching", []),
            },
            "opponent": {
                "batting": teams.get(opponent_name, {}).get("batting", []) if opponent_name else [],
                "pitching": teams.get(opponent_name, {}).get("pitching", []) if opponent_name else [],
            },
        },
        "importedAt": imported_at,
    }


def build_player_payload(
    season: int,
    game_id: str,
    url: str,
    player_name: str,
    team_key: str,
    batting_row: Optional[Dict[str, Optional[object]]],
    pitching_row: Optional[Dict[str, Optional[object]]],
    imported_at: str,
    resolved_player_id: Optional[str] = None,
) -> Dict[str, object]:
    player_display = None
    if batting_row or pitching_row:
        player_display = (batting_row or pitching_row).get("name")
    if not player_display:
        player_display = player_name
    return {
        "season": season,
        "gameId": str(game_id),
        "playerId": resolved_player_id,
        "playerDisplay": player_display,
        "team": team_key,
        "batting": batting_row,
        "pitching": pitching_row,
        "source": {"url": url, "importedAt": imported_at},
    }


def merge_linked_games(
    existing: List[Dict[str, object]],
    new_entry: Dict[str, object],
) -> List[Dict[str, object]]:
    seen = {str(item.get("gameId")) for item in existing}
    if str(new_entry.get("gameId")) not in seen:
        return existing + [new_entry]
    return existing


def update_outing_meta(
    public_root: Path,
    outing_map: Dict[str, str],
    game_summary: Dict[str, object],
    updated_at: str,
    dry_run: bool,
) -> Tuple[List[Path], List[str]]:
    planned: List[Path] = []
    warnings: List[str] = []
    for player_id, date_id in outing_map.items():
        outing_dir = public_root / "data" / player_id / date_id
        if not outing_dir.exists():
            warnings.append(f"Outing folder missing: {outing_dir}")
            continue
        meta_path = outing_dir / "outing_meta.json"
        existing = load_json(meta_path) or {}
        linked = existing.get("linkedGames", []) if isinstance(existing.get("linkedGames"), list) else []
        merged = merge_linked_games(linked, game_summary)
        payload = {
            "outingId": f"{player_id}/{date_id}",
            "linkedGames": merged,
            "updatedAt": updated_at,
        }
        planned.append(meta_path)
        if not dry_run:
            write_json_path(meta_path, payload)
    return planned, warnings

def run(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Post-game workflow orchestrator.")
    parser.add_argument("--boxscore-url", required=True, help="Sidearm boxscore URL")
    parser.add_argument("--team", default="Babson", help="Team name to disambiguate (default: Babson)")
    parser.add_argument("--players", nargs="+", required=True, help="Player display names")
    parser.add_argument("--outing-map", nargs="*", help="PlayerId=DateId pairs")
    parser.add_argument("--fixture", help="Path to fixture HTML (offline mode)")
    parser.add_argument("--dry-run", action="store_true", help="Print planned outputs without writing")
    parser.add_argument("--output-root", default=os.path.join("web", "public"), help="Base output dir")
    parser.add_argument("--timestamp", help="Override importedAt/updatedAt timestamp (ISO Z)")
    parser.add_argument("--debug", action="store_true", help="Print table classification debug output")
    args = parser.parse_args(argv)

    if not args.dry_run:
        _warn_uncommitted_stats(args.output_root)

    season, game_id = parse_url_metadata(args.boxscore_url)
    html = read_fixture(args.fixture) if args.fixture else fetch_html(args.boxscore_url)

    meta = parse_game_meta(html, debug=args.debug)
    teams = parse_all_teams(html, debug=args.debug)
    babson_name, opponent_name = map_teams(teams, args.team)

    imported_at = args.timestamp or iso_timestamp()
    game_payload = build_game_payload(
        season,
        game_id,
        args.boxscore_url,
        meta,
        teams,
        babson_name,
        opponent_name,
        imported_at,
    )

    public_root = Path(args.output_root)
    game_path = public_root / "stats" / "games" / str(season) / f"{game_id}.json"
    season_index_path = public_root / "stats" / "seasons" / str(season) / "games.json"

    player_payloads: List[Dict[str, object]] = []
    planned_player_paths: List[Path] = []
    success_count = 0

    for player_name in args.players:
        target_norm = normalize_player_name(player_name)
        batting_row = find_player(teams.get(babson_name, {}).get("batting", []), target_norm)
        pitching_row = find_player(teams.get(babson_name, {}).get("pitching", []), target_norm)
        player_team_key = "babson"

        if batting_row is None and pitching_row is None and opponent_name:
            opponent_batting = teams.get(opponent_name, {}).get("batting", [])
            opponent_pitching = teams.get(opponent_name, {}).get("pitching", [])
            batting_row = find_player(opponent_batting, target_norm)
            pitching_row = find_player(opponent_pitching, target_norm)
            if batting_row or pitching_row:
                player_team_key = "opponent"

        if not batting_row and not pitching_row:
            print(f"Warning: player not found in boxscore: {player_name}")
            continue

        # Resolve display name from the boxscore row
        player_display = None
        if batting_row or pitching_row:
            player_display = (batting_row or pitching_row).get("name")
        if not player_display:
            player_display = player_name
        resolved_player_id = get_player_id_by_alias(str(player_display)) or get_player_id_by_alias(player_name)
        if not resolved_player_id:
            print(f"Warning: could not resolve playerId from Arsenals: {player_display}")
            continue

        payload = build_player_payload(
            season,
            game_id,
            args.boxscore_url,
            player_name,
            player_team_key,
            batting_row,
            pitching_row,
            imported_at,
            resolved_player_id=resolved_player_id,
        )
        player_payloads.append(payload)
        player_id_path = public_root / "stats" / "players-by-id" / str(payload["playerId"]) / str(season) / f"{game_id}.json"
        planned_player_paths.append(player_id_path)
        success_count += 1

    if success_count == 0:
        print("No player imports succeeded.")
        return 1

    index_entry = {
        "gameId": str(game_id),
        "url": args.boxscore_url,
        "opponent": game_payload.get("opponent"),
        "date": game_payload.get("date"),
        "importedAt": imported_at,
        "playerIdsIncluded": sorted(
            [payload["playerId"] for payload in player_payloads if payload.get("playerId")]
        ),
    }

    if args.dry_run:
        print("Dry run: planned outputs")
        print(f"- game file: {game_path}")
        print(f"- season index: {season_index_path}")
        for player_path in planned_player_paths:
            print(f"- player file: {player_path}")
    else:
        write_json(str(game_path), game_payload)
        for payload in player_payloads:
            output_paths = [
                public_root / "stats" / "players-by-id" / str(payload["playerId"]) / str(season) / f"{game_id}.json"
            ]
            for player_path in output_paths:
                write_json(str(player_path), payload)
                if not player_path.exists():
                    print(f"ERROR: player file missing after write: {player_path}", file=sys.stderr)
                    return 1
        update_index(str(season_index_path), index_entry)

    outing_map = parse_outing_map(args.outing_map)
    if outing_map:
        game_summary = {
            "gameId": str(game_id),
            "season": season,
            "opponent": game_payload.get("opponent"),
            "date": game_payload.get("date"),
        }
        planned_meta_paths, warnings = update_outing_meta(
            public_root,
            outing_map,
            game_summary,
            imported_at,
            args.dry_run,
        )
        for warning in warnings:
            print(f"Warning: {warning}")
        if args.dry_run:
            for path in planned_meta_paths:
                print(f"- outing meta: {path}")

    if not args.dry_run:
        for action in normalize_stats_player_slugs(public_root):
            print(f"Normalization: {action}")

    print("Post-game update summary")
    print(f"- gameId: {game_id}")
    print(f"- season: {season}")
    print(f"- opponent: {game_payload.get('opponent')}")
    print(f"- date: {game_payload.get('date')}")
    print(f"- players imported: {success_count}/{len(args.players)}")
    return 0


def main() -> None:
    sys.exit(run())


if __name__ == "__main__":
    main()
