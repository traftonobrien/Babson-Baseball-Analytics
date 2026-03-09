#!/usr/bin/env python3
"""
extract_charting.py — Extract structured data from handwritten Babson pitching chart PDFs.

Usage:
    # Full-page mode (fast, ~75-80% accuracy on results):
    python3 scripts/extract_charting.py <pdf> [--output <out.json>]

    # Row-level mode (slower, better zone + pitch sequence accuracy):
    python3 scripts/extract_charting.py <pdf> --row-mode [--rows 5] [--output <out.json>]

    # Single page only:
    python3 scripts/extract_charting.py <pdf> --page 1 --row-mode --output /tmp/test.json

Requires:
    pip install anthropic pymupdf pillow

Set ANTHROPIC_API_KEY env var or pass --api-key.
"""

import argparse
import base64
import io
import json
import os
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF not installed. Run: pip install pymupdf")

try:
    import anthropic
except ImportError:
    sys.exit("anthropic not installed. Run: pip install anthropic")

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow not installed. Run: pip install pillow")


# ---------------------------------------------------------------------------
# Grid crop constants (fraction of page dimensions, empirically tuned)
# ---------------------------------------------------------------------------

# Fraction of page width: where the AB grid starts (skip left labels)
GRID_LEFT_FRAC = 0.08
# Fraction of page width: where the AB grid ends (skip right summary panel)
GRID_RIGHT_FRAC = 0.87
# Fraction of page height: where the FIRST PITCHER ROW starts (skip header row)
GRID_TOP_FRAC = 0.16
# Fraction of page height: where the last pitcher row ends (skip batter-name footer)
GRID_BOTTOM_FRAC = 0.88
# Extra fractional overlap added above/below each row crop to avoid clipping names
ROW_OVERLAP_FRAC = 0.015


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

FULL_PAGE_PROMPT = """\
You are analyzing a handwritten "Babson Baseball Pitching Chart" scoresheet.

CRITICAL layout rules — read carefully before extracting:

1. BOXES: Each box = one plate appearance (PA). The sheet reads left-to-right, row-by-row.

2. BATTER NAME: Written ABOVE each box. That is who is batting in that PA.
   The batter names along the very bottom edge are only the first few batters to come up —
   they do NOT label columns. The name above each individual box is the real batter.

3. RESULT: Written INSIDE the box (K, BB, 1B, 2B, 3B, HR, F8, 6-3, HBP, etc.)

4. PITCHER CHANGES: When a pitcher's name appears UNDERLINED above a box, that is when
   that pitcher enters. They pitch every consecutive batter until the next underlined
   pitcher name appears. Group all PAs between underlined names under the same pitcher.

5. PITCH SEQUENCE: Small abbreviations inside or beside the box (FB, CB, SL, CH, etc.)

6. ZONE DOT: A dot marked on the small 3x3 grid inside the box shows pitch location.

7. RIGHT PANEL: Pitch type totals (FB, CB, SL, CH, OTH) and Strikes/Balls per pitcher.

8. LEFT EDGE LABELS: DATE, CHARTER, WEATHER, RECORD, STANDING, TOMORROW'S STARTER —
   fill these into the game object.

Extract ALL data and return a single JSON object.
Use null for anything illegible. Add "_confidence":"low" for uncertain reads.
Return ONLY valid JSON — no markdown, no explanation.

{
  "game": {
    "home_team": "string or null",
    "away_team": "string or null",
    "date": "string or null",
    "charter": "string or null",
    "weather": "string or null",
    "standing": "string or null",
    "record": "string or null"
  },
  "catchers": ["string"],
  "pitchers": [
    {
      "name": "string or null",
      "at_bats": [
        {
          "inning": "integer or null",
          "batter": "string or null",
          "pitch_sequence": ["FB","CB","SL","CH","CT","SP"],
          "result_count": "string e.g. '3-2' or null",
          "result": "string e.g. 'K', 'BB', '8F', '6-3', '1B' or null",
          "zone_location": "one of: high-in high-mid high-out mid-in mid-mid mid-out low-in low-mid low-out ball — or null",
          "notes": "string or null"
        }
      ],
      "pitch_totals": {
        "fastball": "integer or null",
        "curveball": "integer or null",
        "slider": "integer or null",
        "changeup": "integer or null",
        "other": "integer or null",
        "total_pitches": "integer or null",
        "strikes": "integer or null",
        "balls": "integer or null"
      }
    }
  ],
  "game_totals": {
    "pitches": "integer or null",
    "strikes": "integer or null",
    "balls": "integer or null"
  }
}

Pitch type codes: FB/F=fastball, CB/C=curveball, SL/S=slider, CH=changeup, CT/CUT=cutter, SP=splitter
Result codes: K=strikeout swinging, Kl=strikeout looking, BB=walk, HBP=hit by pitch,
  1B/2B/3B/HR=hits, "6-3"=groundout, "8F"=flyout, SAC=sacrifice, E#=error
Zone (catcher's view): high-in=up and inside, low-out=down and away, etc.
"""

