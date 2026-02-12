#!/usr/bin/env python3
"""
Fix outing dateIds incorrectly labeled 2024 → 2025.

Dry run by default. Pass --execute to apply changes.

Renames directories in both trees:
  outings/<playerId>/<dateId>
  web/public/data/<playerId>/<dateId>

Updates web/lib/dataIndex.ts references.

Usage:
  python3 scripts/fix_outing_years.py --base-outings outings --base-web web/public/data
  python3 scripts/fix_outing_years.py --base-outings outings --base-web web/public/data --execute
"""

import argparse
import csv
import glob
import os
import re
import shutil
import sys

DATEINDEX_PATH = os.path.join("web", "lib", "dataIndex.ts")
PATTERN = re.compile(r"^2024_(\d{2})_(\d{2})(.*)$")


def find_2024_outings(base_dir: str) -> list[tuple[str, str, str]]:
    """Return list of (playerId, old_dateId, new_dateId) for 2024_ dirs."""
    results = []
    if not os.path.isdir(base_dir):
        return results
    for player_id in sorted(os.listdir(base_dir)):
        player_dir = os.path.join(base_dir, player_id)
        if not os.path.isdir(player_dir):
            continue
        for date_id in sorted(os.listdir(player_dir)):
            m = PATTERN.match(date_id)
            if m:
                new_date_id = f"2025_{m.group(1)}_{m.group(2)}{m.group(3)}"
                results.append((player_id, date_id, new_date_id))
    return results


def count_files(directory: str, pattern: str) -> int:
    return len(glob.glob(os.path.join(directory, pattern)))


def csv_row_count(csv_path: str) -> int | None:
    if not os.path.isfile(csv_path):
        return None
    with open(csv_path, "r") as f:
        reader = csv.reader(f)
        rows = list(reader)
    # Subtract header row
    return max(0, len(rows) - 1) if rows else 0


def validate_outing(outing_dir: str, label: str) -> list[str]:
    """Check pitch count parity inside an outing folder. Returns warnings."""
    warnings = []
    clips_dir = os.path.join(outing_dir, "clips")
    results_dir = os.path.join(outing_dir, "results")
    csv_path = os.path.join(outing_dir, "pitch_data_overlay_lite.csv")

    clip_count = count_files(clips_dir, "*.mp4") if os.path.isdir(clips_dir) else None
    overlay_count = count_files(results_dir, "*overlay*.mp4") if os.path.isdir(results_dir) else None
    csv_count = csv_row_count(csv_path)

    counts = {}
    if clip_count is not None:
        counts["clips/*.mp4"] = clip_count
    if overlay_count is not None:
        counts["results/*overlay*.mp4"] = overlay_count
    if csv_count is not None:
        counts["CSV rows"] = csv_count

    if len(counts) >= 2:
        values = list(counts.values())
        if len(set(values)) > 1:
            detail = ", ".join(f"{k}={v}" for k, v in counts.items())
            warnings.append(f"  PARITY WARNING ({label}): {detail}")

    return warnings


def validate_web_csv(web_dir: str, label: str) -> list[str]:
    """Confirm CSV exists in published web folder."""
    warnings = []
    csv_path = os.path.join(web_dir, "pitch_data_overlay_lite.csv")
    if not os.path.isfile(csv_path):
        warnings.append(f"  MISSING CSV ({label}): {csv_path}")
    return warnings


