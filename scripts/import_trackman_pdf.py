"""Import Trackman PDF export into structured session data.

Parses a Trackman Team Portal PDF export, extracts metadata and pitch data,
writes session files (meta.json, pitches.json), and updates the global index.

Usage:
    python3 scripts/import_trackman_pdf.py --pdf BobbyBurk.pdf
    python3 scripts/import_trackman_pdf.py --pdf BobbyBurk.pdf --session-date 2026-02-14 --session-label LiveAB
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman_pdf.extract import extract_pdf
from trackman_pdf.meta import PdfMeta, parse_meta, slugify
from trackman_pdf.table import find_table
from trackman_pdf.rows import parse_rows

def load_json(path: str) -> Any:
    with open(path, "r") as f:
        return json.load(f)


def write_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


SESSIONS_BASE = os.path.join("web", "public", "trackman", "sessions")
INDEX_PATH = os.path.join("web", "public", "trackman", "index.json")


def _iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _session_slug(label: Optional[str]) -> str:
    if not label:
        return "session"
    return slugify(label) or "session"


def _check_already_imported(sha256: str) -> Optional[str]:
    """Check if a PDF with this hash has already been imported."""
    if not os.path.exists(INDEX_PATH):
        return None
    try:
        index = load_json(INDEX_PATH)
        if not isinstance(index, list):
            return None
        for entry in index:
            source = entry.get("source", {})
            if isinstance(source, dict) and source.get("sha256") == sha256:
                return entry.get("pitchesPath", "(unknown path)")
    except Exception:
        pass
    return None


def _validate_rows(rows: List[Dict[str, Any]]) -> None:
    """Reject import if data is clearly invalid."""
    if not rows:
        raise ValueError("No pitch rows found in PDF. Check that the PDF contains a 'Stats per Pitch' table.")

    has_velocity = any(r.get("velocity_mph") is not None for r in rows)
    if not has_velocity:
        raise ValueError("No velocity data found. PDF may not contain pitch metrics.")

    has_type = any(r.get("pitch_type") is not None for r in rows)
    if not has_type:
        raise ValueError("No pitch type data found. PDF may not contain pitch metrics.")


def _build_meta(
    pdf_meta: PdfMeta,
    filename: str,
    sha256: str,
    session_date: str,
    session_label: Optional[str],
    player_override: Optional[str],
) -> Dict[str, Any]:
    player_name = player_override or pdf_meta.player_name or "Unknown Player"
    return {
        "player_name": player_name,
        "player_slug": slugify(player_name),
        "team": pdf_meta.team,
        "handedness": pdf_meta.handedness,
        "session_date": session_date,
        "session_label": session_label or pdf_meta.session_label,
        "source": {
            "type": "pdf_export",
            "filename": filename,
            "sha256": sha256,
            "imported_at": _iso_now(),
        },
    }


def _build_summary(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build summary aggregates from pitch rows."""
    pitch_count = len(rows)

    # Collect values
    velos = [r["velocity_mph"] for r in rows if r.get("velocity_mph") is not None]
    spins = [r["spin_rpm"] for r in rows if r.get("spin_rpm") is not None]
    ivbs = [r["ivb_in"] for r in rows if r.get("ivb_in") is not None]
    hbs = [r["hb_in"] for r in rows if r.get("hb_in") is not None]
    exts = [r["extension_ft"] for r in rows if r.get("extension_ft") is not None]

    pitch_types = sorted(set(r.get("pitch_type", "") for r in rows if r.get("pitch_type")))

    def _stats(values):
        if not values:
            return None
        return {
            "avg": round(sum(values) / len(values), 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
        }

    return {
        "pitch_count": pitch_count,
        "pitch_types": pitch_types,
        "velo": _stats(velos),
        "spin": _stats(spins),
        "movement": {
            "ivb": _stats(ivbs),
            "hb": _stats(hbs),
        },
        "extension": _stats(exts),
    }


def _update_index(
    meta: Dict[str, Any],
    session_dir: str,
    summary: Dict[str, Any],
) -> None:
    """Upsert entry into the global sessions index."""
    existing: List[Dict[str, Any]] = []
    if os.path.exists(INDEX_PATH):
        try:
            data = load_json(INDEX_PATH)
            if isinstance(data, list):
                existing = data
        except Exception:
            pass

    rel_dir = os.path.relpath(session_dir, os.path.join("web", "public"))
    sha256 = meta.get("source", {}).get("sha256")

    # Remove any existing entry with same sha256 or same path
    existing = [
        e for e in existing
        if e.get("source", {}).get("sha256") != sha256
        and e.get("pitchesPath") != f"/{rel_dir}/pitches.json"
    ]

    entry = {
        "playerName": meta["player_name"],
        "playerSlug": meta["player_slug"],
        "team": meta.get("team"),
        "handedness": meta.get("handedness"),
        "date": meta["session_date"],
        "sessionType": meta.get("session_label"),
        "pitchCount": summary["pitch_count"],
        "pitchTypes": summary["pitch_types"],
        "veloRange": [summary["velo"]["min"], summary["velo"]["max"]] if summary.get("velo") else None,
        "pitchesPath": f"/{rel_dir}/pitches.json",
        "metaPath": f"/{rel_dir}/meta.json",
        "summaryPath": f"/{rel_dir}/summary.json",
        "source": meta.get("source"),
        "updatedAt": _iso_now(),
    }
    existing.append(entry)
    existing.sort(key=lambda e: (e.get("date", ""), e.get("playerSlug", "")))

    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    write_json(INDEX_PATH, existing)


def import_pdf(
    pdf_path: str,
    player_override: Optional[str] = None,
    session_date_override: Optional[str] = None,
    session_label_override: Optional[str] = None,
    copy_pdf: bool = True,
) -> Dict[str, Any]:
    """Import a Trackman PDF export.

    Returns dict with keys: meta, pitches, summary, session_dir.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # Step 1: Hash check
    sha256 = _sha256(pdf_path)
    existing = _check_already_imported(sha256)
    if existing:
        print(f"Already imported (sha256 match): {existing}")
        print("Use a different PDF or delete the existing entry to reimport.")
        return {"skipped": True, "existing_path": existing}

    # Step 2: Extract text
    print(f"Extracting text from {pdf_path} ...")
    content = extract_pdf(pdf_path)
    if not content.text.strip():
        raise ValueError("PDF contains no extractable text.")

    # Step 3: Parse metadata
    pdf_meta = parse_meta(content.text)
    player_name = player_override or pdf_meta.player_name or "Unknown Player"
    session_date = session_date_override or pdf_meta.session_date or "unknown_date"
    session_label = session_label_override or pdf_meta.session_label

    print(f"  Player:  {player_name}")
    print(f"  Date:    {session_date}")
    print(f"  Label:   {session_label or '(none)'}")
    print(f"  Team:    {pdf_meta.team or '(none)'}")
    print(f"  Hand:    {pdf_meta.handedness or '(none)'}")

    # Step 4: Find table
    table = find_table(content.text)
    if table is None:
        raise ValueError(
            "No pitch table found in PDF. "
            "Ensure the PDF contains a 'Stats per Pitch' section with MPH, RPM, IVB columns."
        )

    print(f"  Table:   {table.table_type} ({len(table.data_lines)} rows, {len(table.headers)} cols)")

    # Step 5: Parse rows
    rows = parse_rows(table.headers, table.data_lines, table.table_type)

    # Step 6: Validate
    _validate_rows(rows)
    print(f"  Parsed:  {len(rows)} pitch rows")

    # Step 7: Build outputs
    meta = _build_meta(pdf_meta, content.filename, sha256, session_date, session_label, player_override)
    summary = _build_summary(rows)

    # Compute session directory
    player_slug = slugify(player_name)
    date_slug = session_date.replace("-", "_") if session_date != "unknown_date" else "unknown_date"
    sess_slug = _session_slug(session_label)
    session_dir = os.path.join(SESSIONS_BASE, player_slug, date_slug, sess_slug)
    os.makedirs(session_dir, exist_ok=True)

    # Write files
    write_json(os.path.join(session_dir, "meta.json"), meta)
    write_json(os.path.join(session_dir, "pitches.json"), rows)
    write_json(os.path.join(session_dir, "summary.json"), summary)

    if copy_pdf:
        dest = os.path.join(session_dir, "source.pdf")
        shutil.copy2(pdf_path, dest)
        print(f"  Copied PDF to {dest}")

    # Step 8: Update index
    _update_index(meta, session_dir, summary)

    print(f"\nSession written to {session_dir}/")
    print(f"  pitches.json:  {len(rows)} rows")
    print(f"  summary.json:  {summary['pitch_count']} pitches, types: {', '.join(summary['pitch_types'])}")
    if summary.get("velo"):
        print(f"  Velo:          {summary['velo']['min']} - {summary['velo']['max']} mph")
    print(f"Index updated:   {INDEX_PATH}")

    return {
        "meta": meta,
        "pitches": rows,
        "summary": summary,
        "session_dir": session_dir,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Trackman PDF export into structured session data")
    parser.add_argument("--pdf", required=True, help="Path to Trackman PDF export")
    parser.add_argument("--player", help="Override player name (Last, First)")
    parser.add_argument("--session-date", help="Override session date (YYYY-MM-DD)")
    parser.add_argument("--session-label", help="Override session label (e.g. LiveAB, Bullpen)")
    parser.add_argument("--no-copy-pdf", action="store_true", help="Do not copy PDF to output directory")
    args = parser.parse_args()

    try:
        import_pdf(
            args.pdf,
            player_override=args.player,
            session_date_override=args.session_date,
            session_label_override=args.session_label,
            copy_pdf=not args.no_copy_pdf,
        )
    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
