#!/usr/bin/env python3
"""
Fetch Baseball Savant pitch movement leaderboard data and write to
web/public/data/mlb_pitch_comps.json for use in the MLB Comps feature.

Fetches per-pitcher, per-pitch-type movement averages (IVB, HB, velo,
release height/side) for both RHP and LHP, combining results into a single
static JSON. The web app reads this file client-side for nearest-neighbor
pitcher comp lookups.

HB sign convention: positive = toward 1B from catcher's perspective.
This matches Trackman's convention used throughout this codebase.

Usage:
    python scripts/sync_savant_comps.py
    python scripts/sync_savant_comps.py --year 2024 --min-pitches 100
    python scripts/sync_savant_comps.py --year 2024 --min-pitches 50 --out web/public/data/mlb_pitch_comps.json

Note: Savant has no official public API. This script uses the same CSV
endpoints used by tools like baseballr. Run manually or add to CI (weekly).
"""

import argparse
import csv
import io
import json
import sys
import time
from datetime import date
from pathlib import Path

import requests

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "web" / "public" / "data" / "mlb_pitch_comps.json"

SAVANT_BASE = "https://baseballsavant.mlb.com/leaderboard/pitch-movement"

# Pitch type abbreviations to fetch from Savant → canonical display names
PITCH_TYPE_MAP: dict[str, str] = {
    "FF": "Fastball",
    "SI": "Sinker",
    "FC": "Cutter",
    "FS": "Splitter",
    "CH": "Changeup",
    "CU": "Curveball",
    "SL": "Slider",
    "ST": "Sweeper",
    "KC": "Curveball",  # Knuckle-curve → Curveball
}

HANDS = ["R", "L"]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://baseballsavant.mlb.com/",
}


def fetch_csv(year: int, hand: str, pitch_type: str, min_pitches: int) -> str | None:
    """Fetch one Savant pitch-movement CSV. Returns raw CSV text or None on failure."""
    params = {
        "leaderboardType": "pitcher",
        "hand": hand,
        "pitch_type": pitch_type,
        "year": str(year),
        "min": str(min_pitches),
        "sort": "pitcher_break_z_induced",
        "sortDir": "desc",
        "csv": "true",
    }
    try:
        resp = requests.get(
            SAVANT_BASE, params=params, headers=HEADERS, timeout=30
        )
        if not resp.ok:
            print(
                f"  [warn] {hand}/{pitch_type}: HTTP {resp.status_code}",
                file=sys.stderr,
            )
            return None
        content = resp.text.strip()
        if not content or content.startswith("<"):
            print(f"  [warn] {hand}/{pitch_type}: response is HTML, not CSV", file=sys.stderr)
            return None
        return content
    except requests.RequestException as exc:
        print(f"  [warn] {hand}/{pitch_type}: {exc}", file=sys.stderr)
        return None


def safe_float(val: str) -> float | None:
    """Parse a float from a CSV cell; return None if blank or non-numeric."""
    val = val.strip()
    if not val or val == "-":
        return None
    try:
        return float(val)
    except ValueError:
        return None


def safe_int(val: str) -> int | None:
    try:
        return int(val.strip().replace(",", ""))
    except ValueError:
        return None


def find_col(row: dict[str, str], *candidates: str) -> str | None:
    """Return first matching column name from candidates, case-insensitive."""
    lower_map = {k.lower(): k for k in row}
    for c in candidates:
        key = lower_map.get(c.lower())
        if key is not None:
            return key
    return None


def parse_rows(csv_text: str, canonical_type: str, hand: str) -> list[dict]:
    """
    Parse a Savant pitch movement CSV into a list of normalized row dicts.

    Savant pitch-movement CSV columns (as of 2024):
      year, "last_name, first_name", pitcher_id, team_name, team_name_abbrev,
      pitch_hand, avg_speed, pitches_thrown, total_pitches, ..., pitch_type,
      pitch_type_name, pitcher_break_z, league_break_z, diff_z, rise,
      pitcher_break_z_induced (IVB inches), pitcher_break_x (HB inches),
      league_break_x, diff_x, tail, percent_rank_diff_z, percent_rank_diff_x

    HB sign convention in Savant's pitcher_break_x:
      positive = toward 1B from catcher's perspective (matches Trackman HB).
    """
    # Strip UTF-8 BOM if present
    csv_text = csv_text.lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(csv_text))
    rows = []
    for raw in reader:
        # Flexible column lookup for resilience against minor schema changes
        id_key = find_col(raw, "pitcher_id", "player_id", "mlb_id")
        # Savant uses "last_name, first_name" as the header for the name column
        name_key = find_col(
            raw,
            "last_name, first_name",
            "pitcher",
            "player_name",
            "pitcher_name",
            "name",
        )
        n_key = find_col(raw, "pitches_thrown", "n", "pitches", "pitch_count")
        velo_key = find_col(raw, "avg_speed", "avg_release_speed", "velocity")
        ivb_key = find_col(
            raw,
            "pitcher_break_z_induced",
            "pfx_z_induced",
            "ivb",
            "ind_vert_break",
        )
        # Savant uses pitcher_break_x (not _induced) for HB
        hb_key = find_col(
            raw,
            "pitcher_break_x",
            "pitcher_break_x_induced",
            "pfx_x_induced",
            "hb",
            "horz_break",
        )

        if not id_key or not name_key:
            continue

        pitcher_id = raw.get(id_key, "").strip()
        raw_name = raw.get(name_key, "").strip()
        if not pitcher_id or not raw_name:
            continue

        # "Last, First" → "First Last"
        if "," in raw_name:
            last, first = raw_name.split(",", 1)
            name = f"{first.strip()} {last.strip()}"
        else:
            name = raw_name

        n = safe_int(raw.get(n_key, "") if n_key else "")
        avg_velo = safe_float(raw.get(velo_key, "") if velo_key else "")
        avg_ivb = safe_float(raw.get(ivb_key, "") if ivb_key else "")
        avg_hb = safe_float(raw.get(hb_key, "") if hb_key else "")

        # Skip rows missing both primary movement metrics
        if avg_ivb is None and avg_hb is None:
            continue

        rows.append(
            {
                "pitcherId": pitcher_id,
                "name": name,
                "hand": hand,
                "pitchType": canonical_type,
                "n": n,
                "avgVelo": round(avg_velo, 1) if avg_velo is not None else None,
                "avgIvb": round(avg_ivb, 2) if avg_ivb is not None else None,
                "avgHb": round(avg_hb, 2) if avg_hb is not None else None,
            }
        )
    return rows


