#!/usr/bin/env python3
"""
Migrate outings from flat web/public/data/<oldOutingId>/ to
hierarchical web/public/data/<playerId>/<dateId>/ structure.

Updates web/lib/dataIndex.ts entries to use buildDataPaths() and new outing.id format.

Usage:
  # Dry run (default, no changes):
  python3 scripts/migrate_existing_outings.py --mapping scripts/mapping_existing_outings.csv

  # Execute migration:
  python3 scripts/migrate_existing_outings.py --mapping scripts/mapping_existing_outings.csv --execute
"""

import argparse
import csv
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "web" / "public" / "data"
DATA_INDEX_PATH = REPO_ROOT / "web" / "lib" / "dataIndex.ts"

BUILD_DATA_PATHS_FUNC = """
export function buildDataPaths(playerId: string, dateId: string) {
  return {
    csvPath: `/data/${playerId}/${dateId}/pitch_data_overlay_lite.csv`,
    overlayDir: `/data/${playerId}/${dateId}/results`,
    clipsDir: `/data/${playerId}/${dateId}/clips`,
  };
}
"""


def load_mapping(mapping_file: str) -> list[dict]:
    """Load CSV mapping file and return list of row dicts."""
    rows = []
    with open(mapping_file, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            required = ["oldOutingId", "playerId", "dateId", "newOutingId"]
            for col in required:
                if col not in row or not row[col].strip():
                    print(f"ERROR: Missing or empty column '{col}' in mapping row: {row}")
                    sys.exit(1)
            rows.append(row)
    if not rows:
        print("ERROR: Mapping file is empty.")
        sys.exit(1)
    return rows


def is_old_format(csv_path: str) -> bool:
    """Detect old format using path segment count.

    Old: /data/<oldOutingId>/pitch_data_overlay_lite.csv  -> 3 segments
    New: /data/<playerId>/<dateId>/pitch_data_overlay_lite.csv -> 4 segments
    """
    stripped = csv_path.strip("/")
    segments = stripped.split("/")
    return len(segments) == 3


def validate_outing_folder(folder_path: Path, label: str) -> tuple[bool, str]:
    """Validate that required files exist in an outing folder.

    Returns (ok, message).
    """
    csv_file = folder_path / "pitch_data_overlay_lite.csv"
    clips_dir = folder_path / "clips"
    results_dir = folder_path / "results"

    if not folder_path.exists():
        return False, f"  MISSING: Folder does not exist: {folder_path}"

    if not csv_file.exists():
        return False, f"  MISSING: CSV file: {csv_file}"

    if not clips_dir.exists():
        return False, f"  MISSING: clips/ directory: {clips_dir}"

    if not results_dir.exists():
        return False, f"  MISSING: results/ directory: {results_dir}"

    # Count files
    clip_count = len(list(clips_dir.glob("pitch_*.mp4")))
    overlay_count = len(list(results_dir.glob("pitch_*_overlay.mp4")))

    # Count CSV rows (excluding header)
    with open(csv_file) as f:
        csv_rows = sum(1 for _ in f) - 1

    mismatches = []
    if clip_count != csv_rows:
        mismatches.append(f"clips={clip_count} vs csv_rows={csv_rows}")
    if overlay_count != csv_rows:
        mismatches.append(f"overlays={overlay_count} vs csv_rows={csv_rows}")

    if mismatches:
        return False, f"  MISMATCH in {label}: {', '.join(mismatches)}"

    return True, f"  OK: {label} ({csv_rows} pitches, {clip_count} clips, {overlay_count} overlays)"


def parse_outing_ids_from_data_index() -> list[str]:
    """Extract all outing id values from dataIndex.ts."""
    content = DATA_INDEX_PATH.read_text()
    return re.findall(r'id:\s*"([^"]+)"', content)


def replace_outing_block(content: str, old_id: str, player_id: str, date_id: str, new_id: str) -> str:
    """Replace an entire outing object block in dataIndex.ts.

    Finds the block starting with { that contains id: "oldId" and replaces
    the id, csvPath, overlayDir, clipsDir lines with the new format using
    buildDataPaths(). Preserves the label line.
    """
    # Find the outing block. We look for `{` before `id: "oldId"` and walk to matching `}`
    # Pattern: match from opening { through the full outing object
    # We need to find the block containing id: "oldId"

    # Strategy: find `id: "oldId"`, then walk backwards to find opening {,
    # then walk forward to find closing }
    id_pattern = f'id: "{re.escape(old_id)}"'
    id_match = re.search(id_pattern, content)
    if not id_match:
        print(f"  ERROR: Could not find id: \"{old_id}\" in dataIndex.ts")
        sys.exit(1)

    # Walk backwards from id match to find the opening {
    start = id_match.start()
    while start > 0 and content[start] != "{":
        start -= 1

    # Walk forward from id match to find the closing }
    # We need to count braces
    brace_count = 0
    end = start
    while end < len(content):
        if content[end] == "{":
            brace_count += 1
        elif content[end] == "}":
            brace_count -= 1
            if brace_count == 0:
                end += 1
                break
        end += 1

    old_block = content[start:end]

    # Extract the label from the old block
    label_match = re.search(r'label:\s*"([^"]*)"', old_block)
    if not label_match:
        print(f"  ERROR: Could not find label in outing block for {old_id}")
        sys.exit(1)
    label = label_match.group(1)

    # Build new block
    new_block = (
        "{\n"
        f'        id: "{new_id}",\n'
        f'        label: "{label}",\n'
        f'        ...buildDataPaths("{player_id}", "{date_id}"),\n'
        "      }"
    )

    return content[:start] + new_block + content[end:]


def ensure_build_data_paths_exists(content: str) -> str:
    """Inject buildDataPaths() function into dataIndex.ts if it doesn't exist."""
    if "buildDataPaths" in content:
        return content

    # Insert after getPlayer function
    get_player_match = re.search(r"(export function getPlayer\b.*?\n\})", content, re.DOTALL)
    if get_player_match:
        insert_pos = get_player_match.end()
        return content[:insert_pos] + "\n" + BUILD_DATA_PATHS_FUNC + content[insert_pos:]

    # Fallback: insert at end of file
    return content + "\n" + BUILD_DATA_PATHS_FUNC


def update_data_index(mapping: list[dict], dry_run: bool) -> str:
    """Rewrite dataIndex.ts with new format.

    Returns the new content (written to disk only if not dry_run).
    """
    content = DATA_INDEX_PATH.read_text()

    # Inject buildDataPaths if missing
    content = ensure_build_data_paths_exists(content)

    # Replace each outing block
    for row in mapping:
        old_id = row["oldOutingId"]
        player_id = row["playerId"]
        date_id = row["dateId"]
        new_id = row["newOutingId"]

        # Only replace if this outing is still in old format
        if f'id: "{old_id}"' in content:
            content = replace_outing_block(content, old_id, player_id, date_id, new_id)

    if not dry_run:
        DATA_INDEX_PATH.write_text(content)

    return content


def migrate_outings(mapping: list[dict], dry_run: bool) -> bool:
    """Main migration logic. Returns True on success."""
    print(f"\n{'=' * 60}")
    print(f"  OUTING MIGRATION {'(DRY RUN)' if dry_run else '(EXECUTING)'}")
    print(f"{'=' * 60}\n")

    # Phase 1: Validate all source folders
    print("Phase 1: Validating source folders...\n")
    all_valid = True
    for row in mapping:
        old_id = row["oldOutingId"]
        src = DATA_DIR / old_id
        ok, msg = validate_outing_folder(src, old_id)
        print(msg)
        if not ok:
            all_valid = False

    if not all_valid:
        print("\nERROR: Source validation failed. Aborting.")
        return False

    # Phase 2: Check for destination conflicts
    print("\nPhase 2: Checking for destination conflicts...\n")
    has_conflicts = False
    for row in mapping:
        player_id = row["playerId"]
        date_id = row["dateId"]
        dest = DATA_DIR / player_id / date_id
        if dest.exists():
            print(f"  CONFLICT: Destination already exists: {dest}")
            has_conflicts = True
        else:
            print(f"  OK: {dest} (does not exist)")

    if has_conflicts:
        print("\nERROR: Destination conflicts found. Aborting.")
        return False

    # Phase 3: Verify mapping matches dataIndex.ts
    print("\nPhase 3: Verifying mapping against dataIndex.ts...\n")
    existing_ids = parse_outing_ids_from_data_index()
    for row in mapping:
        old_id = row["oldOutingId"]
        if old_id not in existing_ids:
            print(f"  WARNING: {old_id} not found in dataIndex.ts")
        else:
            print(f"  OK: {old_id} found in dataIndex.ts")

    # Phase 4: Show what will happen
    print("\nPhase 4: Migration plan...\n")
    for row in mapping:
        old_id = row["oldOutingId"]
        player_id = row["playerId"]
        date_id = row["dateId"]
        src = DATA_DIR / old_id
        dest = DATA_DIR / player_id / date_id
        print(f"  MOVE: {src.relative_to(REPO_ROOT)}")
        print(f"    ->  {dest.relative_to(REPO_ROOT)}")
        print()

    # Phase 5: Show dataIndex.ts changes
    print("Phase 5: dataIndex.ts changes...\n")
    for row in mapping:
        old_id = row["oldOutingId"]
        new_id = row["newOutingId"]
        player_id = row["playerId"]
        date_id = row["dateId"]
        print(f"  REWRITE: id: \"{old_id}\"")
        print(f"       ->  id: \"{new_id}\"")
        print(f"           ...buildDataPaths(\"{player_id}\", \"{date_id}\")")
        print()

    if dry_run:
        # Generate and show what the new dataIndex.ts would look like
        new_content = update_data_index(mapping, dry_run=True)
        print("Phase 6: Preview of new dataIndex.ts:\n")
        print("-" * 60)
        for i, line in enumerate(new_content.split("\n"), 1):
            print(f"  {i:3d} | {line}")
        print("-" * 60)
        print("\nDRY RUN COMPLETE. No files were changed.")
        print("Re-run with --execute to apply changes.")
        return True

    # Phase 6: Execute folder moves
    print("Phase 6: Moving folders...\n")
    for row in mapping:
        old_id = row["oldOutingId"]
        player_id = row["playerId"]
        date_id = row["dateId"]
        src = DATA_DIR / old_id
        dest = DATA_DIR / player_id / date_id

        # Create parent directory (playerId)
        dest.parent.mkdir(parents=True, exist_ok=True)

        # Move
        shutil.move(str(src), str(dest))
        print(f"  MOVED: {old_id} -> {player_id}/{date_id}")

    # Phase 7: Validate moved folders
    print("\nPhase 7: Validating moved folders...\n")
    all_valid = True
    for row in mapping:
        player_id = row["playerId"]
        date_id = row["dateId"]
        new_id = row["newOutingId"]
        dest = DATA_DIR / player_id / date_id
        ok, msg = validate_outing_folder(dest, new_id)
        print(msg)
        if not ok:
            all_valid = False

    if not all_valid:
        print("\nERROR: Post-move validation failed!")
        print("ROLLBACK: git checkout HEAD -- web/lib/dataIndex.ts web/public/data/")
        return False

    # Phase 8: Update dataIndex.ts
    print("\nPhase 8: Updating dataIndex.ts...\n")
    update_data_index(mapping, dry_run=False)
    print("  dataIndex.ts updated.")

    # Phase 9: Build check
    print("\nPhase 9: Running build...\n")
    result = subprocess.run(
        ["npm", "--prefix", str(REPO_ROOT / "web"), "run", "build"],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("  BUILD FAILED!")
        print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
        print(result.stderr[-2000:] if len(result.stderr) > 2000 else result.stderr)
        print("\nROLLBACK: git checkout HEAD -- web/lib/dataIndex.ts web/public/data/")
        return False

    print("  Build passed.")

    # Phase 10: Post-migration validation
    print("\nPhase 10: Post-migration checks...\n")

    # Confirm old folders are gone
    remaining_old = [row["oldOutingId"] for row in mapping if (DATA_DIR / row["oldOutingId"]).exists()]
    if remaining_old:
        print(f"  WARNING: Old folders still exist: {remaining_old}")
    else:
        print("  OK: All old folders removed.")

    # Confirm no old paths in dataIndex.ts
    new_content = DATA_INDEX_PATH.read_text()
    old_path_refs = [row["oldOutingId"] for row in mapping if f'/data/{row["oldOutingId"]}/' in new_content]
    if old_path_refs:
        print(f"  WARNING: Old paths still referenced in dataIndex.ts: {old_path_refs}")
    else:
        print("  OK: No old paths in dataIndex.ts.")

    print(f"\n{'=' * 60}")
    print("  MIGRATION COMPLETE")
    print(f"{'=' * 60}")
    print("\nNext steps:")
    print("  git add web/public/data/ web/lib/dataIndex.ts")
    print('  git commit -m "Migrate outings to playerId/dateId structure"')
    print("  git push")

    return True


def main():
    parser = argparse.ArgumentParser(description="Migrate outings to playerId/dateId folder structure")
    parser.add_argument("--mapping", required=True, help="Path to mapping CSV file")
    parser.add_argument("--execute", action="store_true", help="Execute migration (default is dry run)")
    args = parser.parse_args()

    dry_run = not args.execute

    mapping = load_mapping(args.mapping)
    print(f"Loaded {len(mapping)} outings from mapping file.")

    success = migrate_outings(mapping, dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
