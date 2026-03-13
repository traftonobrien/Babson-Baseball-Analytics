"""Import Trackman PDF export into structured session data.

Parses a Trackman Team Portal PDF export, extracts metadata and pitch-type
summary data, writes session files (meta.json, pitch_types.json, session_summary.json),
and updates the global index.

Usage:
    python3 scripts/import_trackman_pdf.py --pdf BobbyBurk.pdf
    python3 scripts/import_trackman_pdf.py --latest
    python3 scripts/import_trackman_pdf.py --all
    python3 scripts/import_trackman_pdf.py --pdf-dir /path/to/folder --latest
    python3 scripts/import_trackman_pdf.py --pdf BobbyBurk.pdf --debug-dump
"""

import argparse
import glob as globmod
import hashlib
import json
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.dirname(__file__))

from trackman_pdf.extract import extract_pdf
from trackman_pdf.meta import PdfMeta, parse_meta, slugify
from trackman_pdf.table import find_table, extract_table_from_pdf
from trackman_pdf.rows import parse_rows, parse_rows_from_cells
from trackman.summary import build_session_summary
from lib.canonical_players import get_canonical_name

def load_json(path: str) -> Any:
    with open(path, "r") as f:
        return json.load(f)


def write_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write(text)


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
                return entry.get("pitchTypesPath", "(unknown path)")
    except Exception:
        pass
    return None


def _validate_rows(rows: List[Dict[str, Any]]) -> None:
    """Reject import if data is clearly invalid."""
    if not rows:
        raise ValueError("No pitch type rows found in PDF. Check that the PDF contains a 'Stats per Pitch' table.")

    valid_rows = [r for r in rows if r.get("is_valid") is not False]
    if not valid_rows:
        raise ValueError("All rows failed validation. Check PDF extraction and column alignment.")

    has_velocity = any(r.get("avg_velocity_mph") is not None for r in valid_rows)
    if not has_velocity:
        raise ValueError("No average velocity data found. PDF may not contain pitch metrics.")

    has_type = any(r.get("pitch_type") is not None for r in valid_rows)
    if not has_type:
        raise ValueError("No pitch type data found. PDF may not contain pitch metrics.")


def _build_meta(
    pdf_meta: PdfMeta,
    filename: str,
    sha256: str,
    session_date: str,
    session_label: Optional[str],
    player_name: str,
) -> Dict[str, Any]:
    canonical_name = get_canonical_name(player_name)
    return {
        "player_name": canonical_name,
        "player_slug": slugify(player_name),
        "team": pdf_meta.team,
        "handedness": pdf_meta.handedness,
        "session_date": session_date,
        "date_from": pdf_meta.date_from,
        "date_to": pdf_meta.date_to,
        "session_label": session_label or pdf_meta.session_label,
        "report_url": pdf_meta.report_url,
        "source": {
            "type": "pdf_export",
            "filename": filename,
            "sha256": sha256,
            "imported_at": _iso_now(),
        },
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
        and e.get("pitchTypesPath") != f"/{rel_dir}/pitch_types.json"
    ]

    entry = {
        "playerName": meta["player_name"],
        "playerSlug": meta["player_slug"],
        "team": meta.get("team"),
        "handedness": meta.get("handedness"),
        "date": meta["session_date"],
        "sessionType": meta.get("session_label"),
        "pitchCount": summary.get("total_pitches"),
        "pitchTypes": summary.get("pitch_types"),
        "weightedAvgVelo": summary.get("weighted_avg_velocity_mph"),
        "pitchTypesPath": f"/{rel_dir}/pitch_types.json",
        "metaPath": f"/{rel_dir}/meta.json",
        "summaryPath": f"/{rel_dir}/session_summary.json",
        "source": meta.get("source"),
        "updatedAt": _iso_now(),
    }
    existing.append(entry)
    existing.sort(key=lambda e: (e.get("date", ""), e.get("playerSlug", "")))

    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    write_json(INDEX_PATH, existing)