def build_pitcher_list(flat_rows: list[dict]) -> list[dict]:
    """
    Group flat per-pitch-type rows into per-pitcher objects:
    {pitcherId, name, hand, pitches: [...]}
    """
    # Key: (pitcherId, hand)
    pitcher_map: dict[tuple, dict] = {}
    for row in flat_rows:
        key = (row["pitcherId"], row["hand"])
        if key not in pitcher_map:
            pitcher_map[key] = {
                "pitcherId": row["pitcherId"],
                "name": row["name"],
                "hand": row["hand"],
                "pitches": [],
            }
        pitcher_map[key]["pitches"].append(
            {
                "pitchType": row["pitchType"],
                "n": row["n"],
                "avgVelo": row["avgVelo"],
                "avgIvb": row["avgIvb"],
                "avgHb": row["avgHb"],
            }
        )

    pitchers = list(pitcher_map.values())
    # Sort pitches within each pitcher by velo descending (primary pitch first)
    for p in pitchers:
        p["pitches"].sort(key=lambda x: x["avgVelo"] or 0, reverse=True)

    # Sort pitchers by name
    pitchers.sort(key=lambda x: x["name"])
    return pitchers


def main() -> int:
    parser = argparse.ArgumentParser(description="Sync Savant pitch movement data for MLB comps.")
    parser.add_argument("--year", type=int, default=2024, help="Season year (default: 2024)")
    parser.add_argument(
        "--min-pitches",
        type=int,
        default=100,
        help="Minimum pitches for inclusion (default: 100)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help=f"Output path (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.5,
        help="Seconds between requests (default: 0.5)",
    )
    args = parser.parse_args()

    print(f"Fetching Savant pitch movement data for {args.year} (min {args.min_pitches} pitches)...")
    print(f"Output: {args.out}\n")

    flat_rows: list[dict] = []
    fetched = 0
    failed = 0

    for hand in HANDS:
        for abbrev, canonical in PITCH_TYPE_MAP.items():
            print(f"  {hand}/{abbrev} ({canonical})...", end=" ", flush=True)
            csv_text = fetch_csv(args.year, hand, abbrev, args.min_pitches)
            if csv_text is None:
                failed += 1
                print("FAILED")
                if args.delay:
                    time.sleep(args.delay)
                continue

            rows = parse_rows(csv_text, canonical, hand)
            flat_rows.extend(rows)
            print(f"{len(rows)} pitchers")
            fetched += 1
            if args.delay:
                time.sleep(args.delay)

    if fetched == 0:
        print("\n[error] No data fetched. Check network connectivity.", file=sys.stderr)
        return 1

    # Deduplicate: if KC rows exist, they're already merged into Curveball canonical name
    # Keep the row with higher n when same pitcher+hand+pitchType appears twice
    dedup: dict[tuple, dict] = {}
    for row in flat_rows:
        key = (row["pitcherId"], row["hand"], row["pitchType"])
        existing = dedup.get(key)
        if existing is None or (row["n"] or 0) > (existing["n"] or 0):
            dedup[key] = row
    flat_rows = list(dedup.values())

    pitchers = build_pitcher_list(flat_rows)

    output = {
        "year": args.year,
        "updated": str(date.today()),
        "minPitches": args.min_pitches,
        "convention": {
            "hb": "positive = toward 1B from catcher's perspective (matches Trackman HB)",
            "ivb": "positive = upward (rising fastball = positive, matches Trackman IVB)",
        },
        "pitchers": pitchers,
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2))

    total_pitches = sum(len(p["pitches"]) for p in pitchers)
    print(
        f"\nDone. {len(pitchers)} pitchers, {total_pitches} pitch-type rows. "
        f"({failed} failed requests)\n"
        f"Written to {args.out}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
