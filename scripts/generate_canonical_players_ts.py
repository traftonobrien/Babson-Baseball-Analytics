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

from lib.canonical_players import get_all_canonical

OUT_PATH = REPO_ROOT / "web" / "lib" / "canonicalPlayersData.ts"


def main() -> None:
    by_id, by_slug, slug_to_hand = get_all_canonical()
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
    lines.append('export const SLUG_TO_HAND: Record<string, "R" | "L"> = {')
    for slug, hand in sorted(slug_to_hand.items()):
        lines.append(f'  "{slug}": "{hand}",')
    lines.append("};")
    lines.append("")

    out = REPO_ROOT / "web" / "lib" / "canonicalPlayersData.ts"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
