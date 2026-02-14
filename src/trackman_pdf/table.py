"""Locate and extract the pitch table from Trackman PDF text.

Finds the section after "Stats per Pitch", identifies the header row,
and returns the header + data lines for row parsing.
"""

import re
from dataclasses import dataclass
from typing import List, Optional, Tuple


# Known column headers in Trackman PDF exports
KNOWN_HEADERS = [
    "Pitch Type",
    "Pitch #",
    "MPH",
    "RPM",
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
    """Raw table extracted from PDF text."""
    header_line: str
    headers: List[str]
    data_lines: List[str]
    table_type: str  # "per_pitch" or "per_type"


def _clean_line(line: str) -> str:
    """Remove stray Unicode characters and normalize whitespace."""
    # Remove common stray chars from PDF rendering
    line = re.sub(r"[\ue000-\uf8ff]", "", line)  # Private Use Area chars
    line = re.sub(r"\s+", " ", line).strip()
    return line


def _detect_header_line(text: str) -> Optional[Tuple[int, str]]:
    """Find the line that contains the pitch table header."""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        cleaned = _clean_line(line)
        # Header must contain MPH and at least one of RPM, IVB, HB
        if "MPH" in cleaned and any(h in cleaned for h in ["RPM", "IVB", "HB"]):
            return i, cleaned
    return None


def _parse_header(header_line: str) -> Tuple[List[str], str]:
    """Parse the header line into column names and detect table type.

    Returns (headers, table_type) where table_type is "per_pitch" or "per_type".
    """
    # Remove the leading "o" that appears before MPH in some PDF renders
    cleaned = re.sub(r"\bo(?=MPH)", "", header_line)

    # Detect table type from first column
    if "Pitch #" in cleaned:
        table_type = "per_pitch"
    else:
        table_type = "per_type"

    # Build ordered header list by finding known headers in order of appearance
    headers: List[str] = []
    positions: List[Tuple[int, str]] = []

    for h in KNOWN_HEADERS:
        idx = cleaned.find(h)
        if idx >= 0:
            positions.append((idx, h))

    positions.sort(key=lambda x: x[0])
    headers = [h for _, h in positions]

    # If we didn't find standard headers, try splitting
    if not headers:
        parts = cleaned.split()
        # Try to reconstruct multi-word headers
        headers = _reconstruct_headers(parts)

    return headers, table_type


def _reconstruct_headers(parts: List[str]) -> List[str]:
    """Reconstruct header names from split parts."""
    headers: List[str] = []
    i = 0
    while i < len(parts):
        part = parts[i]
        # Multi-word headers
        if part == "Pitch" and i + 1 < len(parts) and parts[i + 1] in ("Type", "#"):
            headers.append(f"Pitch {parts[i + 1]}")
            i += 2
        elif part == "Rel" and i + 1 < len(parts) and parts[i + 1] in ("Height", "Side"):
            suffix = parts[i + 1]
            # May have (ft) after
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
            # Skip standalone fragments that are part of multi-word headers
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

    # Must contain at least one number
    if not re.search(r"\d", cleaned):
        return False

    # Should not be a URL or navigation text
    if cleaned.startswith("http") or "Power BI" in cleaned or "Reset" in cleaned:
        return False

    # For per_type: first token should be a pitch type name
    if table_type == "per_type":
        first_token = cleaned.split()[0]
        known_types = {
            "Fastball", "Sinker", "Slider", "Cutter", "Curveball", "Changeup",
            "Splitter", "Sweeper", "Knuckle", "Other", "Screwball",
            "Four-Seam", "Two-Seam",
        }
        if first_token not in known_types:
            return False

    # For per_pitch: first token should be a number (pitch #)
    if table_type == "per_pitch":
        first_token = cleaned.split()[0]
        try:
            int(first_token)
        except ValueError:
            return False

    return True


def find_table(text: str) -> Optional[RawTable]:
    """Locate the pitch table in the PDF text.

    Returns a RawTable with header and data lines ready for row parsing.
    """
    # Find the "Stats per Pitch" marker
    stats_idx = text.find("Stats per Pitch")
    if stats_idx < 0:
        # Try alternate markers
        stats_idx = text.find("Stats Per Pitch")
    if stats_idx < 0:
        stats_idx = text.find("Per Pitch")
    if stats_idx < 0:
        # No marker found, try to find header anywhere
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

    # Extract data lines: everything after the header until table ends
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
