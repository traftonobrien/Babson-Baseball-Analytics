"""Parse pitch data rows from extracted table lines.

Maps raw column names to the stable schema and cleans numeric values.
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# Maps PDF column names to stable schema keys
COLUMN_MAP = {
    "Pitch Type": "pitch_type",
    "Pitch #": "pitch_number",
    "MPH": "velocity_mph",
    "RPM": "spin_rpm",
    "IVB": "ivb_in",
    "HB": "hb_in",
    "Extension": "extension_ft",
    "Rel Height": "rel_height_ft",
    "Rel Height (ft)": "rel_height_ft",
    "Rel Side": "rel_side_ft",
    "Rel Side (ft)": "rel_side_ft",
    "2D Spin Axis": "spin_axis_2d",
    "3D Spin Axis": "spin_axis_3d",
    "Gyro": "gyro",
}


def _clean_number(raw: str) -> Optional[float]:
    """Parse a numeric string, handling commas and negatives."""
    raw = raw.strip()
    if not raw or raw == "-" or raw.lower() in ("", "n/a", "null", "none"):
        return None
    # Remove commas
    raw = raw.replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def _split_data_line(line: str, header_count: int, table_type: str) -> List[str]:
    """Split a data line into fields, handling the pitch type as a multi-word first field.

    For per_type tables, the first field is a pitch type name (e.g. "Fastball", "Four-Seam").
    For per_pitch tables, the first field is a pitch number, and the second may be a pitch type.
    """
    parts = line.split()

    if table_type == "per_type":
        # First token(s) are the pitch type, rest are numbers
        # Find where numbers start
        type_parts = []
        num_start = 0
        for i, part in enumerate(parts):
            # Check if this part starts a numeric value
            cleaned = part.replace(",", "").lstrip("-")
            if cleaned and cleaned.replace(".", "", 1).isdigit():
                num_start = i
                break
            type_parts.append(part)
        else:
            # All parts are non-numeric (shouldn't happen)
            return parts

        pitch_type = " ".join(type_parts)
        fields = [pitch_type] + parts[num_start:]
        return fields

    elif table_type == "per_pitch":
        # First token is pitch number, second might be pitch type, rest are numbers
        if len(parts) < 2:
            return parts

        # Pitch number
        pitch_num = parts[0]

        # Find where the pitch type ends and numbers begin
        type_parts = []
        num_start = 1
        for i in range(1, len(parts)):
            cleaned = parts[i].replace(",", "").lstrip("-")
            if cleaned and cleaned.replace(".", "", 1).isdigit():
                num_start = i
                break
            type_parts.append(parts[i])

        if type_parts:
            pitch_type = " ".join(type_parts)
            fields = [pitch_num, pitch_type] + parts[num_start:]
        else:
            fields = parts

        return fields

    return parts


def parse_rows(
    headers: List[str],
    data_lines: List[str],
    table_type: str,
) -> List[Dict[str, Any]]:
    """Parse data lines into a list of pitch dictionaries.

    Args:
        headers: Column names from the table header.
        data_lines: Raw data lines to parse.
        table_type: "per_pitch" or "per_type".

    Returns:
        List of dicts with stable schema keys.
    """
    rows: List[Dict[str, Any]] = []

    for line in data_lines:
        fields = _split_data_line(line, len(headers), table_type)

        if not fields:
            continue

        row: Dict[str, Any] = {}
        for i, header in enumerate(headers):
            if i >= len(fields):
                break

            schema_key = COLUMN_MAP.get(header)
            if not schema_key:
                # Try partial match
                for known, key in COLUMN_MAP.items():
                    if known.lower() in header.lower():
                        schema_key = key
                        break

            if not schema_key:
                schema_key = _fallback_key(header)

            value = fields[i]

            # Type-specific handling
            if schema_key in ("pitch_type",):
                row[schema_key] = value
            elif schema_key == "pitch_number":
                num = _clean_number(value)
                row[schema_key] = int(num) if num is not None else None
            else:
                row[schema_key] = _clean_number(value)

        # Only add rows that have at least some data
        if any(v is not None for k, v in row.items() if k != "pitch_type"):
            rows.append(row)

    return rows


def _fallback_key(header: str) -> str:
    """Generate a snake_case key from an unrecognized header."""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", header)
    return re.sub(r"\s+", "_", cleaned.strip()).lower()
