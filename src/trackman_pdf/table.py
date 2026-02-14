"""Locate and extract Trackman pitch tables from PDF text or layout.

Primary path: pdfplumber char-based column slicing for accurate table parsing.
Fallback: text-based line parsing for environments without pdfplumber.
"""

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import re

# Known column headers in Trackman PDF exports
KNOWN_HEADERS = [
    "Pitch Type",
    "Pitch #",
    "Count",
    "Pitches",
    "Pitch Count",
    "MPH",
    "Max MPH",
    "Max Velo",
    "RPM",
    "Max RPM",
    "IVB",
    "HB",
    "Extension",
    "Rel Height",
    "Rel Side",
    "2D Spin Axis",
    "3D Spin Axis",
    "Gyro",
]


@dataclass
class RawTable:
    """Raw table extracted from PDF text (fallback)."""

    header_line: str
    headers: List[str]
    data_lines: List[str]
    table_type: str  # "per_pitch" or "per_type"


@dataclass
class HeaderSpan:
    name: str
    x0: float
    x1: float


@dataclass
class ColumnBound:
    name: str
    x0: float
    x1: float


@dataclass
class ExtractedRow:
    cells: List[str]
    page_number: int
    top: float
    bottom: float
    raw_text: str


@dataclass
class TablePage:
    page_number: int
    headers: List[str]
    table_type: str
    column_bounds: List[ColumnBound]
    header_top: float
    header_bottom: float
    header_line: str
    rows: List[ExtractedRow]


@dataclass
class TableExtraction:
    pages: List[TablePage]


HEADER_PATTERNS: List[Tuple[str, List[List[str]]]] = [
    ("Pitch #", [["Pitch", "#"], ["Pitch#"]]),
    ("Pitch Type", [["Pitch", "Type"]]),
    ("Count", [["Count"], ["Pitches"], ["Pitch", "Count"], ["#"]]),
    ("MPH", [["MPH"]]),
    ("Max MPH", [["Max", "MPH"], ["Max", "Velo"], ["Velo", "Max"]]),
    ("RPM", [["RPM"]]),
    ("Max RPM", [["Max", "RPM"]]),
    ("IVB", [["IVB"]]),
    ("HB", [["HB"]]),
    ("Extension", [["Extension"]]),
    ("Rel Height", [["Rel", "Height"], ["Rel", "Height", "ft"]]),
    ("Rel Side", [["Rel", "Side"], ["Rel", "Side", "ft"]]),
    ("2D Spin Axis", [["2D", "Spin", "Axis"]]),
    ("3D Spin Axis", [["3D", "Spin", "Axis"]]),
    ("Gyro", [["Gyro"]]),
]


def _clean_line(line: str) -> str:
    """Remove stray Unicode characters and normalize whitespace."""
    line = re.sub(r"[\ue000-\uf8ff]", "", line)
    line = re.sub(r"\s+", " ", line).strip()
    return line


def _normalize_token(token: str) -> str:
    token = token.strip()
    token = token.replace("oMPH", "MPH")
    token = token.replace("(", "").replace(")", "")
    return token


def _group_by_top(items: Iterable[Dict[str, Any]], key: str = "top", tolerance: float = 2.0) -> List[List[Dict[str, Any]]]:
    """Group pdfplumber words/chars by similar y-position."""
    items_sorted = sorted(items, key=lambda x: (x.get(key, 0), x.get("x0", 0)))
    groups: List[List[Dict[str, Any]]] = []
    current: List[Dict[str, Any]] = []
    current_top: Optional[float] = None

    for item in items_sorted:
        top = float(item.get(key, 0))
        if current_top is None or abs(top - current_top) <= tolerance:
            current.append(item)
            if current_top is None:
                current_top = top
            else:
                current_top = (current_top * (len(current) - 1) + top) / len(current)
        else:
            groups.append(current)
            current = [item]
            current_top = top

    if current:
        groups.append(current)

    return groups


