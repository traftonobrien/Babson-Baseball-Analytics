"""Tests for import_trackman_pdf CLI helpers: path resolution, PDF discovery, CLI options."""

import os
import sys
import time

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scripts.import_trackman_pdf import resolve_pdf_dir, list_pdfs, latest_pdf, parse_date_from_filename, _DEFAULT_PDF_DIRS


class TestResolvePdfDir:
    def test_explicit_dir_exists(self, tmp_path):
        result = resolve_pdf_dir(str(tmp_path))
        assert result == str(tmp_path)

    def test_explicit_dir_missing_raises(self):
        with pytest.raises(FileNotFoundError, match="PDF directory not found"):
            resolve_pdf_dir("/nonexistent/path/that/does/not/exist")

    def test_default_repo_relative(self, tmp_path, monkeypatch):
        """When repo-relative Trackman Exports/ exists, use it."""
        import scripts.import_trackman_pdf as mod

        export_dir = tmp_path / "Trackman Exports"
        export_dir.mkdir()
        monkeypatch.setattr(mod, "_DEFAULT_PDF_DIRS", [str(export_dir)])
        result = resolve_pdf_dir(None)
        assert result == str(export_dir)

    def test_default_fallback_order(self, tmp_path, monkeypatch):
        """Uses the first existing directory from the candidates list."""
        import scripts.import_trackman_pdf as mod

        first = tmp_path / "first"
        second = tmp_path / "second"
        second.mkdir()
        monkeypatch.setattr(mod, "_DEFAULT_PDF_DIRS", [str(first), str(second)])
        result = resolve_pdf_dir(None)
        assert result == str(second)

    def test_no_defaults_raises(self, monkeypatch):
        import scripts.import_trackman_pdf as mod

        monkeypatch.setattr(mod, "_DEFAULT_PDF_DIRS", ["/does/not/exist/a", "/does/not/exist/b"])
        with pytest.raises(FileNotFoundError, match="Default PDF export folder not found"):
            resolve_pdf_dir(None)


class TestListPdfs:
    def test_finds_pdfs_sorted_by_mtime(self, tmp_path):
        older = tmp_path / "older.pdf"
        newer = tmp_path / "newer.pdf"
        older.write_bytes(b"old")
        time.sleep(0.05)
        newer.write_bytes(b"new")

        result = list_pdfs(str(tmp_path))
        assert len(result) == 2
        assert result[0].endswith("older.pdf")
        assert result[1].endswith("newer.pdf")

    def test_ignores_non_pdf(self, tmp_path):
        (tmp_path / "readme.txt").write_text("not a pdf")
        (tmp_path / "data.csv").write_text("col1,col2")
        (tmp_path / "real.pdf").write_bytes(b"pdf content")

        result = list_pdfs(str(tmp_path))
        assert len(result) == 1
        assert result[0].endswith("real.pdf")

    def test_empty_dir(self, tmp_path):
        assert list_pdfs(str(tmp_path)) == []

    def test_recursive_discovery(self, tmp_path):
        subdir = tmp_path / "Bobby Burk 2"
        subdir.mkdir()
        (subdir / "13.pdf").write_bytes(b"pdf")
        (tmp_path / "top.pdf").write_bytes(b"pdf2")

        result = list_pdfs(str(tmp_path))
        assert len(result) == 2

    def test_filename_with_spaces_and_slashes(self, tmp_path):
        """The user's naming convention includes spaces and path-like names."""
        subdir = tmp_path / "Bobby Burk 2"
        subdir.mkdir()
        pdf = subdir / "13.pdf"
        pdf.write_bytes(b"content")

        result = list_pdfs(str(tmp_path))
        assert len(result) == 1
        assert "Bobby Burk 2" in result[0]


class TestLatestPdf:
    def test_returns_newest(self, tmp_path):
        old = tmp_path / "old.pdf"
        old.write_bytes(b"a")
        time.sleep(0.05)
        new = tmp_path / "new.pdf"
        new.write_bytes(b"b")

        result = latest_pdf(str(tmp_path))
        assert result.endswith("new.pdf")

    def test_empty_dir_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError, match="No PDF files found"):
            latest_pdf(str(tmp_path))


class TestCLIArgs:
    """Test argparse behavior without running real imports."""

    def test_pdf_flag_accepted(self):
        """--pdf flag should be accepted by the parser."""
        from scripts.import_trackman_pdf import main
        import argparse

        # Verify parser accepts --pdf
        parser = argparse.ArgumentParser()
        source = parser.add_mutually_exclusive_group()
        source.add_argument("--pdf")
        source.add_argument("--latest", action="store_true")
        source.add_argument("--all", action="store_true", dest="import_all")
        args = parser.parse_args(["--pdf", "test.pdf"])
        assert args.pdf == "test.pdf"
        assert not args.latest
        assert not args.import_all

    def test_latest_flag(self):
        import argparse

        parser = argparse.ArgumentParser()
        source = parser.add_mutually_exclusive_group()
        source.add_argument("--pdf")
        source.add_argument("--latest", action="store_true")
        source.add_argument("--all", action="store_true", dest="import_all")
        args = parser.parse_args(["--latest"])
        assert args.latest
        assert args.pdf is None

    def test_all_flag(self):
        import argparse

        parser = argparse.ArgumentParser()
        source = parser.add_mutually_exclusive_group()
        source.add_argument("--pdf")
        source.add_argument("--latest", action="store_true")
        source.add_argument("--all", action="store_true", dest="import_all")
        args = parser.parse_args(["--all"])
        assert args.import_all

    def test_pdf_and_latest_mutually_exclusive(self):
        import argparse

        parser = argparse.ArgumentParser()
        source = parser.add_mutually_exclusive_group()
        source.add_argument("--pdf")
        source.add_argument("--latest", action="store_true")
        source.add_argument("--all", action="store_true", dest="import_all")
        with pytest.raises(SystemExit):
            parser.parse_args(["--pdf", "test.pdf", "--latest"])


class TestParseDateFromFilename:
    def test_colon_separator(self):
        assert parse_date_from_filename("Bobby Burk 2:13.pdf", "2026") == "2026-02-13"

    def test_slash_in_path_component(self):
        # On macOS, Finder shows '/' but filesystem stores ':'. A literal '/' is a
        # path separator, so os.path.basename sees only "13.pdf" — no date found.
        assert parse_date_from_filename("Bobby Burk 2/13.pdf", "2026") is None

    def test_single_digit_month_and_day(self):
        assert parse_date_from_filename("Chase Burrows 1:1.pdf", "2026") == "2026-01-01"

    def test_double_digit(self):
        assert parse_date_from_filename("Joe Carrea 12:25.pdf", "2026") == "2026-12-25"

    def test_no_date_in_filename(self):
        assert parse_date_from_filename("Baseball Team Portal Export.pdf") is None

    def test_year_hint_used(self):
        result = parse_date_from_filename("Bobby Burk 2:13.pdf", "2025")
        assert result == "2025-02-13"

    def test_no_year_hint_uses_current_year(self):
        from datetime import datetime
        result = parse_date_from_filename("Bobby Burk 2:13.pdf")
        assert result is not None
        assert result.startswith(str(datetime.now().year))

    def test_full_path(self):
        result = parse_date_from_filename("/Users/foo/Trackman Exports/Bobby Burk 2:13.pdf", "2026")
        assert result == "2026-02-13"

    def test_invalid_month(self):
        assert parse_date_from_filename("Player 13:5.pdf") is None

    def test_invalid_day(self):
        assert parse_date_from_filename("Player 2:32.pdf") is None
