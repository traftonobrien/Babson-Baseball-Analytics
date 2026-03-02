#!/usr/bin/env python3
"""Generate web/lib/canonicalPlayersData.ts from Arsenals.csv.

Run after updating Arsenals.csv. The generated file provides sync lookups
for canonical player names (no fetch required).

Usage:
    python3 scripts/generate_canonical_players_ts.py
"""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
scripts_dir = REPO_ROOT / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from lib.canonical_players import get_all_canonical, get_player_alias_map

OUT_PATH = REPO_ROOT / "web" / "lib" / "canonicalPlayersData.ts"


def main() -> None:
    by_id, by_slug, slug_to_hand = get_all_canonical()
    player_id_by_alias = get_player_alias_map()
    slug_by_id = {}
    player_id_by_slug = {}
    hand_by_id = {}
    for pid, name in by_id.items():
        match_slug = None
        for slug, slug_name in by_slug.items():
            if slug_name == name:
                match_slug = slug
                break
        if not match_slug:
            continue
        slug_by_id[pid] = match_slug
        player_id_by_slug[match_slug] = pid
        hand = slug_to_hand.get(match_slug)
        if hand:
            hand_by_id[pid] = hand

    lines = [
        "// AUTO-GENERATED from Arsenals.csv — do not edit",
        "// Run: python3 scripts/generate_canonical_players_ts.py",
        "",
        "export const CANONICAL_BY_PLAYER_ID: Record<string, string> = {",
    ]
    for pid, name in sorted(by_id.items()):
        escaped = name.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{pid}": "{escaped}",')
    lines.append("};")
    lines.append("")
    lines.append("export const CANONICAL_BY_SLUG: Record<string, string> = {")
    for slug, name in sorted(by_slug.items()):
        escaped = name.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'  "{slug}": "{escaped}",')
    lines.append("};")
    lines.append("")
    lines.append("export const SLUG_BY_PLAYER_ID: Record<string, string> = {")
    for pid, slug in sorted(slug_by_id.items()):
        lines.append(f'  "{pid}": "{slug}",')
    lines.append("};")
    lines.append("")
    lines.append("export const PLAYER_ID_BY_SLUG: Record<string, string> = {")
    for slug, pid in sorted(player_id_by_slug.items()):
        lines.append(f'  "{slug}": "{pid}",')
    lines.append("};")
    lines.append("")
    lines.append("export const PLAYER_ID_BY_ALIAS: Record<string, string> = {")
    for alias, pid in sorted(player_id_by_alias.items()):
        lines.append(f'  "{alias}": "{pid}",')
    lines.append("};")
    lines.append("")
    lines.append('export const SLUG_TO_HAND: Record<string, "R" | "L"> = {')
    for slug, hand in sorted(slug_to_hand.items()):
        lines.append(f'  "{slug}": "{hand}",')
    lines.append("};")
    lines.append("")
    lines.append('export const HAND_BY_PLAYER_ID: Record<string, "R" | "L"> = {')
    for pid, hand in sorted(hand_by_id.items()):
        lines.append(f'  "{pid}": "{hand}",')
    lines.append("};")
    lines.append("")

    out = REPO_ROOT / "web" / "lib" / "canonicalPlayersData.ts"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