ROW_PROMPT = """\
You are analyzing a HORIZONTAL BAND from a handwritten "Babson Baseball Pitching Chart".

This band contains plate appearance (PA) boxes arranged LEFT TO RIGHT. Your only job is to read each box in order and extract the detail from inside each box. Do NOT try to identify pitchers — just read the boxes.

LAYOUT OF EACH PA BOX:
- RESULT: Written prominently INSIDE the box (K, BB, 1B, 2B, 3B, HR, "6-3", "8F", HBP, Kl, etc.)
- PITCH COUNT: Small fraction written near the box top-left or beside it (e.g. "3-2", "1-2")
- PITCH SEQUENCE: Small letter abbreviations written INSIDE the box
  F=fastball, C=curveball, S=slider, CH=changeup, CT/CUT=cutter
  These are usually 2-6 single letters or pairs, e.g. "F F C F" or "FB CB FB"
- ZONE DOT: A small dot placed on the 3×3 grid drawn INSIDE the box. This shows where the last pitch was located.
  The 3×3 grid = the strike zone as seen from the CATCHER:
    Top row    (left→right): high-in  | high-mid  | high-out
    Middle row (left→right): mid-in   | mid-mid   | mid-out
    Bottom row (left→right): low-in   | low-mid   | low-out
    Dot clearly outside all 9 squares = "ball"
- BATTER NAME: Written ABOVE the box. May be cut off at top of image.

IMPORTANT — what to SKIP:
- Ignore the thin rows of tiny numbers above/below each box (these are running pitch count tallies, not PA data).
- Ignore any underlined names (pitcher change markers) — do not include them as PA boxes.
- Count only the MAIN boxes that have a large interior space with a result written inside.

TASK: Read each PA box left to right. Return them in order.

Return ONLY a JSON array — no markdown fences, no explanation:

[
  {
    "seq": 1,
    "batter": "string or null",
    "result": "string or null",
    "result_count": "string or null",
    "pitch_sequence": ["F","C","S","CH","CT"],
    "zone_location": "high-in|high-mid|high-out|mid-in|mid-mid|mid-out|low-in|low-mid|low-out|ball|null",
    "_zone_confidence": "high|medium|low"
  }
]

Focus most on zone_location and pitch_sequence — these are the hardest to read from a full page.
For zone: look at WHICH cell of the 3×3 grid the dot sits in. Be precise about row (high/mid/low) and column (in/mid/out).
For pitch_sequence: read each small letter inside the box from left-to-right or top-to-bottom.
"""

SUMMARY_ROW_PROMPT = """\
You are analyzing the RIGHT PANEL of a handwritten "Babson Baseball Pitching Chart".
This panel contains pitch-type totals and strike/ball counts for each pitcher.

The panel has rows, one per pitcher. For each pitcher row, extract:
- pitcher name (may be abbreviated)
- FB (fastball count)
- CB (curveball count)
- SL (slider count)
- CH (changeup count)
- OTH (other pitch count)
- Total pitches
- Strikes
- Balls

Return ONLY valid JSON — no markdown, no explanation:

{
  "pitchers": [
    {
      "name": "string or null",
      "fastball": "integer or null",
      "curveball": "integer or null",
      "slider": "integer or null",
      "changeup": "integer or null",
      "other": "integer or null",
      "total_pitches": "integer or null",
      "strikes": "integer or null",
      "balls": "integer or null"
    }
  ],
  "game_totals": {
    "pitches": "integer or null",
    "strikes": "integer or null",
    "balls": "integer or null"
  }
}
"""


# ---------------------------------------------------------------------------
# Rendering helpers
# ---------------------------------------------------------------------------

