"""Verify Trackman PDF extraction against fixture with debug outputs."""

import argparse
import hashlib
import json
import os
import sys
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman_pdf.extract import extract_pdf
from trackman_pdf.meta import parse_meta
from trackman_pdf.rows import parse_rows_from_cells
from trackman_pdf.table import extract_table_from_pdf
from trackman.summary import build_session_summary


FIXTURE_PDF = os.path.join(
    os.path.dirname(__file__),
    "..",
    "tests",
    "fixtures",
    "trackman_pdf",
    "Baseball Team Portal Export.pdf",
)


def _sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _write_json(path: str, data: Any) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def _write_text(path: str, text: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w") as f:
        f.write(text)


def _dump_debug(
    pdf_path: str,
    sha256: str,
    extraction: Any,
    debug_rows_by_page: Dict[int, List[Dict[str, Any]]],
    page_numbers: Optional[List[int]] = None,
) -> str:
    debug_dir = os.path.join("output", "debug", sha256)
    if os.path.exists(debug_dir):
        for root, dirs, files in os.walk(debug_dir, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
            for name in dirs:
                os.rmdir(os.path.join(root, name))
    os.makedirs(debug_dir, exist_ok=True)

    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            for idx, page in enumerate(pdf.pages, start=1):
                if page_numbers and idx not in page_numbers:
                    continue
                text = page.extract_text() or ""
                _write_text(os.path.join(debug_dir, f"page_text_{idx}.txt"), text)
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
                _write_json(os.path.join(debug_dir, f"page_chars_{idx}.json"), chars_out)
    except Exception as exc:
        _write_text(os.path.join(debug_dir, "debug_error.txt"), f"{exc}\n")

    if extraction:
        for page in extraction.pages:
            if page_numbers and page.page_number not in page_numbers:
                continue
            _write_json(
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
            if page_numbers and page_num not in page_numbers:
                continue
            _write_json(os.path.join(debug_dir, f"extracted_rows_{page_num}.json"), rows)

    return debug_dir


def _summarize(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    valid_rows = [r for r in rows if r.get("is_valid") is not False]
    invalid_rows = [r for r in rows if r.get("is_valid") is False]
    pitch_types = Counter(r.get("pitch_type") for r in valid_rows if r.get("pitch_type"))

    velos = [r["avg_velocity_mph"] for r in valid_rows if r.get("avg_velocity_mph") is not None]
    spins = [r["avg_spin_rpm"] for r in valid_rows if r.get("avg_spin_rpm") is not None]

    def _range(vals: List[float]) -> Optional[Tuple[float, float]]:
        if not vals:
            return None
        return (min(vals), max(vals))

    warning_counts = Counter()
    for row in invalid_rows:
        for w in row.get("parse_warnings", []):
            warning_counts[w] += 1

    return {
        "pitch_count": len(rows),
        "valid_count": len(valid_rows),
        "invalid_count": len(invalid_rows),
        "pitch_types": dict(pitch_types),
        "velo_range": _range(velos),
        "spin_range": _range(spins),
        "invalid_warnings": warning_counts.most_common(5),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify Trackman PDF fixture extraction")
    parser.add_argument("--pdf", default=FIXTURE_PDF, help="Path to Trackman PDF export")
    parser.add_argument("--page", type=int, help="Limit inspection to a specific page number")
    args = parser.parse_args()

    pdf_path = args.pdf
    if not os.path.exists(pdf_path):
        raise SystemExit(f"PDF not found: {pdf_path}")

    page_numbers = [args.page] if args.page else None
    sha256 = _sha256(pdf_path)

    content = extract_pdf(pdf_path)
    meta = parse_meta(content.text)

    extraction, _ = extract_table_from_pdf(pdf_path, debug=True, page_numbers=page_numbers)
    if not extraction:
        raise SystemExit("No table detected in PDF.")

    rows: List[Dict[str, Any]] = []
    debug_rows_by_page: Dict[int, List[Dict[str, Any]]] = {}

    for page in extraction.pages:
        rows_cells = [r.cells for r in page.rows]
        parsed, debug_rows = parse_rows_from_cells(
            page.headers,
            rows_cells,
            page.table_type,
            return_debug=True,
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
        rows.extend(parsed)

    summary = build_session_summary(rows)
    summary_info = _summarize(rows)
    summary_info["total_pitches"] = summary.get("total_pitches")

    print("Meta")
    print(f"  Player: {meta.player_name or '(unknown)'}")
    print(f"  Team:   {meta.team or '(unknown)'}")
    print(f"  Hand:   {meta.handedness or '(unknown)'}")
    print(f"  Date:   {meta.session_date or meta.date_to or meta.date_from or '(unknown)'}")
    if meta.date_from or meta.date_to:
        print(f"  Range:  {meta.date_from or '(unknown)'} -> {meta.date_to or '(unknown)'}")
    print()

    for page in extraction.pages:
        print(f"Page {page.page_number}")
        print(f"  Headers: {', '.join(page.headers)}")
        bounds = [f"{b.name}:[{b.x0:.1f},{b.x1:.1f}]" for b in page.column_bounds]
        print(f"  Bounds:  {' | '.join(bounds)}")
        print()

    print("First 10 extracted rows")
    shown = 0
    for page_num in sorted(debug_rows_by_page.keys()):
        for row in debug_rows_by_page[page_num]:
            print(f"  raw_cells: {row.get('raw_cells')}")
            print(f"  parsed:    {row.get('parsed')}")
            warnings = row.get("warnings") or row.get("parsed", {}).get("parse_warnings") or []
            if warnings:
                print(f"  warnings:  {warnings}")
            print()
            shown += 1
            if shown >= 10:
                break
        if shown >= 10:
            break

    print("Summary")
    print(f"  pitch_type_rows: {summary_info['pitch_count']}")
    print(f"  total_pitches: {summary_info['total_pitches']}")
    print(f"  valid_count: {summary_info['valid_count']}")
    print(f"  invalid_count: {summary_info['invalid_count']}")
    print(f"  pitch_mix: {summary_info['pitch_types']}")
    print(f"  velo_range: {summary_info['velo_range']}")
    print(f"  spin_range: {summary_info['spin_range']}")
    if summary_info["invalid_warnings"]:
        print(f"  invalid_warnings: {summary_info['invalid_warnings']}")

    debug_dir = _dump_debug(pdf_path, sha256, extraction, debug_rows_by_page, page_numbers)
    _write_json(os.path.join(debug_dir, "meta.json"), meta.__dict__)
    _write_json(os.path.join(debug_dir, "summary.json"), summary)
    _write_json(os.path.join(debug_dir, "summary_info.json"), summary_info)
    print(f"\nDebug bundle: {debug_dir}")


if __name__ == "__main__":
    main()
