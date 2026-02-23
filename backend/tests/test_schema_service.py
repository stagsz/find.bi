"""Tests for the schema detection service."""

from __future__ import annotations

import json
import os

import pytest

from services.schema_service import _friendly_type, _read_function, detect_schema

# ---------------------------------------------------------------------------
# Helper: create sample files in a temp directory
# ---------------------------------------------------------------------------


def _write_csv(tmp_path: object, name: str = "sample.csv") -> str:
    """Write a simple CSV and return its absolute path."""
    path = os.path.join(str(tmp_path), name)
    with open(path, "w", encoding="utf-8") as f:
        f.write("id,name,score,active\n")
        f.write("1,Alice,95.5,true\n")
        f.write("2,Bob,87.0,false\n")
        f.write("3,Charlie,91.2,true\n")
    return path


def _write_json(tmp_path: object, name: str = "sample.json") -> str:
    """Write a newline-delimited JSON file and return its path."""
    path = os.path.join(str(tmp_path), name)
    rows = [
        {"city": "Stockholm", "pop": 1000000, "capital": True},
        {"city": "Gothenburg", "pop": 600000, "capital": False},
    ]
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    return path


def _write_parquet(tmp_path: object) -> str:
    """Write a Parquet file via DuckDB and return its path."""
    import duckdb

    path = os.path.join(str(tmp_path), "sample.parquet")
    safe = path.replace("\\", "/")
    conn = duckdb.connect(":memory:")
    conn.execute(
        f"COPY (SELECT 1 AS x, 'a' AS y UNION ALL SELECT 2, 'b') "
        f"TO '{safe}' (FORMAT PARQUET)"
    )
    conn.close()
    return path


# ---------------------------------------------------------------------------
# _friendly_type
# ---------------------------------------------------------------------------


class TestFriendlyType:
    def test_integer_types(self) -> None:
        assert _friendly_type("BIGINT") == "integer"
        assert _friendly_type("INTEGER") == "integer"
        assert _friendly_type("SMALLINT") == "integer"
        assert _friendly_type("TINYINT") == "integer"

    def test_float_types(self) -> None:
        assert _friendly_type("FLOAT") == "float"
        assert _friendly_type("DOUBLE") == "float"
        assert _friendly_type("DECIMAL(18,3)") == "float"

    def test_string_types(self) -> None:
        assert _friendly_type("VARCHAR") == "string"
        assert _friendly_type("VARCHAR(255)") == "string"
        assert _friendly_type("TEXT") == "string"

    def test_boolean(self) -> None:
        assert _friendly_type("BOOLEAN") == "boolean"

    def test_datetime_types(self) -> None:
        assert _friendly_type("DATE") == "date"
        assert _friendly_type("TIMESTAMP") == "datetime"
        assert _friendly_type("TIMESTAMP WITH TIME ZONE") == "datetime"

    def test_unknown_type_passthrough(self) -> None:
        result = _friendly_type("STRUCT(a INTEGER, b VARCHAR)")
        assert result == "struct(a integer, b varchar)"


# ---------------------------------------------------------------------------
# _read_function
# ---------------------------------------------------------------------------


class TestReadFunction:
    def test_csv(self) -> None:
        assert _read_function(".csv") == "read_csv_auto"

    def test_json(self) -> None:
        assert _read_function(".json") == "read_json_auto"

    def test_parquet(self) -> None:
        assert _read_function(".parquet") == "read_parquet"

    def test_excel(self) -> None:
        assert _read_function(".xlsx") == "st_read"
        assert _read_function(".xls") == "st_read"

    def test_unsupported(self) -> None:
        with pytest.raises(ValueError, match="Unsupported file type"):
            _read_function(".txt")

    def test_case_insensitive(self) -> None:
        assert _read_function(".CSV") == "read_csv_auto"
        assert _read_function(".JSON") == "read_json_auto"


# ---------------------------------------------------------------------------
# detect_schema — CSV
# ---------------------------------------------------------------------------


class TestDetectSchemaCSV:
    def test_csv_columns(self, tmp_path: object) -> None:
        path = _write_csv(tmp_path)
        result = detect_schema(path)

        assert "columns" in result
        names = [c["name"] for c in result["columns"]]
        assert names == ["id", "name", "score", "active"]

    def test_csv_types(self, tmp_path: object) -> None:
        path = _write_csv(tmp_path)
        result = detect_schema(path)

        types = {c["name"]: c["type"] for c in result["columns"]}
        assert types["id"] == "integer"
        assert types["name"] == "string"
        assert types["score"] == "float"
        assert types["active"] == "boolean"

    def test_csv_row_count(self, tmp_path: object) -> None:
        path = _write_csv(tmp_path)
        result = detect_schema(path)
        assert result["row_count"] == 3

    def test_csv_file_path_echoed(self, tmp_path: object) -> None:
        path = _write_csv(tmp_path)
        result = detect_schema(path)
        assert result["file_path"] == path

    def test_csv_duckdb_type_included(self, tmp_path: object) -> None:
        path = _write_csv(tmp_path)
        result = detect_schema(path)
        col0 = result["columns"][0]
        assert "duckdb_type" in col0
        assert col0["duckdb_type"] != ""


