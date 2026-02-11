#!/usr/bin/env python3
"""Normalize legacy dateIds (mm_dd_yy) to canonical yyyy_mm_dd format.

Dry-run by default. Pass --execute to apply changes.

Updates:
  - web/lib/dataIndex.ts outing IDs and buildDataPaths() calls
  - outings/<playerId>/<old> → outings/<playerId>/<new> folder renames
  - web/public/data/<playerId>/<old> → web/public/data/<playerId>/<new> folder renames

Validates CSV pitch counts still align after rename.
"""

import argparse
import csv
import os
import re
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent

# Regex for legacy mm_dd_yy format (2-digit fields)
LEGACY_PATTERN = re.compile(r"^(\d{2})_(\d{2})_(\d{2})$")

# Regex for canonical yyyy_mm_dd format
CANONICAL_PATTERN = re.compile(r"^\d{4}_\d{2}_\d{2}(_\d{2})?$")


def is_legacy_dateid(dateid: str) -> bool:
    """Check if a dateId is in legacy mm_dd_yy format."""
    return bool(LEGACY_PATTERN.match(dateid))


def is_canonical_dateid(dateid: str) -> bool:
    """Check if a dateId is in canonical yyyy_mm_dd format."""
    return bool(CANONICAL_PATTERN.match(dateid))


def normalize_dateid(dateid: str, century: int = 20) -> str:
    """Convert mm_dd_yy to yyyy_mm_dd.

    Args:
        dateid: Legacy dateId like '03_26_25'
        century: Century prefix (default 20 → 2025)

    Returns:
        Canonical dateId like '2025_03_26'
    """
    m = LEGACY_PATTERN.match(dateid)
    if not m:
        return dateid
    mm, dd, yy = m.groups()
    return f"{century}{yy}_{mm}_{dd}"


def find_legacy_dateids_in_dataindex(content: str) -> list:
    """Find all legacy dateIds referenced in dataIndex.ts content.

    Returns list of (playerId, legacyDateId, normalizedDateId) tuples.
    """
    results = []
    # Match patterns like: "DJames1/03_26_25" or buildDataPaths("DJames1", "03_26_25")
    id_pattern = re.compile(r'"(\w+)/(\d{2}_\d{2}_\d{2})"')
    build_pattern = re.compile(r'buildDataPaths\("(\w+)",\s*"(\d{2}_\d{2}_\d{2})"\)')

    seen = set()
    for pattern in [id_pattern, build_pattern]:
        for match in pattern.finditer(content):
            player_id = match.group(1)
            date_id = match.group(2)
            if is_legacy_dateid(date_id):
                key = (player_id, date_id)
                if key not in seen:
                    seen.add(key)
                    results.append((player_id, date_id, normalize_dateid(date_id)))
    return results


def find_legacy_folders(base_dir: Path) -> list:
    """Find folders with legacy dateIds under base_dir/<playerId>/<dateId>/.

    Returns list of (playerId, legacyDateId, normalizedDateId, fullPath) tuples.
    """
    results = []
    if not base_dir.exists():
        return results
    for player_dir in sorted(base_dir.iterdir()):
        if not player_dir.is_dir():
            continue
        for date_dir in sorted(player_dir.iterdir()):
            if not date_dir.is_dir():
                continue
            if is_legacy_dateid(date_dir.name):
                results.append((
                    player_dir.name,
                    date_dir.name,
                    normalize_dateid(date_dir.name),
                    date_dir,
                ))
    return results


def count_csv_rows(csv_path: Path) -> int:
    """Count data rows in a CSV file (excluding header)."""
    if not csv_path.exists():
        return -1
    with open(csv_path) as f:
        reader = csv.reader(f)
        next(reader, None)  # skip header
        return sum(1 for _ in reader)


def update_dataindex_content(content: str, mappings: list) -> str:
    """Replace legacy dateIds in dataIndex.ts content.

    Args:
        content: Current file content
        mappings: List of (playerId, legacyDateId, normalizedDateId) tuples

    Returns:
        Updated content
    """
    updated = content
    for player_id, old_date, new_date in mappings:
        # Replace outing id strings
        updated = updated.replace(f'"{player_id}/{old_date}"', f'"{player_id}/{new_date}"')
        # Replace buildDataPaths calls
        updated = updated.replace(
            f'buildDataPaths("{player_id}", "{old_date}")',
            f'buildDataPaths("{player_id}", "{new_date}")',
        )
    return updated


