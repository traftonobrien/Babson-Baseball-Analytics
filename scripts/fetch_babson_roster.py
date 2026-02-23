#!/usr/bin/env python3
"""Fetch height, weight, and class from Babson Athletics baseball roster.

Scrapes https://babsonathletics.com/sports/baseball/roster and outputs
web/data/roster.json keyed by slug (last_first) for merging with players.

Usage:
    python3 scripts/fetch_babson_roster.py
    python3 scripts/fetch_babson_roster.py --out web/data/roster.json
"""

import argparse
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROSTER_URL = "https://babsonathletics.com/sports/baseball/roster"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "web" / "data" / "roster.json"


def slugify_name(name: str) -> str:
    """'James Clark' -> 'clark_james'; 'Trafton O'Brien' -> 'obrien_trafton'."""
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    cleaned = re.sub(r"'", "", cleaned)
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    first = parts[0].lower()
    last = parts[-1].lower()
    return f"{last}_{first}"


def fetch_roster() -> list[dict]:
    """Fetch and parse roster page. Returns list of {slug, name, height, weight, class_}."""
    resp = requests.get(ROSTER_URL, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    results = []
    for li in soup.find_all("li", class_="sidearm-roster-player"):
        url = li.get("data-player-url") or ""
        if "/coaches/" in url:
            continue

        # Name from first roster link (exclude "Full Bio")
        a = li.find("a", href=re.compile(r"/roster/[^/]+/\d+$"))
        if not a:
            continue
        name = (a.get_text() or "").strip()
        if not name or name == "Full Bio":
            # Try aria-label: "James Clark - View Full Bio"
            aria = a.get("aria-label") or ""
            if " - " in aria:
                name = aria.split(" - ")[0].strip()
        if not name:
            continue

        # Height, weight, class from Sidearm structure
        height_el = li.find(class_="sidearm-roster-player-height")
        weight_el = li.find(class_="sidearm-roster-player-weight")
        class_el = li.find(class_="sidearm-roster-player-academic-year")

        height = (height_el.get_text() or "").strip() if height_el else None
        weight_raw = (weight_el.get_text() or "").strip() if weight_el else None
        class_ = (class_el.get_text() or "").strip() if class_el else None

        # Normalize weight: "175 lbs" -> "175"
        weight = None
        if weight_raw:
            m = re.search(r"(\d+)", weight_raw)
            if m:
                weight = m.group(1)

        slug = slugify_name(name)
        if not slug:
            continue

        results.append({
            "slug": slug,
            "name": name,
            "height": height or None,
            "weight": weight,
            "class": class_.strip() if class_ else None,
        })

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Babson baseball roster")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing")
    args = parser.parse_args()

    try:
        roster = fetch_roster()
    except requests.RequestException as e:
        print(f"Error fetching roster: {e}", file=sys.stderr)
        sys.exit(1)

    # Output as slug -> {height, weight, class} for easy merge
    by_slug = {}
    for r in roster:
        data = {"height": r["height"], "weight": r["weight"], "class": r["class"]}
        by_slug[r["slug"]] = data
        # Add aliases for players.json slug format (e.g. grindle_cam vs grindle_cameron)
        if r["slug"] == "grindle_cameron":
            by_slug["grindle_cam"] = data

    if args.dry_run:
        json.dump(by_slug, sys.stdout, indent=2)
        print()
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(by_slug, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(by_slug)} players to {out_path}")


if __name__ == "__main__":
    main()
