"""Debug utility for inspecting Trackman PDF tables."""

import argparse
import os
import sys
from typing import List, Optional

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman_pdf.rows import parse_rows_from_cells
from trackman_pdf.table import extract_table_from_pdf


def _format_bounds(bounds) -> str:
    parts = []
    for b in bounds:
        parts.append(f"{b.name}:[{b.x0:.1f},{b.x1:.1f}]")
    return " | ".join(parts)


def _print_rows(debug_rows: List[dict], limit: int = 10) -> None:
    shown = 0
    for row in debug_rows:
        if shown >= limit:
            break
        parsed = row.get("parsed") or {}
        warnings = parsed.get("parse_warnings") or row.get("warnings") or []
        print(f"  raw_cells: {row.get('raw_cells')}")
        print(f"  parsed:    {parsed}")
        if warnings:
            print(f"  warnings:  {warnings}")
        print()
        shown += 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect Trackman PDF table extraction")
    parser.add_argument("--pdf", required=True, help="Path to Trackman PDF export")
    parser.add_argument("--page", type=int, help="Limit inspection to a specific page number")
    args = parser.parse_args()

    if not os.path.exists(args.pdf):
        raise SystemExit(f"PDF not found: {args.pdf}")

    page_numbers: Optional[List[int]] = [args.page] if args.page else None
    extraction, _ = extract_table_from_pdf(args.pdf, debug=True, page_numbers=page_numbers)
    if not extraction:
        raise SystemExit("No table found. Check that the PDF includes a 'Stats per Pitch' table.")

    for page in extraction.pages:
        print(f"\nPage {page.page_number}")
        print(f"Headers: {', '.join(page.headers)}")
        print(f"Bounds:  {_format_bounds(page.column_bounds)}")

        rows_cells = [r.cells for r in page.rows]
        parsed_rows, debug_rows = parse_rows_from_cells(
            page.headers,
            rows_cells,
            page.table_type,
            return_debug=True,
        )

        print(f"Rows detected: {len(rows_cells)} | Parsed: {len(parsed_rows)}")
        print("First parsed rows:")
        _print_rows(debug_rows, limit=10)

        out_of_range = []
        for row in parsed_rows:
            for warning in row.get("parse_warnings", []):
                if warning.startswith("OUT_OF_RANGE") or warning == "INVALID_ROW":
                    out_of_range.append(row)
                    break
        if out_of_range:
            print(f"Out-of-range rows: {len(out_of_range)}")


if __name__ == "__main__":
    main()
