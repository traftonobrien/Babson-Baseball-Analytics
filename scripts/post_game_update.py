import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from import_boxscore import (
        canonical_slug,
        fetch_html,
        find_player,
        iso_timestamp,
        load_slug_index,
        map_teams,
        parse_url_metadata,
        player_key,
        resolve_slug,
        update_index,
        write_json,
    )
except ImportError:  # pragma: no cover
    from scripts.import_boxscore import (  # type: ignore
        canonical_slug,
        fetch_html,
        find_player,
        iso_timestamp,
        load_slug_index,
        map_teams,
        parse_url_metadata,
        player_key,
        resolve_slug,
        update_index,
        write_json,
    )

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
    resolved_slug: Optional[str] = None,
) -> Dict[str, object]:
    player_display = None
    if batting_row or pitching_row:
        player_display = (batting_row or pitching_row).get("name")
    if not player_display:
        player_display = player_name
    slug = resolved_slug if resolved_slug else player_key(player_display)
    return {
        "season": season,
        "gameId": str(game_id),
        "playerKey": slug,
        "playerDisplay": player_display,
        "team": team_key,
        "batting": batting_row,
        "pitching": pitching_row,
        "source": {"url": url, "importedAt": imported_at},
    }


def choose_slug_for_player_id(player_id: str, players: List[str]) -> Optional[str]:
    cleaned_id = "".join(ch for ch in player_id.lower() if ch.isalpha())
    candidates = []
    for name in players:
        parts = [p for p in normalize_player_name(name).split() if p]
        if not parts:
            continue
        last = parts[-1]
        first_initial = parts[0][0] if parts else ""
        if last in cleaned_id:
            candidates.append((last, first_initial, name))
    if not candidates:
        return None
    if len(candidates) == 1:
        return canonical_slug(candidates[0][2])
    for last, first_initial, name in candidates:
        if cleaned_id.startswith(first_initial + last):
            return canonical_slug(name)
    return None


def update_slug_index(
    index_path: Path,
    outing_map: Dict[str, str],
    players: List[str],
    dry_run: bool,
) -> List[str]:
    warnings: List[str] = []
    index = {}
    existing = load_json(index_path)
    if existing:
        index = existing
    updated = False
    for player_id in outing_map.keys():
        if player_id in index:
            continue
        slug = choose_slug_for_player_id(player_id, players)
        if not slug:
            warnings.append(f"No slug match for playerId {player_id} (index unchanged)")
            continue
        index[player_id] = slug
        updated = True
    if updated and not dry_run:
        write_json_path(index_path, index)
    return warnings


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


def migrate_wrong_slug_paths(players_dir: Path, slug_index: Dict[str, str]) -> List[str]:
    """Move files from wrong-slug directories to canonical paths.

    Detects directories whose name parts match a canonical slug but are in
    the wrong order (e.g. connor_doan vs doan_connor) and moves all files
    to the canonical location.  Attempts ``git add``/``git rm`` to stage the
    result but silently ignores git failures.
    """
    actions: List[str] = []
    canonical_slugs = set(slug_index.values())
    if not players_dir.is_dir():
        return actions
    for child in sorted(players_dir.iterdir()):
        if not child.is_dir() or child.name in canonical_slugs:
            continue
        child_parts = set(child.name.split("_"))
        for canon in canonical_slugs:
            canon_parts = set(canon.split("_"))
            if child_parts == canon_parts and child.name != canon:
                canon_dir = players_dir / canon
                for src in sorted(child.rglob("*.json")):
                    rel = src.relative_to(child)
                    dst = canon_dir / rel
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(src), str(dst))
                # Remove empty tree
                shutil.rmtree(str(child), ignore_errors=True)
                actions.append(f"Migrated {child.name}/ -> {canon}/")
                try:
                    subprocess.run(
                        ["git", "add", str(canon_dir)],
                        capture_output=True, timeout=5,
                    )
                except (FileNotFoundError, subprocess.TimeoutExpired):
                    pass
                break
    if actions:
        for action in actions:
            print(f"Migration: {action}")
    return actions


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
    slug_index_path = public_root / "stats" / "players" / "index.json"
    slug_index = load_slug_index(str(slug_index_path))

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
        resolved = resolve_slug(player_display, slug_index)

        payload = build_player_payload(
            season,
            game_id,
            args.boxscore_url,
            player_name,
            player_team_key,
            batting_row,
            pitching_row,
            imported_at,
            resolved_slug=resolved,
        )
        player_payloads.append(payload)
        player_path = public_root / "stats" / "players" / payload["playerKey"] / str(season) / f"{game_id}.json"
        planned_player_paths.append(player_path)
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
        "playersIncluded": sorted([payload["playerKey"] for payload in player_payloads]),
    }

    if args.dry_run:
        print("Dry run: planned outputs")
        print(f"- game file: {game_path}")
        print(f"- season index: {season_index_path}")
        for player_path in planned_player_paths:
            print(f"- player file: {player_path}")
    else:
        write_json(str(game_path), game_payload)
        for payload, player_path in zip(player_payloads, planned_player_paths):
            write_json(str(player_path), payload)
            if not player_path.exists():
                print(f"ERROR: player file missing after write: {player_path}", file=sys.stderr)
                return 1
        update_index(str(season_index_path), index_entry)

    # Migrate any files under wrong slug paths before updating the index
    if not args.dry_run:
        players_dir = public_root / "stats" / "players"
        migrate_wrong_slug_paths(players_dir, slug_index)

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

        warnings = update_slug_index(slug_index_path, outing_map, args.players, args.dry_run)
        for warning in warnings:
            print(f"Warning: {warning}")
        if args.dry_run:
            print(f"- slug index: {slug_index_path}")

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