def main():
    parser = argparse.ArgumentParser(description="Fix 2024 dateIds → 2025")
    parser.add_argument("--base-outings", required=True, help="Path to outings/ tree")
    parser.add_argument("--base-web", required=True, help="Path to web/public/data/ tree")
    parser.add_argument("--execute", action="store_true", help="Actually perform renames (default: dry run)")
    args = parser.parse_args()

    mode = "EXECUTE" if args.execute else "DRY RUN"
    print(f"=== fix_outing_years ({mode}) ===\n")

    # Collect renames from both trees
    outings_renames = find_2024_outings(args.base_outings)
    web_renames = find_2024_outings(args.base_web)

    # Merge into a unified set
    all_renames: dict[tuple[str, str], str] = {}
    for player_id, old_id, new_id in outings_renames + web_renames:
        all_renames[(player_id, old_id)] = new_id

    if not all_renames:
        print("No 2024_ dateIds found. Nothing to do.")
        return

    # --- Report plan ---
    print(f"Found {len(all_renames)} outing(s) to rename:\n")

    conflicts = []
    moves: list[tuple[str, str, str]] = []  # (player_id, old_dateId, new_dateId)

    for (player_id, old_id), new_id in sorted(all_renames.items()):
        old_outing = os.path.join(args.base_outings, player_id, old_id)
        new_outing = os.path.join(args.base_outings, player_id, new_id)
        old_web = os.path.join(args.base_web, player_id, old_id)
        new_web = os.path.join(args.base_web, player_id, new_id)

        has_outing = os.path.isdir(old_outing)
        has_web = os.path.isdir(old_web)

        # Conflict check
        conflict = False
        if has_outing and os.path.exists(new_outing):
            conflicts.append(f"CONFLICT: {new_outing} already exists (source: {old_outing})")
            conflict = True
        if has_web and os.path.exists(new_web):
            conflicts.append(f"CONFLICT: {new_web} already exists (source: {old_web})")
            conflict = True

        if conflict:
            continue

        moves.append((player_id, old_id, new_id))

        print(f"  {player_id}/{old_id}  →  {player_id}/{new_id}")
        if has_outing:
            print(f"    outings:  {old_outing}  →  {new_outing}")
        else:
            print(f"    outings:  (not present)")
        if has_web:
            print(f"    web:      {old_web}  →  {new_web}")
        else:
            print(f"    web:      (not present)")
        print()

    if conflicts:
        print("!!! CONFLICTS DETECTED — aborting these outings:\n")
        for c in conflicts:
            print(f"  {c}")
        print()
        if args.execute:
            print("Aborting. Resolve conflicts before running with --execute.")
            sys.exit(1)

    # --- dataIndex.ts replacements ---
    if not os.path.isfile(DATEINDEX_PATH):
        print(f"WARNING: {DATEINDEX_PATH} not found. Skipping code update.\n")
        di_content = None
    else:
        with open(DATEINDEX_PATH, "r") as f:
            di_content = f.read()
        di_new = di_content
        print("dataIndex.ts replacements:")
        for player_id, old_id, new_id in moves:
            old_outing_id = f"{player_id}/{old_id}"
            new_outing_id = f"{player_id}/{new_id}"
            # Replace outing id strings
            if old_outing_id in di_new:
                print(f"  '{old_outing_id}'  →  '{new_outing_id}'")
                di_new = di_new.replace(old_outing_id, new_outing_id)
            # Replace buildDataPaths dateId argument
            old_build = f'buildDataPaths("{player_id}", "{old_id}")'
            new_build = f'buildDataPaths("{player_id}", "{new_id}")'
            if old_build in di_new:
                print(f"  {old_build}  →  {new_build}")
                di_new = di_new.replace(old_build, new_build)
            # Replace label year: "2024" → "2025" only within this player's label context
            # Labels like "Apr 27, 2024 – Name" → "Apr 27, 2025 – Name"
            old_label_year = f", 2024 –"
            new_label_year = f", 2025 –"
            if old_label_year in di_new:
                di_new = di_new.replace(old_label_year, new_label_year)
        print()

    # --- Execute or finish dry run ---
    if not args.execute:
        print("Dry run complete. Re-run with --execute to apply.\n")
        return

    print("Executing renames...\n")

    # Rename directories
    for player_id, old_id, new_id in moves:
        old_outing = os.path.join(args.base_outings, player_id, old_id)
        new_outing = os.path.join(args.base_outings, player_id, new_id)
        old_web = os.path.join(args.base_web, player_id, old_id)
        new_web = os.path.join(args.base_web, player_id, new_id)

        if os.path.isdir(old_outing):
            os.rename(old_outing, new_outing)
            print(f"  MOVED  {old_outing}  →  {new_outing}")
        if os.path.isdir(old_web):
            os.rename(old_web, new_web)
            print(f"  MOVED  {old_web}  →  {new_web}")

    # Write dataIndex.ts
    if di_content is not None and di_new != di_content:
        with open(DATEINDEX_PATH, "w") as f:
            f.write(di_new)
        print(f"\n  UPDATED  {DATEINDEX_PATH}")

    # --- Post-move validation ---
    print("\n=== Post-move validation ===\n")
    all_warnings = []

    for player_id, old_id, new_id in moves:
        new_outing = os.path.join(args.base_outings, player_id, new_id)
        new_web = os.path.join(args.base_web, player_id, new_id)

        if os.path.isdir(new_outing):
            label = f"outings/{player_id}/{new_id}"
            all_warnings.extend(validate_outing(new_outing, label))
            print(f"  OK  {label}")
        if os.path.isdir(new_web):
            label = f"web/{player_id}/{new_id}"
            all_warnings.extend(validate_web_csv(new_web, label))
            print(f"  OK  {label}")

    if all_warnings:
        print("\nWarnings:")
        for w in all_warnings:
            print(w)
    else:
        print("\nAll validations passed.")

    print(f"\nDone. {len(moves)} outing(s) renamed.\n")


if __name__ == "__main__":
    main()
