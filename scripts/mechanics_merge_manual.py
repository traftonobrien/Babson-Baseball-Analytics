#!/usr/bin/env python3
"""
Merge coach-entered manual measurements into coach_pack/notes.json.

Usage:
  python scripts/mechanics_merge_manual.py \
      --clip-dir output/mechanics/jason_finkelstein/pitch_test

Optional explicit paths:
  --manual output/mechanics/.../manual_template.json
  --notes  output/mechanics/.../coach_pack/notes.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Merge manual mechanics measurements into notes.json under the `manual` key.",
    )
    p.add_argument(
        "--clip-dir",
        default=None,
        help="Clip output directory (contains manual_template.json and coach_pack/notes.json).",
    )
    p.add_argument(
        "--manual",
        default=None,
        help="Path to manual_template.json. Overrides --clip-dir default.",
    )
    p.add_argument(
        "--notes",
        default=None,
        help="Path to notes.json. Overrides --clip-dir default.",
    )
    return p.parse_args()


def _load_json(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)


def _resolve_paths(args: argparse.Namespace) -> tuple[Path, Path]:
    clip_dir = Path(args.clip_dir).expanduser().resolve() if args.clip_dir else None
    manual_path = Path(args.manual).expanduser().resolve() if args.manual else None
    notes_path = Path(args.notes).expanduser().resolve() if args.notes else None

    if clip_dir is not None:
        manual_path = manual_path or (clip_dir / "manual_template.json")
        notes_path = notes_path or (clip_dir / "coach_pack" / "notes.json")

    if manual_path is None or notes_path is None:
        raise ValueError("Provide --clip-dir or both --manual and --notes.")

    return manual_path, notes_path


def main() -> None:
    args = _parse_args()
    try:
        manual_path, notes_path = _resolve_paths(args)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    if not manual_path.exists():
        print(f"ERROR: manual template not found: {manual_path}", file=sys.stderr)
        sys.exit(1)
    if not notes_path.exists():
        print(f"ERROR: notes.json not found: {notes_path}", file=sys.stderr)
        sys.exit(1)

    manual = _load_json(manual_path)
    notes = _load_json(notes_path)

    merged = {
        "source": str(manual_path),
        "merged_at_utc": datetime.now(timezone.utc).isoformat(),
        "view_mode": manual.get("view_mode"),
        "hand": manual.get("hand"),
        "manual_measurements": manual.get("manual_measurements", {}),
        "notes": manual.get("notes", []),
    }
    notes["manual"] = merged

    with open(notes_path, "w") as f:
        json.dump(notes, f, indent=2)
        f.write("\n")

    print(f"Merged manual measurements into {notes_path}")


if __name__ == "__main__":
    main()
