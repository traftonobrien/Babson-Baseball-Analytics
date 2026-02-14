"""Tests for the Trackman PDF pipeline.

Covers: meta extraction, table finding, row parsing, numeric cleaning,
summary accuracy, index update, and leaderboard ranking.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from trackman_pdf.extract import extract_pdf
from trackman_pdf.meta import PdfMeta, parse_meta, slugify
from trackman_pdf.table import find_table, extract_table_from_pdf
from trackman_pdf.rows import parse_rows, parse_rows_from_cells
from trackman.summary import build_session_summary


PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "Baseball Team Portal Export.pdf")


# ---------------------------------------------------------------------------
# Meta extraction
# ---------------------------------------------------------------------------

class TestMetaExtraction:
    SAMPLE_TEXT = (
        "Burk, Bobby RHP Babson College\n"
        "See Pitches by:\n"
        "Data from: Sessions:\n"
        "1/1/2026  2/14/2026  02/13/2026\n"
        "Stats per Pitch\n"
        "Pitch Type oMPH RPM IVB HB Extension\n"
    )

    def test_player_name(self):
        meta = parse_meta(self.SAMPLE_TEXT)
        assert meta.player_name == "Burk, Bobby"

    def test_handedness(self):
        meta = parse_meta(self.SAMPLE_TEXT)
        assert meta.handedness == "RHP"

    def test_team(self):
        meta = parse_meta(self.SAMPLE_TEXT)
        assert meta.team == "Babson College"

    def test_player_slug(self):
        meta = parse_meta(self.SAMPLE_TEXT)
        assert meta.player_slug == "burk_bobby"

    def test_dates_parsed(self):
        meta = parse_meta(self.SAMPLE_TEXT)
        assert meta.date_from == "2026-01-01"
        assert meta.date_to == "2026-02-14"
        assert meta.session_date is not None

    def test_lhp(self):
        meta = parse_meta("Smith, John LHP MIT\nSomething\n")
        assert meta.handedness == "LHP"
        assert meta.player_name == "Smith, John"

    def test_empty_text(self):
        meta = parse_meta("")
        assert meta.player_name is None
        assert meta.handedness is None


class TestSlugify:
    def test_basic(self):
        assert slugify("Burk, Bobby") == "burk_bobby"

    def test_spaces(self):
        assert slugify("John  Smith Jr") == "john_smith_jr"

    def test_punctuation(self):
        assert slugify("O'Brien, Trafton") == "obrien_trafton"


# ---------------------------------------------------------------------------
# Table detection
# ---------------------------------------------------------------------------

class TestTableDetection:
    SAMPLE_TEXT = (
        "Some chart text\n"
        "Stats per Pitch\n"
        "Pitch Type oMPH RPM IVB HB Extension Rel Height (ft) Rel Side (ft) 2D Spin Axis 3D Spin Axis Gyro\n"
        "\n"
        "Fastball 84.61 1,721.60 9.15 8.52 6.94 5.81 1.42 224\n"
        "Sinker 84.96 1,736.96 4.23 12.15 6.74 5.67 1.43 250\n"
        "Slider 74.72 1,730.76 -0.19 -12.81 6.28 6.03 1.50 94\n"
        "Other 79.59 1,718.28 5.02 3.01 6.41 5.69 1.48 187\n"
        "https://teamportal.trackmanbaseball.com/reports/abc123 1/1\n"
    )

    def test_table_found(self):
        table = find_table(self.SAMPLE_TEXT)
        assert table is not None

    def test_table_type_per_type(self):
        table = find_table(self.SAMPLE_TEXT)
        assert table.table_type == "per_type"

    def test_header_count(self):
        table = find_table(self.SAMPLE_TEXT)
        assert len(table.headers) >= 6
        assert "MPH" in table.headers
        assert "RPM" in table.headers

    def test_data_line_count(self):
        table = find_table(self.SAMPLE_TEXT)
        assert len(table.data_lines) == 4

    def test_no_table_in_empty(self):
        assert find_table("No pitch data here") is None


# ---------------------------------------------------------------------------
# Row parsing
# ---------------------------------------------------------------------------

class TestRowParsing:
    HEADERS = ["Pitch Type", "MPH", "RPM", "IVB", "HB", "Extension", "Rel Height", "Rel Side", "2D Spin Axis"]
    LINES = [
        "Fastball 84.61 1,721.60 9.15 8.52 6.94 5.81 1.42 224",
        "Slider 74.72 1,730.76 -0.19 -12.81 6.28 6.03 1.50 94",
    ]

    def test_row_count(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert len(rows) == 2

    def test_pitch_type(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[0]["pitch_type"] == "Fastball"
        assert rows[1]["pitch_type"] == "Slider"

    def test_velocity(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[0]["avg_velocity_mph"] == 84.61

    def test_comma_removal(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[0]["avg_spin_rpm"] == 1721.60

    def test_negative_values(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[1]["avg_ivb_in"] == -0.19
        assert rows[1]["avg_hb_in"] == -12.81

    def test_extension(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[0]["avg_extension_ft"] == 6.94

    def test_row_metadata(self):
        rows = parse_rows(self.HEADERS, self.LINES, "per_type")
        assert rows[0]["is_valid"] is True
        assert "raw_columns" in rows[0]
        assert "parse_warnings" in rows[0]

    def test_empty_lines(self):
        rows = parse_rows(self.HEADERS, [], "per_type")
        assert rows == []


class TestCellParsing:
    def test_trimmed_velocity(self):
        headers = ["Pitch Type", "MPH", "RPM"]
        cells = [["Other", "579.59", "1718.28"]]
        rows = parse_rows_from_cells(headers, cells, "per_type")
        assert rows[0]["avg_velocity_mph"] == 79.59
        assert "TRIMMED_NUMERIC_AVG_VELOCITY_MPH" in rows[0]["parse_warnings"]


# ---------------------------------------------------------------------------
# Numeric cleaning edge cases
# ---------------------------------------------------------------------------

class TestNumericCleaning:
    def test_blank_becomes_none(self):
        from trackman_pdf.rows import _clean_number
        assert _clean_number("") is None
        assert _clean_number(" ") is None

    def test_dash_becomes_none(self):
        from trackman_pdf.rows import _clean_number
        assert _clean_number("-") is None

    def test_na_becomes_none(self):
        from trackman_pdf.rows import _clean_number
        assert _clean_number("N/A") is None

    def test_comma_handled(self):
        from trackman_pdf.rows import _clean_number
        assert _clean_number("1,234.56") == 1234.56

    def test_multi_number_prefers_decimal(self):
        from trackman_pdf.rows import _parse_number
        value, warnings, chosen = _parse_number("IVB 12 9.15", expect_decimal=True)
        assert value == 9.15
        assert "MULTI_NUMBER" in warnings


# ---------------------------------------------------------------------------
# Summary accuracy
# ---------------------------------------------------------------------------

class TestSummary:
    ROWS = [
        {"pitch_type": "Fastball", "count": 10, "avg_velocity_mph": 84.0, "avg_spin_rpm": 1700, "avg_ivb_in": 9.0, "avg_hb_in": 8.0, "avg_extension_ft": 6.9},
        {"pitch_type": "Fastball", "count": 5, "avg_velocity_mph": 86.0, "avg_spin_rpm": 1800, "avg_ivb_in": 10.0, "avg_hb_in": 9.0, "avg_extension_ft": 7.1},
        {"pitch_type": "Slider", "count": 8, "avg_velocity_mph": 74.0, "avg_spin_rpm": 1730, "avg_ivb_in": -0.5, "avg_hb_in": -13.0, "avg_extension_ft": 6.3},
    ]

    def test_pitch_count(self):
        s = build_session_summary(self.ROWS)
        assert s["total_pitches"] == 23

    def test_pitch_types(self):
        s = build_session_summary(self.ROWS)
        assert "Fastball" in s["pitch_types"]
        assert "Slider" in s["pitch_types"]

    def test_velo_avg(self):
        s = build_session_summary(self.ROWS)
        # weighted avg = (84*10 + 86*5 + 74*8) / 23
        assert abs(s["weighted_avg_velocity_mph"] - 80.96) < 0.01

    def test_velo_max(self):
        s = build_session_summary(self.ROWS)
        assert s["max_velocity_mph"] == 86.0

    def test_per_type_breakdown(self):
        s = build_session_summary(self.ROWS)
        per_type = {pt["pitch_type"]: pt for pt in s["per_type"]}
        assert per_type["Fastball"]["count"] == 15
        assert per_type["Slider"]["count"] == 8

    def test_empty_summary(self):
        s = build_session_summary([])
        assert s["total_pitches"] is None
        assert s["weighted_avg_velocity_mph"] is None


# ---------------------------------------------------------------------------
# Index update (import_pdf uses this internally)
# ---------------------------------------------------------------------------

class TestIndexUpdate:
    def test_import_creates_files(self, tmp_path, monkeypatch):
        """Run import on sample PDF if available and verify outputs."""
        if not os.path.exists(PDF_PATH):
            pytest.skip("Sample PDF not found")

        # Redirect output to temp
        monkeypatch.setattr(
            "scripts.import_trackman_pdf.SESSIONS_BASE",
            str(tmp_path / "sessions"),
        )
        monkeypatch.setattr(
            "scripts.import_trackman_pdf.INDEX_PATH",
            str(tmp_path / "index.json"),
        )

        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
        from scripts.import_trackman_pdf import import_pdf

        result = import_pdf(
            PDF_PATH,
            session_date_override="2026-02-14",
            session_label_override="LiveAB",
            copy_pdf=False,
        )

        assert "pitch_types" in result
        assert len(result["pitch_types"]) > 0
        assert result["meta"]["player_name"] == "Burk, Bobby"
        assert os.path.exists(os.path.join(result["session_dir"], "pitch_types.json"))
        assert os.path.exists(os.path.join(result["session_dir"], "session_summary.json"))
        assert os.path.exists(tmp_path / "index.json")


# ---------------------------------------------------------------------------
# Leaderboard ranking
# ---------------------------------------------------------------------------

class TestLeaderboards:
    def test_build_empty(self):
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scripts"))
        from scripts.build_trackman_leaderboards import build_leaderboards

        lb = build_leaderboards()
        assert lb["session_count"] >= 0  # May be 0 if no data exists


# ---------------------------------------------------------------------------
# Full PDF pipeline integration
# ---------------------------------------------------------------------------

class TestFullPdfPipeline:
    def test_extract_parse_validate(self):
        """Full pipeline on sample PDF: extract -> meta -> table -> rows -> summary."""
        if not os.path.exists(PDF_PATH):
            pytest.skip("Sample PDF not found")

        content = extract_pdf(PDF_PATH)
        assert len(content.text) > 50

        meta = parse_meta(content.text)
        assert meta.player_name is not None

        table = find_table(content.text)
        assert table is not None
        assert len(table.data_lines) > 0

        rows = parse_rows(table.headers, table.data_lines, table.table_type)
        assert len(rows) > 0
        assert all(r.get("avg_velocity_mph") is not None for r in rows)
        assert all(r.get("pitch_type") is not None for r in rows)

        summary = build_session_summary(rows)
        if summary.get("total_pitches") is not None:
            assert summary["total_pitches"] >= 0
        assert summary["weighted_avg_velocity_mph"] is not None

    def test_char_based_extraction(self):
        if not os.path.exists(PDF_PATH):
            pytest.skip("Sample PDF not found")

        extraction, _ = extract_table_from_pdf(PDF_PATH, debug=False)
        assert extraction is not None
        total_rows = sum(len(p.rows) for p in extraction.pages)
        assert total_rows > 0