def _dump_debug(
    pdf_path: str,
    sha256: str,
    extraction: Any,
    debug_pages: Optional[List[Dict[str, Any]]],
    debug_rows_by_page: Dict[int, List[Dict[str, Any]]],
) -> str:
    debug_dir = os.path.join("output", "debug", sha256)
    if os.path.exists(debug_dir):
        shutil.rmtree(debug_dir)
    os.makedirs(debug_dir, exist_ok=True)

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                write_text(os.path.join(debug_dir, f"page_text_{idx}.txt"), text)

                chars_out = [
                    {
                        "text": c.get("text"),
                        "x0": c.get("x0"),
                        "x1": c.get("x1"),
                        "top": c.get("top"),
                        "bottom": c.get("bottom"),
                    }
                    for c in page.chars
                ]
                write_json(os.path.join(debug_dir, f"page_chars_{idx}.json"), chars_out)
    except Exception as exc:
        write_text(os.path.join(debug_dir, "debug_error.txt"), f"{exc}\n")

    if extraction:
        for page in extraction.pages:
            write_json(
                os.path.join(debug_dir, f"detected_table_bbox_{page.page_number}.json"),
                {
                    "page": page.page_number,
                    "header_line": page.header_line,
                    "headers": page.headers,
                    "table_type": page.table_type,
                    "header_top": page.header_top,
                    "header_bottom": page.header_bottom,
                    "column_bounds": [
                        {"name": b.name, "x0": b.x0, "x1": b.x1}
                        for b in page.column_bounds
                    ],
                },
            )

    if debug_rows_by_page:
        for page_num, rows in debug_rows_by_page.items():
            write_json(os.path.join(debug_dir, f"extracted_rows_{page_num}.json"), rows)

    if debug_pages is not None:
        write_json(os.path.join(debug_dir, "debug_pages.json"), debug_pages)

    return debug_dir

# Default export folder: relative to repo root, then absolute fallback.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_PDF_DIRS = [
    os.path.join(_REPO_ROOT, "Trackman Exports"),
    "/Users/traftonobrien/Desktop/pitch-tracker/Trackman Exports",
]


def resolve_pdf_dir(explicit: Optional[str] = None) -> str:
    """Return the PDF directory to use.

    Priority: explicit arg > repo-relative > absolute fallback.
    Raises FileNotFoundError if nothing exists.
    """
    if explicit:
        if os.path.isdir(explicit):
            return explicit
        raise FileNotFoundError(f"PDF directory not found: {explicit}")
    for candidate in _DEFAULT_PDF_DIRS:
        if os.path.isdir(candidate):
            return candidate
    raise FileNotFoundError(
        "Default PDF export folder not found. "
        f"Looked in: {', '.join(_DEFAULT_PDF_DIRS)}. "
        "Use --pdf-dir to specify the folder."
    )


def list_pdfs(pdf_dir: str) -> List[str]:
    """Return all .pdf files in pdf_dir, sorted by modification time ascending."""
    pattern = os.path.join(pdf_dir, "**", "*.pdf")
    files = globmod.glob(pattern, recursive=True)
    files.sort(key=lambda f: os.path.getmtime(f))
    return files


def latest_pdf(pdf_dir: str) -> str:
    """Return the most recently modified PDF in pdf_dir."""
    pdfs = list_pdfs(pdf_dir)
    if not pdfs:
        raise FileNotFoundError(f"No PDF files found in {pdf_dir}")
    return pdfs[-1]


def parse_player_from_filename(pdf_path: str) -> Optional[str]:
    """Extract player name from filename like 'Bobby Burk 2:13.pdf'.

    Returns "Last, First" format (e.g. "Burk, Bobby") or None if unparseable.
    macOS stores '/' in filenames as ':'.
    """
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    # Strip trailing date pattern (e.g. " 2:13", " 12:05")
    name = re.sub(r'\s+\d{1,2}[:/]\d{1,2}$', '', stem).strip()
    if not name:
        return None
    # Split into parts: "Bobby Burk" -> ["Bobby", "Burk"]
    parts = name.split()
    if len(parts) < 2:
        return None
    # Last word is last name, everything before is first name(s)
    last = parts[-1]
    first = " ".join(parts[:-1])
    return f"{last}, {first}"


def parse_date_from_filename(pdf_path: str, year_hint: Optional[str] = None) -> Optional[str]:
    """Extract session date from filename like 'Bobby Burk 2:13.pdf' or 'Bobby Burk 2/13.pdf'.

    Returns ISO date string (YYYY-MM-DD) or None if no date found.
    macOS stores '/' in filenames as ':'.
    """
    stem = os.path.splitext(os.path.basename(pdf_path))[0]
    # Match trailing M:DD, M/DD, MM:DD, MM/DD (with : or / separator)
    m = re.search(r'(\d{1,2})[:/](\d{1,2})$', stem)
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    year = year_hint or str(datetime.now().year)
    return f"{year}-{month:02d}-{day:02d}"