def render_pdf_page_pil(pdf_path: Path, page_num: int, dpi: int = 400) -> Image.Image:
    """Render a single PDF page to a PIL Image at the given DPI."""
    doc = fitz.open(str(pdf_path))
    page = doc[page_num - 1]
    scale = dpi / 72.0
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    img_bytes = pix.tobytes("png")
    return Image.open(io.BytesIO(img_bytes))


def render_pdf_pages(pdf_path: Path, dpi: int = 250) -> list[bytes]:
    """Render each PDF page to PNG bytes (full-page mode)."""
    doc = fitz.open(str(pdf_path))
    pages = []
    scale = dpi / 72.0
    mat = fitz.Matrix(scale, scale)
    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        pages.append(pix.tobytes("png"))
    return pages


def pil_to_png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def crop_rows(img: Image.Image, num_rows: int, save_debug: bool = False) -> list[Image.Image]:
    """
    Crop the main AB grid from the page and split it into `num_rows` horizontal slices.
    Each slice gets a small vertical overlap to avoid clipping names at row boundaries.
    """
    W, H = img.size

    grid_left = int(W * GRID_LEFT_FRAC)
    grid_right = int(W * GRID_RIGHT_FRAC)
    grid_top = int(H * GRID_TOP_FRAC)
    grid_bottom = int(H * GRID_BOTTOM_FRAC)
    grid_h = grid_bottom - grid_top

    row_h = grid_h / num_rows
    overlap_px = int(H * ROW_OVERLAP_FRAC)

    crops = []
    for i in range(num_rows):
        y0 = int(grid_top + i * row_h) - overlap_px
        y1 = int(grid_top + (i + 1) * row_h) + overlap_px
        y0 = max(0, y0)
        y1 = min(H, y1)
        crop = img.crop((grid_left, y0, grid_right, y1))
        if save_debug:
            crop.save(f"/tmp/row_crop_{i+1}.png")
            print(f"  Saved debug: /tmp/row_crop_{i+1}.png ({crop.size[0]}x{crop.size[1]})")
        crops.append(crop)
    return crops


def crop_summary_panel(img: Image.Image, save_debug: bool = False) -> Image.Image:
    """Crop the right-side pitch totals / summary panel."""
    W, H = img.size
    left = int(W * GRID_RIGHT_FRAC)
    top = int(H * GRID_TOP_FRAC)
    bottom = int(H * GRID_BOTTOM_FRAC)
    crop = img.crop((left, top, W, bottom))
    if save_debug:
        crop.save("/tmp/summary_panel.png")
        print(f"  Saved debug: /tmp/summary_panel.png ({crop.size[0]}x{crop.size[1]})")
    return crop


# ---------------------------------------------------------------------------
# Claude API helpers
# ---------------------------------------------------------------------------

def call_claude(png_bytes: bytes, prompt: str, label: str, api_key: str,
                model: str = "claude-opus-4-6", max_tokens: int = 2048) -> dict:
    """Send an image + prompt to Claude and return parsed JSON."""
    client = anthropic.Anthropic(api_key=api_key)
    b64 = base64.standard_b64encode(png_bytes).decode("utf-8")
    size_kb = len(png_bytes) // 1024
    print(f"  [{label}] {size_kb} KB → {model}...", flush=True)

    message = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )

    raw = message.content[0].text.strip()

    # Strip markdown fences (```json ... ``` or ``` ... ```)
    if "```" in raw:
        # Find first ``` and last ```, extract content between
        start = raw.find("```")
        end = raw.rfind("```")
        if start != end:
            inner = raw[start + 3: end].strip()
            # Strip optional language tag on first line
            if inner and not inner[0] in ("{", "["):
                first_nl = inner.find("\n")
                if first_nl != -1:
                    inner = inner[first_nl + 1:].strip()
            raw = inner

    # Strip any prose preamble before the first JSON delimiter
    first_brace = raw.find("{")
    first_bracket = raw.find("[")
    starts = [i for i in (first_brace, first_bracket) if i >= 0]
    if starts:
        raw = raw[min(starts):]

    # Strip trailing prose after final JSON delimiter
    last_brace = raw.rfind("}")
    last_bracket = raw.rfind("]")
    ends = [i for i in (last_brace, last_bracket) if i >= 0]
    if ends:
        raw = raw[:max(ends) + 1]

    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"  WARNING: JSON parse failed for [{label}]: {e}", file=sys.stderr)
        print(f"  Raw snippet: {raw[:400]}", file=sys.stderr)
        return {"_raw": raw, "_parse_error": str(e), "_label": label}



