"""Parse pitch data rows from extracted table lines or cells.

Maps raw column names to the stable schema for pitch-type summaries,
cleans numeric values, validates plausibility, and attaches warnings + raw
columns for traceability.
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# Per-type column mapping (primary pipeline)
PER_TYPE_HEADER_MAP = {
    "Pitch Type": "pitch_type",
    "Count": "count",
    "Pitches": "count",
    "Pitch Count": "count",
    "#": "count",
    "MPH": "avg_velocity_mph",
    "Max MPH": "max_velocity_mph",
    "Max Velo": "max_velocity_mph",
    "RPM": "avg_spin_rpm",
    "Max RPM": "max_spin_rpm",
    "IVB": "avg_ivb_in",
    "HB": "avg_hb_in",
    "Extension": "avg_extension_ft",
    "Rel Height": "avg_rel_height_ft",
    "Rel Height (ft)": "avg_rel_height_ft",
    "Rel Side": "avg_rel_side_ft",
    "Rel Side (ft)": "avg_rel_side_ft",
    "2D Spin Axis": "avg_spin_axis_2d",
    "3D Spin Axis": "avg_spin_axis_3d",
    "Gyro": "avg_gyro",
}

# Per-pitch mapping (kept for fallback)
PER_PITCH_HEADER_MAP = {
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

# Alias for tests/truthiness mapping
COLUMN_MAP = PER_TYPE_HEADER_MAP

PER_TYPE_NUMERIC_KEYS = {
    "count",
    "avg_velocity_mph",
    "max_velocity_mph",
    "avg_spin_rpm",
    "max_spin_rpm",
    "avg_ivb_in",
    "avg_hb_in",
    "avg_extension_ft",
    "avg_rel_height_ft",
    "avg_rel_side_ft",
    "avg_spin_axis_2d",
    "avg_spin_axis_3d",
    "avg_gyro",
}

PER_PITCH_NUMERIC_KEYS = {
    "velocity_mph",
    "spin_rpm",
    "ivb_in",
    "hb_in",
    "extension_ft",
    "rel_height_ft",
    "rel_side_ft",
    "spin_axis_2d",
    "spin_axis_3d",
    "gyro",
}

PER_TYPE_DECIMAL_KEYS = PER_TYPE_NUMERIC_KEYS - {"count"}
PER_PITCH_DECIMAL_KEYS = set(PER_PITCH_NUMERIC_KEYS)

PER_TYPE_RANGES = {
    "count": (1.0, 1000.0),
    "avg_velocity_mph": (20.0, 110.0),
    "max_velocity_mph": (20.0, 110.0),
    "avg_spin_rpm": (0.0, 5000.0),
    "max_spin_rpm": (0.0, 6000.0),
    "avg_ivb_in": (-40.0, 40.0),
    "avg_hb_in": (-40.0, 40.0),
    "avg_extension_ft": (0.0, 10.0),
}

PER_PITCH_RANGES = {
    "velocity_mph": (20.0, 110.0),
    "spin_rpm": (0.0, 5000.0),
    "ivb_in": (-40.0, 40.0),
    "hb_in": (-40.0, 40.0),
    "extension_ft": (0.0, 10.0),
    "rel_height_ft": (0.0, 10.0),
    "rel_side_ft": (-10.0, 10.0),
}

PER_TYPE_CRITICAL_KEYS = {"avg_velocity_mph", "avg_spin_rpm"}
PER_PITCH_CRITICAL_KEYS = {"velocity_mph", "spin_rpm", "ivb_in", "hb_in", "extension_ft"}


def _schema_key_for_header(header: str, table_type: str) -> Optional[str]:
    header = header.strip()
    lower = header.lower()

    if table_type == "per_pitch":
        if header in PER_PITCH_HEADER_MAP:
            return PER_PITCH_HEADER_MAP[header]
        for known, key in PER_PITCH_HEADER_MAP.items():
            if known.lower() in lower:
                return key
        return None

    # per_type
    if header in PER_TYPE_HEADER_MAP:
        return PER_TYPE_HEADER_MAP[header]
    if "pitch type" in lower:
        return "pitch_type"
    if lower in ("count", "pitches", "pitch count", "#"):
        return "count"
    if "mph" in lower:
        if "max" in lower:
            return "max_velocity_mph"
        return "avg_velocity_mph"
    if "rpm" in lower:
        if "max" in lower:
            return "max_spin_rpm"
        return "avg_spin_rpm"
    if lower.startswith("ivb"):
        return "avg_ivb_in"
    if lower.startswith("hb"):
        return "avg_hb_in"
    if "extension" in lower:
        return "avg_extension_ft"
    if "rel height" in lower:
        return "avg_rel_height_ft"
    if "rel side" in lower:
        return "avg_rel_side_ft"
    if "2d spin axis" in lower:
        return "avg_spin_axis_2d"
    if "3d spin axis" in lower:
        return "avg_spin_axis_3d"
    if "gyro" in lower:
        return "avg_gyro"
    return None


def _normalize_numeric(raw: str) -> str:
    raw = raw.replace(",", "")
    raw = raw.replace("\u2212", "-")
    raw = raw.replace("\u2013", "-")
    raw = raw.replace("\u2014", "-")
    raw = raw.replace("\u00a0", " ")
    return raw


def _extract_numbers(raw: str) -> List[str]:
    return re.findall(r"[-+]?\d+(?:\.\d+)?", raw)


def _parse_number(raw: str, expect_decimal: bool = False) -> Tuple[Optional[float], List[str], Optional[str]]:
    warnings: List[str] = []
    if raw is None:
        return None, warnings, None
    cleaned = raw.strip()
    if not cleaned or cleaned in ("-", "–", "—"):
        return None, warnings, None
    if cleaned.lower() in ("n/a", "na", "null", "none"):
        return None, warnings, None

    cleaned = _normalize_numeric(cleaned)
    numbers = _extract_numbers(cleaned)
    if not numbers:
        return None, warnings, None

    chosen = numbers[0]
    if len(numbers) > 1:
        warnings.append("MULTI_NUMBER")
        if expect_decimal:
            for n in numbers:
                if "." in n:
                    chosen = n
                    break

    try:
        return float(chosen), warnings, chosen
    except ValueError:
        return None, warnings, None


def _clean_number(raw: str) -> Optional[float]:
    value, _warnings, _chosen = _parse_number(raw, expect_decimal=False)
    return value


def _attempt_trim_repair(raw: Optional[str], min_val: float, max_val: float) -> Optional[float]:
    if raw is None:
        return None
    cleaned = _normalize_numeric(raw.strip())
    numbers = _extract_numbers(cleaned)
    if not numbers:
        return None
    candidate = numbers[0]
    sign = -1.0 if candidate.startswith("-") else 1.0
    candidate = candidate.lstrip("+-")

    if "." in candidate:
        int_part, dec = candidate.split(".", 1)
        for drop in range(1, len(int_part)):
            trimmed = int_part[drop:] + "." + dec
            try:
                value = sign * float(trimmed)
            except ValueError:
                continue
            if min_val <= value <= max_val:
                return value
    else:
        for drop in range(1, len(candidate)):
            trimmed = candidate[drop:]
            try:
                value = sign * float(trimmed)
            except ValueError:
                continue
            if min_val <= value <= max_val:
                return value

    return None


def _schema_for_table(headers: List[str], table_type: str) -> Dict[str, Any]:
    header_keys: List[Optional[str]] = []
    numeric_keys: set = set()
    decimal_keys: set = set()
    plausible_ranges: Dict[str, Tuple[float, float]] = {}
    critical_keys: set = set()

    for header in headers:
        key = _schema_key_for_header(header, table_type)
        header_keys.append(key)

    if table_type == "per_pitch":
        numeric_keys = PER_PITCH_NUMERIC_KEYS
        decimal_keys = PER_PITCH_DECIMAL_KEYS
        for key in header_keys:
            if key and key in PER_PITCH_RANGES:
                plausible_ranges[key] = PER_PITCH_RANGES[key]
        critical_keys = PER_PITCH_CRITICAL_KEYS
    else:
        numeric_keys = PER_TYPE_NUMERIC_KEYS
        decimal_keys = PER_TYPE_DECIMAL_KEYS
        for key in header_keys:
            if key and key in PER_TYPE_RANGES:
                plausible_ranges[key] = PER_TYPE_RANGES[key]
        critical_keys = PER_TYPE_CRITICAL_KEYS
        if "count" in header_keys:
            critical_keys = set(critical_keys) | {"count"}

    return {
        "header_keys": header_keys,
        "numeric_keys": numeric_keys,
        "decimal_keys": decimal_keys,
        "plausible_ranges": plausible_ranges,
        "critical_keys": critical_keys,
    }


def _score_row(row: Dict[str, Any], plausible_ranges: Dict[str, Tuple[float, float]], critical_keys: set) -> Tuple[int, int]:
    good = 0
    bad = 0
    missing = 0
    for key, (min_val, max_val) in plausible_ranges.items():
        if key not in row:
            continue
        val = row.get(key)
        if val is None:
            if key in critical_keys:
                missing += 1
            continue
        if min_val <= val <= max_val:
            good += 1
        else:
            bad += 1
    return good - bad - missing, bad


def _critical_present(row: Dict[str, Any], critical_keys: set) -> int:
    count = 0
    for key in critical_keys:
        if key in row and row.get(key) is not None:
            count += 1
    return count


def _shift_numeric_cells(headers: List[str], header_keys: List[Optional[str]], cells: List[str], shift: int, numeric_keys: set) -> List[str]:
    numeric_indices: List[int] = []
    for idx, key in enumerate(header_keys):
        if key in numeric_keys:
            numeric_indices.append(idx)

    if not numeric_indices:
        return list(cells)

    shifted = list(cells)
    for pos, idx in enumerate(numeric_indices):
        src_pos = pos + shift
        if 0 <= src_pos < len(numeric_indices):
            shifted[idx] = cells[numeric_indices[src_pos]]
        else:
            shifted[idx] = ""
    return shifted


def _parse_cells_basic(
    headers: List[str],
    header_keys: List[Optional[str]],
    cells: List[str],
    numeric_keys: set,
    decimal_keys: set,
) -> Tuple[Dict[str, Any], List[str], Dict[str, Optional[str]]]:
    row: Dict[str, Any] = {}
    warnings: List[str] = []
    raw_by_key: Dict[str, Optional[str]] = {}

    for i, header in enumerate(headers):
        if i >= len(cells):
            break
        schema_key = header_keys[i]
        raw_value = cells[i]
        if schema_key:
            raw_by_key[schema_key] = raw_value

        if schema_key is None:
            continue

        if schema_key == "pitch_type":
            value = (raw_value or "").strip()
            row[schema_key] = value or None
        elif schema_key == "pitch_number":
            num, num_warnings, _ = _parse_number(raw_value, expect_decimal=False)
            if num_warnings:
                warnings.extend([f"PITCH_NUMBER_{w}" for w in num_warnings])
            row[schema_key] = int(num) if num is not None else None
        elif schema_key == "count":
            num, num_warnings, _ = _parse_number(raw_value, expect_decimal=False)
            if num_warnings:
                warnings.extend([f"COUNT_{w}" for w in num_warnings])
            row[schema_key] = int(num) if num is not None else None
        elif schema_key in numeric_keys:
            value, num_warnings, _ = _parse_number(raw_value, expect_decimal=schema_key in decimal_keys)
            if num_warnings:
                warnings.extend([f"{schema_key.upper()}_{w}" for w in num_warnings])
            row[schema_key] = value
        else:
            row[schema_key] = raw_value

    return row, warnings, raw_by_key


def _finalize_row(
    row: Dict[str, Any],
    warnings: List[str],
    raw_columns: Dict[str, str],
    raw_by_key: Dict[str, Optional[str]],
    plausible_ranges: Dict[str, Tuple[float, float]],
    critical_keys: set,
) -> Dict[str, Any]:
    out_of_range: List[str] = []

    for key, (min_val, max_val) in plausible_ranges.items():
        val = row.get(key)
        if val is None:
            continue
        if min_val <= val <= max_val:
            continue

        repaired = _attempt_trim_repair(raw_by_key.get(key), min_val, max_val)
        if repaired is not None:
            row[key] = repaired
            warnings.append(f"TRIMMED_NUMERIC_{key.upper()}")
        else:
            warnings.append(f"OUT_OF_RANGE_{key.upper()}")
            out_of_range.append(key)

    if any(k in critical_keys for k in out_of_range):
        warnings.append("INVALID_ROW")
        row["is_valid"] = False
    else:
        row["is_valid"] = True

    row["raw_columns"] = raw_columns
    seen = set()
    deduped: List[str] = []
    for w in warnings:
        if w not in seen:
            seen.add(w)
            deduped.append(w)
    row["parse_warnings"] = deduped
    return row


def parse_rows_from_cells(
    headers: List[str],
    rows: List[List[str]],
    table_type: str,
    return_debug: bool = False,
) -> Any:
    """Parse data rows given already-sliced column cells."""
    schema = _schema_for_table(headers, table_type)
    header_keys = schema["header_keys"]
    numeric_keys = schema["numeric_keys"]
    decimal_keys = schema["decimal_keys"]
    plausible_ranges = schema["plausible_ranges"]
    critical_keys = schema["critical_keys"]

    parsed_rows: List[Dict[str, Any]] = []
    debug_rows: List[Dict[str, Any]] = []

    for source_index, cells in enumerate(rows):
        if cells is None:
            if return_debug:
                debug_rows.append({
                    "source_index": source_index,
                    "raw_cells": None,
                    "raw_columns": {},
                    "parsed": None,
                    "warnings": ["EMPTY_ROW"],
                    "is_valid": False,
                    "included": False,
                })
            continue
        padded = list(cells)
        if len(padded) < len(headers):
            padded.extend([""] * (len(headers) - len(padded)))
        elif len(padded) > len(headers):
            padded = padded[: len(headers)]

        raw_columns = {header: padded[i] for i, header in enumerate(headers)}

        base_row, base_warnings, raw_by_key = _parse_cells_basic(
            headers, header_keys, padded, numeric_keys, decimal_keys
        )
        best_row = base_row
        best_warnings = list(base_warnings)
        best_raw_by_key = dict(raw_by_key)
        best_score, best_bad = _score_row(best_row, plausible_ranges, critical_keys)
        best_shift = 0
        best_critical = _critical_present(best_row, critical_keys)

        for shift in (-1, 1):
            shifted_cells = _shift_numeric_cells(headers, header_keys, padded, shift, numeric_keys)
            shifted_row, shifted_warnings, shifted_raw_by_key = _parse_cells_basic(
                headers, header_keys, shifted_cells, numeric_keys, decimal_keys
            )
            score, bad = _score_row(shifted_row, plausible_ranges, critical_keys)
            critical_count = _critical_present(shifted_row, critical_keys)
            if critical_count < best_critical:
                continue
            if score > best_score or (score == best_score and bad < best_bad):
                best_row = shifted_row
                best_warnings = list(shifted_warnings)
                best_raw_by_key = dict(shifted_raw_by_key)
                best_score = score
                best_bad = bad
                best_critical = critical_count
                best_shift = shift

        if best_shift != 0:
            best_warnings.append("COLUMN_SHIFT_REPAIRED")

        final_row = _finalize_row(
            best_row,
            best_warnings,
            raw_columns,
            best_raw_by_key,
            plausible_ranges,
            critical_keys,
        )

        included = any(
            v is not None
            for k, v in final_row.items()
            if k not in ("pitch_type", "raw_columns", "parse_warnings")
        )
        if included:
            parsed_rows.append(final_row)
        if return_debug:
            debug_rows.append({
                "source_index": source_index,
                "raw_cells": padded,
                "raw_columns": raw_columns,
                "parsed": final_row,
                "warnings": final_row.get("parse_warnings", []),
                "is_valid": final_row.get("is_valid", True),
                "included": included,
            })

    if return_debug:
        return parsed_rows, debug_rows
    return parsed_rows


def _split_data_line(line: str, header_count: int, table_type: str) -> List[str]:
    """Split a data line into fields, handling the pitch type as a multi-word first field."""
    parts = line.split()

    if table_type == "per_type":
        type_parts = []
        num_start = 0
        for i, part in enumerate(parts):
            cleaned = part.replace(",", "").lstrip("-")
            if cleaned and cleaned.replace(".", "", 1).isdigit():
                num_start = i
                break
            type_parts.append(part)
        else:
            return parts

        pitch_type = " ".join(type_parts)
        fields = [pitch_type] + parts[num_start:]
        return fields

    if table_type == "per_pitch":
        if len(parts) < 2:
            return parts

        pitch_num = parts[0]
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
    """Parse data lines into a list of row dictionaries (text fallback)."""
    rows: List[Dict[str, Any]] = []

    for line in data_lines:
        fields = _split_data_line(line, len(headers), table_type)
        if not fields:
            continue
        parsed = parse_rows_from_cells(headers, [fields], table_type, return_debug=False)
        rows.extend(parsed)

    return rows