def _match_header_spans(words: List[Dict[str, Any]]) -> List[HeaderSpan]:
    """Match known header patterns to a list of words (sorted by x0)."""
    words_sorted = sorted(words, key=lambda w: w.get("x0", 0))
    tokens = [_normalize_token(w.get("text", "")) for w in words_sorted]

    # Sort patterns by longest variant first to prefer multi-word matches
    pattern_variants: List[Tuple[str, List[str]]] = []
    for name, variants in HEADER_PATTERNS:
        for variant in variants:
            pattern_variants.append((name, variant))
    pattern_variants.sort(key=lambda x: len(x[1]), reverse=True)

    spans: List[HeaderSpan] = []
    i = 0
    while i < len(tokens):
        matched = False
        for name, variant in pattern_variants:
            if tokens[i:i + len(variant)] == variant:
                x0 = float(words_sorted[i].get("x0", 0))
                x1 = float(words_sorted[i + len(variant) - 1].get("x1", 0))
                spans.append(HeaderSpan(name=name, x0=x0, x1=x1))
                i += len(variant)
                matched = True
                break
        if not matched:
            i += 1

    return spans


def _find_header_line(page) -> Optional[Tuple[List[HeaderSpan], List[Dict[str, Any]], str]]:
    """Find a header line on a page and return spans + words + line text."""
    try:
        words = page.extract_words()
    except Exception:
        return None

    if not words:
        return None

    for line in _group_by_top(words, key="top", tolerance=2.0):
        line_sorted = sorted(line, key=lambda w: w.get("x0", 0))
        tokens = [_normalize_token(w.get("text", "")) for w in line_sorted]
        token_set = set(tokens)

        has_mph = "MPH" in token_set
        has_pitch_type = "Pitch" in token_set and "Type" in token_set
        has_pitch_num = "#" in token_set or "Pitch#" in token_set
        has_pitch = has_pitch_type or has_pitch_num
        has_metrics = any(t in token_set for t in ("RPM", "IVB", "HB", "Extension"))

        if not (has_mph and has_pitch and has_metrics):
            continue

        spans = _match_header_spans(line_sorted)
        if len(spans) < 4:
            continue

        line_text = " ".join(tokens)
        return spans, line_sorted, line_text

    return None


def _derive_column_bounds(spans: List[HeaderSpan], page_width: float) -> List[ColumnBound]:
    spans_sorted = sorted(spans, key=lambda s: s.x0)
    bounds: List[ColumnBound] = []

    for i, span in enumerate(spans_sorted):
        if i == 0:
            left = max(0.0, span.x0 - 2)
        else:
            prev = spans_sorted[i - 1]
            left = (prev.x1 + span.x0) / 2

        if i == len(spans_sorted) - 1:
            right = min(page_width, span.x1 + 2)
        else:
            nxt = spans_sorted[i + 1]
            right = (span.x1 + nxt.x0) / 2

        bounds.append(ColumnBound(name=span.name, x0=left, x1=right))

    return bounds


def _join_chars(chars: List[Dict[str, Any]], gap_threshold: float = 1.5) -> str:
    if not chars:
        return ""
    chars_sorted = sorted(chars, key=lambda c: c.get("x0", 0))
    pieces: List[str] = []
    prev_x1: Optional[float] = None
    for ch in chars_sorted:
        text = ch.get("text", "")
        if text == "":
            continue
        x0 = float(ch.get("x0", 0))
        x1 = float(ch.get("x1", 0))
        if prev_x1 is not None and x0 - prev_x1 > gap_threshold:
            pieces.append(" ")
        pieces.append(text)
        prev_x1 = x1
    return _clean_line("".join(pieces))


def _build_cells_from_chars(line_chars: List[Dict[str, Any]], bounds: List[ColumnBound]) -> List[str]:
    cells: List[str] = []
    for bound in bounds:
        col_chars = []
        for ch in line_chars:
            cx = (float(ch.get("x0", 0)) + float(ch.get("x1", 0))) / 2
            if bound.x0 <= cx <= bound.x1:
                col_chars.append(ch)
        cells.append(_join_chars(col_chars))
    return cells