# ---------------------------------------------------------------------------
# Full-page extraction (original mode)
# ---------------------------------------------------------------------------

def extract_page_full(png_bytes: bytes, page_num: int, api_key: str) -> dict:
    return call_claude(png_bytes, FULL_PAGE_PROMPT, f"page {page_num}", api_key, max_tokens=4096)


# ---------------------------------------------------------------------------
# Row-level extraction (two-pass: full-page for structure + rows for detail)
# ---------------------------------------------------------------------------

def extract_page_rows(img: Image.Image, page_num: int, num_rows: int,
                      api_key: str, save_debug: bool = False) -> dict:
    """
    Two-pass extraction:
      Pass 1 — full page → game structure (pitchers, batters, results, innings)
      Pass 2 — row crops → per-AB zone + pitch_sequence detail
    Merge: enrich Pass 1 AB entries with zone/sequence from Pass 2 by global AB order.
    """
    print(f"  Page {page_num}: pass 1 — full page structure (200 DPI)...", flush=True)
    # Use a lower-res version of the page for the structure pass to stay under the 5 MB API limit.
    # Full structural context doesn't need 400 DPI detail.
    small_img = img.resize((img.width // 2, img.height // 2), Image.LANCZOS)
    full_png = pil_to_png_bytes(small_img)
    print(f"    Full-page PNG: {len(full_png)//1024} KB", flush=True)
    structure = call_claude(full_png, FULL_PAGE_PROMPT, f"p{page_num}-full", api_key, max_tokens=4096)

    print(f"  Page {page_num}: pass 2 — {num_rows} row crops for zone/pitch detail...", flush=True)
    row_crops = crop_rows(img, num_rows, save_debug=save_debug)
    summary_crop = crop_summary_panel(img, save_debug=save_debug)

    # Collect flat AB list from row crops (just zone + pitch_sequence)
    flat_abs = []
    for i, crop in enumerate(row_crops):
        png = pil_to_png_bytes(crop)
        result = call_claude(png, ROW_PROMPT, f"p{page_num}-row{i+1}", api_key, max_tokens=1200)
        entries = result if isinstance(result, list) else []
        flat_abs.extend(entries)

    # Extract summary panel for pitch totals
    summary_png = pil_to_png_bytes(summary_crop)
    summary = call_claude(summary_png, SUMMARY_ROW_PROMPT, f"p{page_num}-summary", api_key, max_tokens=1000)

    # Merge: enrich structure ABs with zone/pitch_sequence from flat_abs by global order
    structure = enrich_structure_with_detail(structure, flat_abs, summary)
    return structure


def enrich_structure_with_detail(structure: dict, flat_abs: list[dict], summary: dict) -> dict:
    """
    Overlay zone_location and pitch_sequence from row-crop flat_abs
    onto the structured per-pitcher ABs from the full-page pass.
    Matching is done by global AB index (order of appearance).
    """
    if not isinstance(structure, dict):
        return structure

    # Build a flat list of all AB dicts from structure, in order
    all_abs = []
    for pitcher in structure.get("pitchers", []):
        for ab in pitcher.get("at_bats", []):
            all_abs.append(ab)

    # Match by position — row crops may have extras or gaps; use best-effort alignment
    for i, detail in enumerate(flat_abs):
        if i >= len(all_abs):
            break
        ab = all_abs[i]
        zone = detail.get("zone_location")
        seq = detail.get("pitch_sequence")
        conf = detail.get("_zone_confidence")
        # Only overwrite if the detail pass has something better
        if zone and (ab.get("zone_location") is None or conf in ("high", "medium")):
            ab["zone_location"] = zone
            ab["_zone_confidence"] = conf
        if seq and not ab.get("pitch_sequence"):
            ab["pitch_sequence"] = seq

    # Attach pitch_totals from summary
    summary_pitchers = summary.get("pitchers", []) if isinstance(summary, dict) else []
    for sp in summary_pitchers:
        sp_name = (sp.get("name") or "").lower().strip()
        for p in structure.get("pitchers", []):
            p_name = (p.get("name") or "").lower().strip()
            if p_name and (p_name in sp_name or sp_name in p_name):
                if not p.get("pitch_totals"):
                    p["pitch_totals"] = {k: v for k, v in sp.items() if k != "name"}
                break

    if "game_totals" not in structure and isinstance(summary, dict) and summary.get("game_totals"):
        structure["game_totals"] = summary["game_totals"]

    return structure


# ---------------------------------------------------------------------------
# Multi-page merge
# ---------------------------------------------------------------------------

def merge_pages(pages: list[dict]) -> dict:
    """Merge multi-page extractions into one game object."""
    if not pages:
        return {}
    if len(pages) == 1:
        return pages[0]

    merged = pages[0].copy()
    for page in pages[1:]:
        if isinstance(page.get("pitchers"), list):
            merged.setdefault("pitchers", [])
            merged["pitchers"].extend(page["pitchers"])
        if "game" in page:
            for k, v in page["game"].items():
                if merged.get("game", {}).get(k) is None and v is not None:
                    merged["game"][k] = v
        if "game_totals" in page and page["game_totals"] and not merged.get("game_totals"):
            merged["game_totals"] = page["game_totals"]
    return merged


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Extract charting data from a Babson pitching chart PDF using Claude."
    )
    parser.add_argument("pdf", help="Path to the PDF file")
    parser.add_argument("--output", "-o", default=None, help="Output JSON path (default: stdout)")
    parser.add_argument("--dpi", type=int, default=400, help="Render resolution in DPI (default 400)")
    parser.add_argument("--page", type=int, default=None, help="Only process this page number (1-based)")
    parser.add_argument("--api-key", default=None, help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")
    parser.add_argument(
        "--row-mode", action="store_true", default=True,
        help="Use row-level cropping for better zone/pitch-sequence accuracy (default: on)"
    )
    parser.add_argument(
        "--no-row-mode", dest="row_mode", action="store_false",
        help="Disable row-level mode; send full page to Claude instead"
    )
    parser.add_argument("--rows", type=int, default=15, help="Number of row crops per page (default 15; tune with --crop-only)")
    parser.add_argument("--debug-crops", action="store_true", help="Save row crop images to /tmp/ for inspection")
    parser.add_argument("--crop-only", action="store_true", help="Save crops and exit without calling the API (for geometry tuning)")
    args = parser.parse_args()

    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and not args.crop_only:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set. Pass --api-key or export ANTHROPIC_API_KEY=...")

    pdf_path = Path(args.pdf)
    if not pdf_path.exists():
        sys.exit(f"ERROR: File not found: {pdf_path}")

    # Determine pages to process
    doc = fitz.open(str(pdf_path))
    total_pages = doc.page_count
    doc.close()
    pages_to_process = [args.page] if args.page else list(range(1, total_pages + 1))

    print(f"PDF: {pdf_path}  ({total_pages} page(s))  mode={'row' if args.row_mode else 'full'}  dpi={args.dpi}", flush=True)

    # Crop-only mode: save crops and exit (for geometry tuning)
    if args.crop_only:
        for page_num in pages_to_process:
            print(f"\n=== Page {page_num} (crop-only) ===", flush=True)
            img = render_pdf_page_pil(pdf_path, page_num, dpi=args.dpi)
            print(f"  Rendered at {args.dpi} DPI → {img.size[0]}x{img.size[1]} px", flush=True)
            crop_rows(img, args.rows, save_debug=True)
            crop_summary_panel(img, save_debug=True)
        print("\nCrops saved to /tmp/. Inspect them and adjust GRID_*_FRAC constants if needed.")
        return

    results = []
    for page_num in pages_to_process:
        print(f"\n=== Page {page_num} ===", flush=True)
        if args.row_mode:
            img = render_pdf_page_pil(pdf_path, page_num, dpi=args.dpi)
            print(f"  Rendered at {args.dpi} DPI → {img.size[0]}x{img.size[1]} px", flush=True)
            result = extract_page_rows(img, page_num, args.rows, api_key, save_debug=args.debug_crops)
        else:
            pages_png = render_pdf_pages(pdf_path, dpi=args.dpi)
            result = extract_page_full(pages_png[page_num - 1], page_num, api_key)
        results.append(result)

    merged = merge_pages(results)
    output_json = json.dumps(merged, indent=2, ensure_ascii=False)

    if args.output:
        Path(args.output).write_text(output_json, encoding="utf-8")
        print(f"\nSaved to: {args.output}")
    else:
        print("\n--- EXTRACTED DATA ---")
        print(output_json)


if __name__ == "__main__":
    main()
