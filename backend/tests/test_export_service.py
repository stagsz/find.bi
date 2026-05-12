"""Tests for services/export_service.py.

Uses pytest's tmp_path fixture to create real DuckDB databases and
exercises CSV, Excel, and JSON export plus all error branches.
"""

from __future__ import annotations

import csv
import io
import json
import os

import duckdb
import openpyxl
import pytest

from services.export_service import export_to_csv, export_to_excel, export_to_json


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(tmp_path: pytest.TempPathFactory, table_name: str = "sales") -> str:
    """Create a DuckDB file with one table and return its path."""
    db_path = str(tmp_path / "test.db")
    conn = duckdb.connect(db_path)
    try:
        conn.execute(
            f'CREATE TABLE "{table_name}" (id INTEGER, name VARCHAR, score DOUBLE)'
        )
        conn.execute(
            f'INSERT INTO "{table_name}" VALUES (1, \'Alice\', 95.5), (2, \'Bob\', 87.0)'
        )
    finally:
        conn.close()
    return db_path


# ---------------------------------------------------------------------------
# export_to_csv
# ---------------------------------------------------------------------------


class TestExportToCsv:
    def test_returns_bytes(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        result = export_to_csv(db_path, "sales")
        assert isinstance(result, bytes)

    def test_headers_present(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_csv(db_path, "sales").decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))
        assert reader.fieldnames == ["id", "name", "score"]

    def test_correct_data(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_csv(db_path, "sales").decode("utf-8")
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)
        assert len(rows) == 2
        assert rows[0]["name"] == "Alice"
        assert rows[1]["name"] == "Bob"

    def test_round_trip_parseable(self, tmp_path: pytest.TempPathFactory) -> None:
        """CSV output must be parseable back via csv.reader."""
        db_path = _make_db(tmp_path)
        content = export_to_csv(db_path, "sales").decode("utf-8")
        reader = csv.reader(io.StringIO(content))
        all_rows = list(reader)
        # header + 2 data rows
        assert len(all_rows) == 3
        assert all_rows[0] == ["id", "name", "score"]

    def test_error_missing_db(self, tmp_path: pytest.TempPathFactory) -> None:
        with pytest.raises(ValueError, match="not found"):
            export_to_csv(str(tmp_path / "nonexistent.db"), "sales")

    def test_error_missing_table(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        with pytest.raises(ValueError, match="not found"):
            export_to_csv(db_path, "ghost_table")


# ---------------------------------------------------------------------------
# export_to_excel
# ---------------------------------------------------------------------------


class TestExportToExcel:
    def test_returns_bytes(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        result = export_to_excel(db_path, "sales")
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_valid_xlsx(self, tmp_path: pytest.TempPathFactory) -> None:
        """Returned bytes must be a valid .xlsx workbook."""
        db_path = _make_db(tmp_path)
        content = export_to_excel(db_path, "sales")
        wb = openpyxl.load_workbook(io.BytesIO(content))
        assert wb is not None

    def test_sheet_name(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_excel(db_path, "sales")
        wb = openpyxl.load_workbook(io.BytesIO(content))
        assert "sales" in wb.sheetnames

    def test_sheet_name_truncated(self, tmp_path: pytest.TempPathFactory) -> None:
        """Sheet names longer than 31 chars must be truncated."""
        long_name = "a" * 40
        db_path = _make_db(tmp_path, table_name=long_name)
        content = export_to_excel(db_path, long_name)
        wb = openpyxl.load_workbook(io.BytesIO(content))
        assert wb.sheetnames[0] == long_name[:31]

    def test_data_present(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_excel(db_path, "sales")
        wb = openpyxl.load_workbook(io.BytesIO(content))
        ws = wb.active
        # Row 1 = header, rows 2-3 = data
        assert ws.max_row == 3
        assert ws.cell(row=1, column=1).value == "id"
        assert ws.cell(row=2, column=2).value == "Alice"

    def test_header_is_bold(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_excel(db_path, "sales")
        wb = openpyxl.load_workbook(io.BytesIO(content))
        ws = wb.active
        for cell in ws[1]:
            assert cell.font.bold is True

    def test_error_missing_db(self, tmp_path: pytest.TempPathFactory) -> None:
        with pytest.raises(ValueError, match="not found"):
            export_to_excel(str(tmp_path / "nonexistent.db"), "sales")

    def test_error_missing_table(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        with pytest.raises(ValueError, match="not found"):
            export_to_excel(db_path, "ghost_table")


# ---------------------------------------------------------------------------
# export_to_json
# ---------------------------------------------------------------------------


class TestExportToJson:
    def test_returns_bytes(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        result = export_to_json(db_path, "sales")
        assert isinstance(result, bytes)

    def test_valid_json_array(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_json(db_path, "sales")
        data = json.loads(content)
        assert isinstance(data, list)
        assert len(data) == 2

    def test_keys_match_columns(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_json(db_path, "sales")
        data = json.loads(content)
        for row in data:
            assert set(row.keys()) == {"id", "name", "score"}

    def test_values_correct(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        content = export_to_json(db_path, "sales")
        data = json.loads(content)
        names = {row["name"] for row in data}
        assert names == {"Alice", "Bob"}

    def test_error_missing_db(self, tmp_path: pytest.TempPathFactory) -> None:
        with pytest.raises(ValueError, match="not found"):
            export_to_json(str(tmp_path / "nonexistent.db"), "sales")

    def test_error_missing_table(self, tmp_path: pytest.TempPathFactory) -> None:
        db_path = _make_db(tmp_path)
        with pytest.raises(ValueError, match="not found"):
            export_to_json(db_path, "ghost_table")