def main():
    parser = argparse.ArgumentParser(
        description="Normalize legacy dateIds (mm_dd_yy) to yyyy_mm_dd"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Apply changes (default is dry-run)",
    )
    parser.add_argument(
        "--century",
        type=int,
        default=20,
        help="Century prefix for yy → yyyy (default: 20 → 20yy)",
    )
    args = parser.parse_args()

    mode = "EXECUTE" if args.execute else "DRY RUN"
    print(f"=== normalize_dateIds ({mode}) ===\n")

    # 1. Scan dataIndex.ts
    dataindex_path = REPO_ROOT / "web/lib/dataIndex.ts"
    if not dataindex_path.exists():
        print(f"ERROR: {dataindex_path} not found", file=sys.stderr)
        sys.exit(1)

    content = dataindex_path.read_text()
    di_mappings = find_legacy_dateids_in_dataindex(content)

    # 2. Scan filesystem folders
    outings_dir = REPO_ROOT / "outings"
    webdata_dir = REPO_ROOT / "web/public/data"
    outings_folders = find_legacy_folders(outings_dir)
    webdata_folders = find_legacy_folders(webdata_dir)

    # 3. Report findings
    all_mappings = {}
    for player_id, old, new in di_mappings:
        all_mappings[(player_id, old)] = new
    for player_id, old, new, _ in outings_folders + webdata_folders:
        all_mappings[(player_id, old)] = new

    if not all_mappings:
        print("No legacy dateIds found. Everything is canonical.")
        sys.exit(0)

    print("Legacy dateIds found:\n")
    print(f"  {'Player':<15} {'Legacy':<12} {'Normalized':<12} {'Sources'}")
    print(f"  {'-'*15} {'-'*12} {'-'*12} {'-'*30}")

    for (player_id, old), new in sorted(all_mappings.items()):
        sources = []
        if any(p == player_id and d == old for p, d, _ in di_mappings):
            sources.append("dataIndex.ts")
        if any(p == player_id and d == old for p, d, _, _ in outings_folders):
            sources.append("outings/")
        if any(p == player_id and d == old for p, d, _, _ in webdata_folders):
            sources.append("web/public/data/")
        print(f"  {player_id:<15} {old:<12} {new:<12} {', '.join(sources)}")

    print()

    if not args.execute:
        print("Pass --execute to apply these changes.")
        sys.exit(0)

    # 4. Execute: update dataIndex.ts first
    if di_mappings:
        print("Updating web/lib/dataIndex.ts...")
        new_content = update_dataindex_content(content, di_mappings)
        dataindex_path.write_text(new_content)
        print("  Done.")

    # 5. Execute: rename outings/ folders
    for player_id, old, new, old_path in outings_folders:
        new_path = old_path.parent / new
        if new_path.exists():
            print(f"  SKIP outings/{player_id}/{old} → {new} (destination exists)")
            continue
        print(f"  Rename outings/{player_id}/{old} → {new}")
        old_path.rename(new_path)

    # 6. Execute: rename web/public/data/ folders
    for player_id, old, new, old_path in webdata_folders:
        new_path = old_path.parent / new
        if new_path.exists():
            print(f"  SKIP web/public/data/{player_id}/{old} → {new} (destination exists)")
            continue
        print(f"  Rename web/public/data/{player_id}/{old} → {new}")
        old_path.rename(new_path)

    # 7. Validate CSV alignment
    print("\nValidating CSV alignment...")
    errors = []
    for (player_id, _), new in sorted(all_mappings.items()):
        csv_path = webdata_dir / player_id / new / "pitch_data_overlay_lite.csv"
        clips_dir = webdata_dir / player_id / new / "clips"
        results_dir = webdata_dir / player_id / new / "results"

        csv_rows = count_csv_rows(csv_path)
        if csv_rows < 0:
            continue  # folder may not be in web/public/data

        clip_count = len(list(clips_dir.glob("pitch_*.mp4"))) if clips_dir.exists() else 0
        overlay_count = len(list(results_dir.glob("pitch_*_overlay.mp4"))) if results_dir.exists() else 0

        if csv_rows != clip_count or csv_rows != overlay_count:
            errors.append(
                f"  MISMATCH {player_id}/{new}: CSV={csv_rows}, clips={clip_count}, overlays={overlay_count}"
            )
        else:
            print(f"  OK {player_id}/{new}: {csv_rows} pitches")

    if errors:
        print("\nERRORS:")
        for e in errors:
            print(e)
        sys.exit(1)

    print("\nNormalization complete.")


if __name__ == "__main__":
    main()
