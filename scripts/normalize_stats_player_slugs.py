#!/usr/bin/env python3
"""Normalize legacy slug-based stats outputs into the playerId-first format."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

try:
    from lib.canonical_players import get_player_id_by_alias
except ImportError:  # pragma: no cover
    from scripts.lib.canonical_players import get_player_id_by_alias  # type: ignore


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=True)
        handle.write("\n")


def _canonical_player_id(value: str) -> str | None:
    return get_player_id_by_alias(value)


def _remove_tree(root: Path) -> None:
    for path in sorted(root.rglob("*"), reverse=True):
        if path.is_file():
            path.unlink()
        elif path.is_dir():
            path.rmdir()
    if root.exists():
        root.rmdir()


def normalize_stats_player_slugs(
    public_root: Path,
    dry_run: bool = False,
) -> list[str]:
    actions: list[str] = []
    stats_root = public_root / "stats"
    players_dir = stats_root / "players"
    players_by_id_dir = stats_root / "players-by-id"

    if not stats_root.exists():
        return actions

    index_path = players_dir / "index.json"
    if index_path.exists():
        actions.append(f"Removed legacy slug index {index_path}")
        if not dry_run:
            index_path.unlink()

    for player_json in sorted(players_dir.glob("*/*/*.json")):
        player_id = _canonical_player_id(player_json.parts[-3])
        if not player_id:
            continue
        payload = _load_json(player_json)
        if not isinstance(payload, dict):
            continue
        legacy_changed = False
        if payload.get("playerId") != player_id:
            payload["playerId"] = player_id
            legacy_changed = True
        if "playerKey" in payload:
            del payload["playerKey"]
            legacy_changed = True
        if legacy_changed:
            if not dry_run:
                _write_json(player_json, payload)
            actions.append(f"Normalized legacy player file {player_json}")

        mirror_path = players_by_id_dir / player_id / player_json.parts[-2] / player_json.name
        mirror_changed = True
        if mirror_path.exists():
            existing = _load_json(mirror_path)
            mirror_changed = existing != payload
        if mirror_changed:
            if not dry_run:
                _write_json(mirror_path, payload)
            actions.append(f"Synced playerId mirror {mirror_path}")

    for player_json in sorted(players_by_id_dir.glob("*/*/*.json")):
        player_id = player_json.parts[-3]
        payload = _load_json(player_json)
        if not isinstance(payload, dict):
            continue
        changed = False
        if payload.get("playerId") != player_id:
            payload["playerId"] = player_id
            changed = True
        if "playerKey" in payload:
            del payload["playerKey"]
            changed = True
        if changed:
            if not dry_run:
                _write_json(player_json, payload)
            actions.append(f"Updated playerId payload {player_json}")

    for games_index in sorted(stats_root.glob("seasons/*/games.json")):
        payload = _load_json(games_index)
        if not isinstance(payload, list):
            continue
        changed = False
        for row in payload:
            if not isinstance(row, dict):
                continue
            if isinstance(row.get("playerIdsIncluded"), list):
                values = row["playerIdsIncluded"]
            elif isinstance(row.get("playersIncluded"), list):
                values = row["playersIncluded"]
            else:
                values = []

            normalized_ids: list[str] = []
            seen_ids: set[str] = set()
            for value in values:
                player_id = _canonical_player_id(str(value))
                if not player_id or player_id in seen_ids:
                    continue
                seen_ids.add(player_id)
                normalized_ids.append(player_id)
            if row.get("playerIdsIncluded") != normalized_ids:
                row["playerIdsIncluded"] = normalized_ids
                changed = True
            if "playersIncluded" in row:
                del row["playersIncluded"]
                changed = True
        if changed:
            if not dry_run:
                _write_json(games_index, payload)
            actions.append(f"Updated player identities in {games_index}")

    if players_dir.exists():
        actions.append(f"Removed legacy slug player tree {players_dir}")
        if not dry_run:
            _remove_tree(players_dir)

    return actions


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Normalize legacy slug-based stats outputs into playerId-first stats."
    )
    parser.add_argument(
        "--public-root",
        default=os.path.join("web", "public"),
        help="Base public root (default: web/public)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report only")
    args = parser.parse_args()

    actions = normalize_stats_player_slugs(Path(args.public_root), dry_run=args.dry_run)
    if not actions:
        print("No slug changes required.")
        return 0
    for action in actions:
        print(action)
    return 0


if __name__ == "__main__":
    sys.exit(main())