def _is_data_cells(cells: List[str], table_type: str) -> bool:
    if not cells:
        return False

    joined = " ".join(cells).strip()
    if not joined:
        return False

    if not any(ch.isdigit() for ch in joined):
        return False

    joined_lower = joined.lower()
    if (
        joined_lower.startswith("http")
        or "power bi" in joined_lower
        or "reset" in joined_lower
        or "teamportal" in joined_lower
        or "trackman" in joined_lower
        or ".com" in joined_lower
    ):
        return False

    if "MPH" in joined and "RPM" in joined and "Pitch" in joined:
        return False

    # Require at least two numeric cells beyond the first column to avoid chart labels
    numeric_cells = 0
    for cell in cells[1:]:
        if re.search(r"-?\d+(?:\.\d+)?", cell or ""):
            numeric_cells += 1
    if numeric_cells < 2:
        return False

    first = (cells[0] or "").strip()
    if table_type == "per_pitch":
        if not first:
            return False
        if not re.match(r"^-?\d+$", first):
            return False
    else:
        # per_type: first column should not be numeric
        if not first:
            return False
        if not re.search(r"[A-Za-z]", first):
            return False
        if re.match(r"^-?\d+(\.\d+)?$", first):
            return False

    return True


def _extract_rows_from_page(page, header_bottom: float, bounds: List[ColumnBound], table_type: str) -> List[ExtractedRow]:
    chars = [c for c in page.chars if float(c.get("top", 0)) >= header_bottom + 1]
    rows: List[ExtractedRow] = []

    for line_chars in _group_by_top(chars, key="top", tolerance=2.0):
        cells = _build_cells_from_chars(line_chars, bounds)
        if not _is_data_cells(cells, table_type):
            continue
        top = min(float(c.get("top", 0)) for c in line_chars)
        bottom = max(float(c.get("bottom", 0)) for c in line_chars)
        raw_text = " ".join([c for c in cells if c])
        rows.append(
            ExtractedRow(
                cells=cells,
                page_number=getattr(page, "page_number", 0),
                top=top,
                bottom=bottom,
                raw_text=raw_text,
            )
        )
    return rows


def extract_table_from_pdf(
    pdf_path: str,
    debug: bool = False,
    page_numbers: Optional[List[int]] = None,
) -> Tuple[Optional[TableExtraction], Optional[List[Dict[str, Any]]]]:
    """Extract pitch table using pdfplumber character positions.

    Returns (TableExtraction, debug_pages) or (None, debug_pages).
    """
    try:
        import pdfplumber
    except Exception:
        return None, None

    debug_pages: Optional[List[Dict[str, Any]]] = [] if debug else None
    pages: List[TablePage] = []

    with pdfplumber.open(pdf_path) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            if page_numbers and idx not in page_numbers:
                continue

            header_info = _find_header_line(page)
            if not header_info:
                if debug_pages is not None:
                    debug_pages.append({
                        "page": idx,
                        "found_header": False,
                    })
                continue

            spans, header_words, header_line = header_info
            bounds = _derive_column_bounds(spans, page.width)
            headers = [b.name for b in bounds]
            table_type = "per_pitch" if "Pitch #" in headers else "per_type"
            header_top = min(float(w.get("top", 0)) for w in header_words)
            header_bottom = max(float(w.get("bottom", 0)) for w in header_words)

            rows = _extract_rows_from_page(page, header_bottom, bounds, table_type)
            pages.append(
                TablePage(
                    page_number=idx,
                    headers=headers,
                    table_type=table_type,
                    column_bounds=bounds,
                    header_top=header_top,
                    header_bottom=header_bottom,
                    header_line=header_line,
                    rows=rows,
                )
            )

            if debug_pages is not None:
                debug_pages.append({
                    "page": idx,
                    "found_header": True,
                    "header_tokens": [w.get("text", "") for w in sorted(header_words, key=lambda w: w.get("x0", 0))],
                    "header_line": header_line,
                    "column_bounds": [
                        {"name": b.name, "x0": b.x0, "x1": b.x1} for b in bounds
                    ],
                    "row_count": len(rows),
                })

    if not pages:
        return None, debug_pages

    return TableExtraction(pages=pages), debug_pages