def import_pdf(
    pdf_path: str,
    player_override: Optional[str] = None,
    session_date_override: Optional[str] = None,
    session_label_override: Optional[str] = None,
    copy_pdf: bool = True,
    debug_dump: bool = False,
) -> Dict[str, Any]:
    """Import a Trackman PDF export.

    Returns dict with keys: meta, pitches, summary, session_dir.
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # Step 1: Hash check
    sha256 = _sha256(pdf_path)
    existing = _check_already_imported(sha256)
    if existing and not debug_dump:
        print(f"Already imported (sha256 match): {existing}")
        print("Use a different PDF or delete the existing entry to reimport.")
        return {"skipped": True, "existing_path": existing}
    if existing and debug_dump:
        print(f"Already imported (sha256 match): {existing}")
        print("Re-importing to generate debug dump...")

    # Step 2: Extract text
    print(f"Extracting text from {pdf_path} ...")
    content = extract_pdf(pdf_path)
    if not content.text.strip():
        raise ValueError("PDF contains no extractable text.")

    # Step 3: Parse metadata
    pdf_meta = parse_meta(content.text)
    # Player name priority: CLI override > filename > PDF metadata
    filename_player = parse_player_from_filename(pdf_path)
    player_name = player_override or filename_player or pdf_meta.player_name or "Unknown Player"
    session_label = session_label_override or pdf_meta.session_label

    # Resolve session date: explicit override > filename > PDF metadata
    if session_date_override:
        session_date = session_date_override
    else:
        # Derive year hint from PDF metadata for filename parsing
        year_hint = None
        for d in (pdf_meta.date_to, pdf_meta.session_date, pdf_meta.date_from):
            if d and len(d) >= 4:
                year_hint = d[:4]
                break
        filename_date = parse_date_from_filename(pdf_path, year_hint)
        if filename_date:
            session_date = filename_date
        else:
            session_date = pdf_meta.session_date or pdf_meta.date_to or pdf_meta.date_from or "unknown_date"

    print(f"  Player:  {player_name}")
    print(f"  Date:    {session_date}")
    if pdf_meta.date_from or pdf_meta.date_to:
        print(f"  Range:   {pdf_meta.date_from or '(unknown)'} -> {pdf_meta.date_to or '(unknown)'}")
    print(f"  Label:   {session_label or '(none)'}")
    print(f"  Team:    {pdf_meta.team or '(none)'}")
    print(f"  Hand:    {pdf_meta.handedness or '(none)'}")

    # Step 4: Find table (char-based primary, text fallback)
    rows: List[Dict[str, Any]] = []
    table_source = "text"
    debug_pages = None
    debug_rows_by_page: Dict[int, List[Dict[str, Any]]] = {}

    extraction, debug_pages = extract_table_from_pdf(pdf_path, debug=debug_dump)
    if extraction:
        table_source = "pdfplumber"
        for page in extraction.pages:
            rows_cells = [r.cells for r in page.rows]
            if not rows_cells:
                continue
            if debug_dump:
                parsed, debug_rows = parse_rows_from_cells(
                    page.headers, rows_cells, page.table_type, return_debug=True
                )
                for debug_row in debug_rows:
                    idx = debug_row.get("source_index")
                    if isinstance(idx, int) and 0 <= idx < len(page.rows):
                        raw_row = page.rows[idx]
                        debug_row["page_number"] = page.page_number
                        debug_row["row_top"] = raw_row.top
                        debug_row["row_bottom"] = raw_row.bottom
                        debug_row["raw_text"] = raw_row.raw_text
                debug_rows_by_page[page.page_number] = debug_rows
            else:
                parsed = parse_rows_from_cells(page.headers, rows_cells, page.table_type, return_debug=False)
            rows.extend(parsed)

    if not rows:
        table = find_table(content.text)
        if table is None:
            raise ValueError(
                "No pitch table found in PDF. "
                "Ensure the PDF contains a 'Stats per Pitch' section with MPH, RPM, IVB columns."
            )
        print(f"  Table:   {table.table_type} ({len(table.data_lines)} rows, {len(table.headers)} cols)")
        rows = parse_rows(table.headers, table.data_lines, table.table_type)
    else:
        print(f"  Table:   {table_source} ({len(rows)} rows)")

    # Step 5: Validate
    _validate_rows(rows)
    print(f"  Parsed:  {len(rows)} pitch type rows")

    # Step 6: Build outputs
    meta = _build_meta(pdf_meta, content.filename, sha256, session_date, session_label, player_name)
    summary = build_session_summary(rows)

    if debug_dump:
        debug_dir = _dump_debug(pdf_path, sha256, extraction, debug_pages, debug_rows_by_page)
        print(f"  Debug:   {debug_dir}")

    # Compute session directory — always use session_date (single date)
    player_slug = slugify(player_name)
    date_slug = session_date.replace("-", "_") if session_date != "unknown_date" else "unknown_date"
    sess_slug = _session_slug(session_label)
    session_dir = os.path.join(SESSIONS_BASE, player_slug, date_slug, sess_slug)
    os.makedirs(session_dir, exist_ok=True)

    # Write files
    write_json(os.path.join(session_dir, "meta.json"), meta)
    write_json(os.path.join(session_dir, "pitch_types.json"), rows)
    write_json(os.path.join(session_dir, "session_summary.json"), summary)

    if copy_pdf:
        dest = os.path.join(session_dir, "source.pdf")
        shutil.copy2(pdf_path, dest)
        print(f"  Copied PDF to {dest}")

    # Step 7: Update index
    _update_index(meta, session_dir, summary)

    print(f"\nSession written to {session_dir}/")
    print(f"  pitch_types.json:      {len(rows)} rows")
    total_pitches = summary.get("total_pitches")
    pitch_types = summary.get("pitch_types") or []
    print(f"  session_summary.json:  total_pitches={total_pitches}, types: {', '.join(pitch_types)}")
    if summary.get("weighted_avg_velocity_mph") is not None:
        print(f"  Avg Velo:              {summary['weighted_avg_velocity_mph']} mph")
    print(f"Index updated:   {INDEX_PATH}")

    return {
        "meta": meta,
        "pitch_types": rows,
        "summary": summary,
        "session_dir": session_dir,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Trackman PDF export into structured session data")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--pdf", help="Path to a specific Trackman PDF export")
    source.add_argument("--latest", action="store_true", help="Import the most recently modified PDF in the export folder")
    source.add_argument("--all", action="store_true", dest="import_all", help="Import all PDFs in the export folder (oldest first)")
    parser.add_argument("--pdf-dir", help="PDF export folder (default: Trackman Exports/ in repo root)")
    parser.add_argument("--player", help="Override player name (Last, First)")
    parser.add_argument("--session-date", help="Override session date (YYYY-MM-DD)")
    parser.add_argument("--session-label", help="Override session label (e.g. LiveAB, Bullpen)")
    parser.add_argument("--no-copy-pdf", action="store_true", help="Do not copy PDF to output directory")
    parser.add_argument("--debug-dump", action="store_true", help="Write debug artifacts to output/debug/{sha256}/")
    args = parser.parse_args()

    if not args.pdf and not args.latest and not args.import_all:
        parser.error("One of --pdf, --latest, or --all is required")

    try:
        pdf_paths: List[str] = []
        if args.pdf:
            pdf_paths = [args.pdf]
        else:
            pdf_dir = resolve_pdf_dir(args.pdf_dir)
            print(f"PDF folder: {pdf_dir}")
            if args.latest:
                pdf_paths = [latest_pdf(pdf_dir)]
            else:
                pdf_paths = list_pdfs(pdf_dir)
                if not pdf_paths:
                    raise FileNotFoundError(f"No PDF files found in {pdf_dir}")
                print(f"Found {len(pdf_paths)} PDF(s)")

        results = []
        for path in pdf_paths:
            print(f"\n{'='*60}")
            print(f"Importing: {path}")
            print(f"{'='*60}")
            result = import_pdf(
                path,
                player_override=args.player,
                session_date_override=args.session_date,
                session_label_override=args.session_label,
                copy_pdf=not args.no_copy_pdf,
                debug_dump=args.debug_dump,
            )
            results.append(result)

        imported = [r for r in results if not r.get("skipped")]
        skipped = [r for r in results if r.get("skipped")]
        if len(pdf_paths) > 1:
            print(f"\nDone: {len(imported)} imported, {len(skipped)} skipped")

        # Recompute Stuff+ if any new sessions were imported
        if imported:
            import subprocess
            compute_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "compute_stuff_plus.py")
            if os.path.exists(compute_script):
                print("\nRecomputing Stuff+ scores...")
                result = subprocess.run(
                    [sys.executable, compute_script],
                    cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                )
                if result.returncode != 0:
                    print("Warning: Stuff+ recompute failed (non-fatal)", file=sys.stderr)
            else:
                print(f"Warning: compute_stuff_plus.py not found at {compute_script}", file=sys.stderr)

    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
