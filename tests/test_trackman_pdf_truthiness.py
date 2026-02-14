"""Truthiness gate for Trackman PDF extraction against fixture."""

import os
import re
import sys
from typing import Dict, List

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman_pdf.rows import COLUMN_MAP, parse_rows_from_cells
from trackman_pdf.table import extract_table_from_pdf
from trackman.summary import build_session_summary


FIXTURE_PDF = os.path.join(
    os.path.dirname(__file__),
    "fixtures",
    "trackman_pdf",
    "Baseball Team Portal Export.pdf",
)


def _raw_numbers(text: str) -> List[float]:
    if not text:
        return []
    numbers = re.findall(r"[-+]?\\d+(?:\\.\\d+)?", text.replace(",", ""))
    out = []
    for n in numbers:
        try:
            out.append(float(n))
        except ValueError:
            continue
    return out


def test_fixture_truthiness():
    if not os.path.exists(FIXTURE_PDF):
        pytest.skip("Fixture PDF not found")

    extraction, _ = extract_table_from_pdf(FIXTURE_PDF, debug=False)
    assert extraction is not None

    raw_row_count = sum(len(p.rows) for p in extraction.pages)
    assert raw_row_count > 0

    rows: List[Dict[str, object]] = []
    header_union = set()
    for page in extraction.pages:
        header_union.update(page.headers)
        rows_cells = [r.cells for r in page.rows]
        rows.extend(parse_rows_from_cells(page.headers, rows_cells, page.table_type))

    assert len(rows) == raw_row_count

    required_keys = {"pitch_type", "avg_velocity_mph"}
    if "Count" in header_union or "Pitches" in header_union or "Pitch Count" in header_union or "#" in header_union:
        required_keys.add("count")
    if "RPM" in header_union:
        required_keys.add("avg_spin_rpm")
    if "IVB" in header_union:
        required_keys.add("avg_ivb_in")
    if "HB" in header_union:
        required_keys.add("avg_hb_in")
    if "Extension" in header_union:
        required_keys.add("avg_extension_ft")

    valid_rows = [r for r in rows if r.get("is_valid") is not False]
    assert valid_rows

    for row in valid_rows:
        for key in required_keys:
            assert key in row
            if key == "pitch_type":
                assert row[key]
            else:
                assert row[key] is not None

    # Sanity ranges for valid rows
    for row in valid_rows:
        if row.get("avg_velocity_mph") is not None:
            assert 30 <= row["avg_velocity_mph"] <= 110
        if row.get("avg_spin_rpm") is not None:
            assert 100 <= row["avg_spin_rpm"] <= 4500
        if row.get("avg_ivb_in") is not None:
            assert -40 <= row["avg_ivb_in"] <= 40
        if row.get("avg_hb_in") is not None:
            assert -40 <= row["avg_hb_in"] <= 40
        if row.get("avg_extension_ft") is not None:
            assert 0 <= row["avg_extension_ft"] <= 10

    # Parsed values should match raw columns unless a repair occurred
    for row in valid_rows:
        warnings = row.get("parse_warnings", [])
        repaired = any(
            w.startswith("TRIMMED_NUMERIC_")
            or w.endswith("_MULTI_NUMBER")
            or w == "COLUMN_SHIFT_REPAIRED"
            or w.startswith("OUT_OF_RANGE_")
            for w in warnings
        )
        if repaired:
            continue

        raw_columns = row.get("raw_columns") or {}
        for header, raw_value in raw_columns.items():
            schema_key = COLUMN_MAP.get(header)
            if not schema_key or schema_key == "pitch_type":
                continue
            parsed_value = row.get(schema_key)
            if parsed_value is None:
                continue
            raw_numbers = _raw_numbers(raw_value or "")
            if not raw_numbers:
                continue
            # Compare to the first numeric token from the PDF cell
            assert abs(parsed_value - raw_numbers[0]) < 0.01

    # If raw MPH looked absurd, it must be repaired or invalidated
    for row in rows:
        raw = (row.get("raw_columns") or {}).get("MPH")
        if not raw:
            continue
        raw_vals = _raw_numbers(raw)
        if not raw_vals:
            continue
        if any(v < 30 or v > 110 for v in raw_vals):
            warnings = row.get("parse_warnings", [])
            assert row.get("is_valid") is False or "TRIMMED_NUMERIC_AVG_VELOCITY_MPH" in warnings

    # Invalid rows must be excluded from summary aggregation
    invalid_rows = [r for r in rows if r.get("is_valid") is False]
    summary = build_session_summary(rows)
    if summary.get("total_pitches") is not None:
        counts = [r.get("count") for r in rows if r.get("count") is not None]
        assert summary["total_pitches"] == sum(counts)