# ---------------------------------------------------------------------------
# Text-based fallback (existing behavior)
# ---------------------------------------------------------------------------

def _detect_header_line(text: str) -> Optional[Tuple[int, str]]:
    """Find the line that contains the pitch table header."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        cleaned = _clean_line(line)
        if "MPH" in cleaned and any(h in cleaned for h in ["RPM", "IVB", "HB"]):
            return i, cleaned
    return None


def _parse_header(header_line: str) -> Tuple[List[str], str]:
    """Parse the header line into column names and detect table type."""
    cleaned = re.sub(r"\bo(?=MPH)", "", header_line)

    if "Pitch #" in cleaned:
        table_type = "per_pitch"
    else:
        table_type = "per_type"

    headers: List[str] = []
    positions: List[Tuple[int, str]] = []

    for h in KNOWN_HEADERS:
        idx = cleaned.find(h)
        if idx >= 0:
            positions.append((idx, h))

    positions.sort(key=lambda x: x[0])
    headers = [h for _, h in positions]

    if not headers:
        parts = cleaned.split()
        headers = _reconstruct_headers(parts)

    return headers, table_type


def _reconstruct_headers(parts: List[str]) -> List[str]:
    """Reconstruct header names from split parts."""
    headers: List[str] = []
    i = 0
    while i < len(parts):
        part = parts[i]
        if part == "Pitch" and i + 1 < len(parts) and parts[i + 1] in ("Type", "#"):
            headers.append(f"Pitch {parts[i + 1]}")
            i += 2
        elif part == "Rel" and i + 1 < len(parts) and parts[i + 1] in ("Height", "Side"):
            suffix = parts[i + 1]
            if i + 2 < len(parts) and parts[i + 2] == "(ft)":
                headers.append(f"Rel {suffix} (ft)")
                i += 3
            else:
                headers.append(f"Rel {suffix}")
                i += 2
        elif part == "2D" and i + 2 < len(parts):
            headers.append("2D Spin Axis")
            i += 3
        elif part == "3D" and i + 2 < len(parts):
            headers.append("3D Spin Axis")
            i += 3
        elif part in ("Spin", "Axis"):
            i += 1
        else:
            headers.append(part)
            i += 1
    return headers


def _is_data_line(line: str, table_type: str) -> bool:
    """Check if a line looks like a pitch data row."""
    cleaned = _clean_line(line)
    if not cleaned:
        return False

    if not re.search(r"\d", cleaned):
        return False

    if cleaned.startswith("http") or "Power BI" in cleaned or "Reset" in cleaned:
        return False

    if table_type == "per_type":
        first_token = cleaned.split()[0]
        known_types = {
            "Fastball", "Sinker", "Slider", "Cutter", "Curveball", "Changeup",
            "Splitter", "Sweeper", "Knuckle", "Other", "Screwball",
            "Four-Seam", "Two-Seam",
        }
        if first_token not in known_types:
            return False

    if table_type == "per_pitch":
        first_token = cleaned.split()[0]
        try:
            int(first_token)
        except ValueError:
            return False

    return True


def find_table(text: str) -> Optional[RawTable]:
    """Locate the pitch table in the PDF text."""
    stats_idx = text.find("Stats per Pitch")
    if stats_idx < 0:
        stats_idx = text.find("Stats Per Pitch")
    if stats_idx < 0:
        stats_idx = text.find("Per Pitch")
    if stats_idx < 0:
        search_text = text
    else:
        search_text = text[stats_idx:]

    result = _detect_header_line(search_text)
    if result is None:
        return None

    header_idx, header_line = result
    headers, table_type = _parse_header(header_line)

    if not headers:
        return None

    lines = search_text.split("\n")
    data_lines: List[str] = []

    for line in lines[header_idx + 1:]:
        cleaned = _clean_line(line)
        if not cleaned:
            continue
        if _is_data_line(cleaned, table_type):
            data_lines.append(cleaned)

    return RawTable(
        header_line=header_line,
        headers=headers,
        data_lines=data_lines,
        table_type=table_type,
    )
