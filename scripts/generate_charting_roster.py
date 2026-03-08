#!/usr/bin/env python3
"""Generate charting roster data from the Babson Athletics baseball roster page.

Writes a deterministic JSON array used by the charting bootstrap endpoint so the
server can provide hitter/player selections without scraping the roster live.

Usage:
    python3 scripts/generate_charting_roster.py
    python3 scripts/generate_charting_roster.py --url https://.../roster --out web/data/chartingRoster.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup


DEFAULT_URL = "https://babsonathletics.com/sports/baseball/roster"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "web" / "data" / "chartingRoster.json"


def slugify_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    cleaned = re.sub(r"'", "", cleaned)
    parts = [part for part in re.split(r"\s+", cleaned) if part]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    return f"{parts[-1].lower()}_{parts[0].lower()}"


def normalize_name(raw_name: str) -> str:
    return " ".join(raw_name.split()).strip()


def parse_positions(raw_positions: str) -> list[str]:
    return [part.strip() for part in raw_positions.split("/") if part.strip()]


def parse_bats_throws(raw_value: str) -> tuple[str | None, str | None]:
    cleaned = raw_value.strip().upper()
    if "/" not in cleaned:
        return None, None
    bats, throws = cleaned.split("/", 1)
    return (bats or None, throws or None)


def fetch_charting_roster(url: str) -> list[dict]:
    response = requests.get(url, timeout=20)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    players_by_slug: dict[str, dict] = {}

    for li in soup.find_all("li", class_="sidearm-roster-player"):
        player_url = li.get("data-player-url") or ""
        if "/coaches/" in player_url:
            continue

        name_anchor = li.select_one('.sidearm-roster-player-name a[href*="/sports/baseball/roster/"]')
        if not name_anchor:
            continue

        name = normalize_name(name_anchor.get_text())
        if not name or name == "Full Bio":
            continue

        slug = slugify_name(name)
        if not slug:
            continue

        position_el = li.select_one(".sidearm-roster-player-position .text-bold")
        positions = parse_positions(position_el.get_text(" ", strip=True) if position_el else "")

        bats_throws_el = li.select_one(".sidearm-roster-player-custom3")
        bats, throws = parse_bats_throws(
            bats_throws_el.get_text(" ", strip=True) if bats_throws_el else ""
        )

        academic_year_el = li.select_one(".sidearm-roster-player-academic-year")
        academic_year = (
            normalize_name(academic_year_el.get_text()) if academic_year_el else None
        )

        players_by_slug[slug] = {
            "slug": slug,
            "name": name,
            "positions": positions,
            "bats": bats,
            "throws": throws,
            "academicYear": academic_year,
        }

    return sorted(players_by_slug.values(), key=lambda player: player["name"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate charting roster JSON")
    parser.add_argument("--url", default=DEFAULT_URL, help="Roster page URL")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Print JSON instead of writing")
    args = parser.parse_args()

    try:
        roster = fetch_charting_roster(args.url)
    except requests.RequestException as exc:
        print(f"Error fetching roster: {exc}", file=sys.stderr)
        sys.exit(1)

    if args.dry_run:
        json.dump(roster, sys.stdout, indent=2)
        print()
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        json.dump(roster, handle, indent=2)
        handle.write("\n")

    print(f"Wrote {len(roster)} charting roster players to {out_path}")


if __name__ == "__main__":
    main()
