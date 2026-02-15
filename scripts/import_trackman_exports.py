"""Convenience wrapper around import_trackman_pdf.py for the default export folder.

Usage:
    python3 scripts/import_trackman_exports.py              # import latest PDF
    python3 scripts/import_trackman_exports.py --all        # import all PDFs
    python3 scripts/import_trackman_exports.py --debug-dump # latest + debug
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.import_trackman_pdf import import_pdf, resolve_pdf_dir, latest_pdf, list_pdfs


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Import Trackman PDFs from the default export folder"
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--latest", action="store_true", default=True, help="Import most recent PDF (default)")
    mode.add_argument("--all", action="store_true", dest="import_all", help="Import all PDFs")
    parser.add_argument("--debug-dump", action="store_true", help="Write debug artifacts")
    args = parser.parse_args()

    try:
        pdf_dir = resolve_pdf_dir()
        print(f"PDF folder: {pdf_dir}")

        if args.import_all:
            paths = list_pdfs(pdf_dir)
            if not paths:
                raise FileNotFoundError(f"No PDF files found in {pdf_dir}")
            print(f"Found {len(paths)} PDF(s)")
        else:
            paths = [latest_pdf(pdf_dir)]

        for path in paths:
            print(f"\nImporting: {path}")
            import_pdf(path, debug_dump=args.debug_dump)

    except (FileNotFoundError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