# ---------------------------------------------------------------------------
# detect_schema — JSON
# ---------------------------------------------------------------------------


class TestDetectSchemaJSON:
    def test_json_columns(self, tmp_path: object) -> None:
        path = _write_json(tmp_path)
        result = detect_schema(path)

        names = [c["name"] for c in result["columns"]]
        assert "city" in names
        assert "pop" in names
        assert "capital" in names

    def test_json_row_count(self, tmp_path: object) -> None:
        path = _write_json(tmp_path)
        result = detect_schema(path)
        assert result["row_count"] == 2

    def test_json_types(self, tmp_path: object) -> None:
        path = _write_json(tmp_path)
        result = detect_schema(path)

        types = {c["name"]: c["type"] for c in result["columns"]}
        assert types["city"] == "string"
        assert types["pop"] == "integer"
        assert types["capital"] == "boolean"


# ---------------------------------------------------------------------------
# detect_schema — Parquet
# ---------------------------------------------------------------------------


class TestDetectSchemaParquet:
    def test_parquet_columns(self, tmp_path: object) -> None:
        path = _write_parquet(tmp_path)
        result = detect_schema(path)

        names = [c["name"] for c in result["columns"]]
        assert names == ["x", "y"]

    def test_parquet_row_count(self, tmp_path: object) -> None:
        path = _write_parquet(tmp_path)
        result = detect_schema(path)
        assert result["row_count"] == 2

    def test_parquet_types(self, tmp_path: object) -> None:
        path = _write_parquet(tmp_path)
        result = detect_schema(path)

        types = {c["name"]: c["type"] for c in result["columns"]}
        assert types["x"] == "integer"
        assert types["y"] == "string"


# ---------------------------------------------------------------------------
# detect_schema — Error cases
# ---------------------------------------------------------------------------


class TestDetectSchemaErrors:
    def test_file_not_found(self) -> None:
        with pytest.raises(ValueError, match="File not found"):
            detect_schema("/nonexistent/file.csv")

    def test_no_extension(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "noext")
        with open(path, "w") as f:
            f.write("data")
        with pytest.raises(ValueError, match="File has no extension"):
            detect_schema(path)

    def test_unsupported_extension(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "file.txt")
        with open(path, "w") as f:
            f.write("data")
        with pytest.raises(ValueError, match="Unsupported file type"):
            detect_schema(path)

    def test_corrupted_csv(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "bad.csv")
        with open(path, "wb") as f:
            f.write(b"\x00\x01\x02\x03")
        # DuckDB may still parse binary garbage as a single column CSV;
        # the key requirement is that it doesn't crash — it either
        # returns a schema or raises ValueError.
        try:
            result = detect_schema(path)
            assert isinstance(result["columns"], list)
        except ValueError:
            pass  # acceptable: corrupted file raises

    def test_corrupted_parquet(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "bad.parquet")
        with open(path, "wb") as f:
            f.write(b"this is not parquet")
        with pytest.raises(ValueError, match="Failed to parse file"):
            detect_schema(path)


# ---------------------------------------------------------------------------
# detect_schema — Edge cases
# ---------------------------------------------------------------------------


class TestDetectSchemaEdgeCases:
    def test_empty_csv_with_headers(self, tmp_path: object) -> None:
        """A CSV with headers but no data rows."""
        path = os.path.join(str(tmp_path), "empty.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write("col_a,col_b,col_c\n")
        result = detect_schema(path)
        assert result["row_count"] == 0
        names = [c["name"] for c in result["columns"]]
        assert names == ["col_a", "col_b", "col_c"]

    def test_single_column_csv(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "single.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write("value\n10\n20\n30\n")
        result = detect_schema(path)
        assert len(result["columns"]) == 1
        assert result["columns"][0]["name"] == "value"
        assert result["row_count"] == 3

    def test_large_row_count(self, tmp_path: object) -> None:
        """Verify row count works for a larger dataset."""
        path = os.path.join(str(tmp_path), "big.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write("n\n")
            for i in range(1000):
                f.write(f"{i}\n")
        result = detect_schema(path)
        assert result["row_count"] == 1000
