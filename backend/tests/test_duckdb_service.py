"""Tests for the DuckDB ingestion service."""

from __future__ import annotations

import json
import os

import pytest

from services.duckdb_service import (
    _resolve_table_name,
    _sanitize_table_name,
    drop_table,
    export_table,
    ingest_file,
    list_tables,
)

# ---------------------------------------------------------------------------
# Helper: create sample data files in a temp directory
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


def _write_parquet(tmp_path: object, name: str = "sample.parquet") -> str:
    """Write a Parquet file via DuckDB and return its path."""
    import duckdb

    path = os.path.join(str(tmp_path), name)
    safe = path.replace("\\", "/")
    conn = duckdb.connect(":memory:")
    conn.execute(
        f"COPY (SELECT 1 AS x, 'a' AS y UNION ALL SELECT 2, 'b') "
        f"TO '{safe}' (FORMAT PARQUET)"
    )
    conn.close()
    return path


def _db_path(tmp_path: object, name: str = "test.db") -> str:
    """Return a path for a test DuckDB database."""
    return os.path.join(str(tmp_path), name)


# ---------------------------------------------------------------------------
# _sanitize_table_name
# ---------------------------------------------------------------------------


class TestSanitizeTableName:
    def test_simple_name(self) -> None:
        assert _sanitize_table_name("sales") == "sales"

    def test_spaces_replaced(self) -> None:
        assert _sanitize_table_name("my table") == "my_table"

    def test_special_chars_replaced(self) -> None:
        assert _sanitize_table_name("data-2024.csv") == "data_2024_csv"

    def test_leading_digits_stripped(self) -> None:
        assert _sanitize_table_name("123abc") == "abc"

    def test_empty_after_sanitize(self) -> None:
        assert _sanitize_table_name("!!!") == "table_"

    def test_underscores_preserved(self) -> None:
        assert _sanitize_table_name("my_table_name") == "my_table_name"

    def test_only_digits(self) -> None:
        assert _sanitize_table_name("12345") == "table_"

    def test_mixed_case(self) -> None:
        assert _sanitize_table_name("MyTable") == "MyTable"


# ---------------------------------------------------------------------------
# _resolve_table_name
# ---------------------------------------------------------------------------


class TestResolveTableName:
    def test_no_conflict(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        try:
            result = _resolve_table_name(conn, "sales")
            assert result == "sales"
        finally:
            conn.close()

    def test_conflict_appends_suffix(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        try:
            conn.execute("CREATE TABLE sales (x INTEGER)")
            result = _resolve_table_name(conn, "sales")
            assert result == "sales_2"
        finally:
            conn.close()

    def test_multiple_conflicts(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        try:
            conn.execute("CREATE TABLE sales (x INTEGER)")
            conn.execute("CREATE TABLE sales_2 (x INTEGER)")
            conn.execute("CREATE TABLE sales_3 (x INTEGER)")
            result = _resolve_table_name(conn, "sales")
            assert result == "sales_4"
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# ingest_file — CSV
# ---------------------------------------------------------------------------


class TestIngestCSV:
    def test_basic_ingest(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "sales")

        assert result["table_name"] == "sales"
        assert result["row_count"] == 3
        assert result["db_path"] == db
        assert len(result["columns"]) == 4

    def test_column_metadata(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "data")

        col_names = [c["name"] for c in result["columns"]]
        assert col_names == ["id", "name", "score", "active"]

        types = {c["name"]: c["type"] for c in result["columns"]}
        assert types["id"] == "integer"
        assert types["name"] == "string"
        assert types["score"] == "float"
        assert types["active"] == "boolean"

    def test_duckdb_type_included(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "t")

        for col in result["columns"]:
            assert "duckdb_type" in col
            assert col["duckdb_type"] != ""

    def test_data_persisted(self, tmp_path: object) -> None:
        """Verify the data is actually in the DuckDB file."""
        import duckdb

        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "people")

        conn = duckdb.connect(db, read_only=True)
        try:
            rows = conn.execute("SELECT * FROM people ORDER BY id").fetchall()
            assert len(rows) == 3
            assert rows[0][1] == "Alice"
        finally:
            conn.close()


# ---------------------------------------------------------------------------
# ingest_file — JSON
# ---------------------------------------------------------------------------


class TestIngestJSON:
    def test_json_ingest(self, tmp_path: object) -> None:
        json_path = _write_json(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, json_path, "cities")

        assert result["table_name"] == "cities"
        assert result["row_count"] == 2
        col_names = [c["name"] for c in result["columns"]]
        assert "city" in col_names
        assert "pop" in col_names


# ---------------------------------------------------------------------------
# ingest_file — Parquet
# ---------------------------------------------------------------------------


class TestIngestParquet:
    def test_parquet_ingest(self, tmp_path: object) -> None:
        pq_path = _write_parquet(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, pq_path, "pq_data")

        assert result["table_name"] == "pq_data"
        assert result["row_count"] == 2
        col_names = [c["name"] for c in result["columns"]]
        assert col_names == ["x", "y"]


# ---------------------------------------------------------------------------
# ingest_file — duplicate table handling
# ---------------------------------------------------------------------------


class TestIngestDuplicateTable:
    def test_duplicate_name_gets_suffix(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)

        r1 = ingest_file(db, csv_path, "data")
        assert r1["table_name"] == "data"

        r2 = ingest_file(db, csv_path, "data")
        assert r2["table_name"] == "data_2"

    def test_triple_duplicate(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)

        ingest_file(db, csv_path, "t")
        ingest_file(db, csv_path, "t")
        r3 = ingest_file(db, csv_path, "t")
        assert r3["table_name"] == "t_3"

    def test_different_names_no_conflict(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)

        r1 = ingest_file(db, csv_path, "alpha")
        r2 = ingest_file(db, csv_path, "beta")
        assert r1["table_name"] == "alpha"
        assert r2["table_name"] == "beta"


# ---------------------------------------------------------------------------
# ingest_file — table name sanitization
# ---------------------------------------------------------------------------


class TestIngestSanitization:
    def test_special_chars_sanitized(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "my-data.csv")
        assert result["table_name"] == "my_data_csv"

    def test_leading_digits_stripped(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "2024_sales")
        assert result["table_name"] == "sales"

    def test_empty_name_fallback(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        result = ingest_file(db, csv_path, "!!!")
        assert result["table_name"] == "table_"


# ---------------------------------------------------------------------------
# ingest_file — error cases
# ---------------------------------------------------------------------------


class TestIngestErrors:
    def test_file_not_found(self, tmp_path: object) -> None:
        db = _db_path(tmp_path)
        with pytest.raises(ValueError, match="File not found"):
            ingest_file(db, "/nonexistent/file.csv", "t")

    def test_no_extension(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "noext")
        with open(path, "w") as f:
            f.write("data")
        db = _db_path(tmp_path)
        with pytest.raises(ValueError, match="File has no extension"):
            ingest_file(db, path, "t")

    def test_unsupported_extension(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "file.txt")
        with open(path, "w") as f:
            f.write("data")
        db = _db_path(tmp_path)
        with pytest.raises(ValueError, match="Unsupported file type"):
            ingest_file(db, path, "t")

    def test_corrupted_parquet(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "bad.parquet")
        with open(path, "wb") as f:
            f.write(b"this is not parquet")
        db = _db_path(tmp_path)
        with pytest.raises(ValueError, match="Failed to ingest file"):
            ingest_file(db, path, "t")

    def test_creates_db_directory(self, tmp_path: object) -> None:
        """DB parent directory is auto-created if it doesn't exist."""
        csv_path = _write_csv(tmp_path)
        nested_db = os.path.join(str(tmp_path), "sub", "dir", "workspace.db")
        result = ingest_file(nested_db, csv_path, "t")
        assert os.path.isfile(nested_db)
        assert result["row_count"] == 3


# ---------------------------------------------------------------------------
# ingest_file — edge cases
# ---------------------------------------------------------------------------


class TestIngestEdgeCases:
    def test_empty_csv_with_headers(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "empty.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write("col_a,col_b\n")
        db = _db_path(tmp_path)
        result = ingest_file(db, path, "empty")
        assert result["row_count"] == 0
        assert len(result["columns"]) == 2

    def test_large_csv(self, tmp_path: object) -> None:
        path = os.path.join(str(tmp_path), "big.csv")
        with open(path, "w", encoding="utf-8") as f:
            f.write("n\n")
            for i in range(1000):
                f.write(f"{i}\n")
        db = _db_path(tmp_path)
        result = ingest_file(db, path, "big")
        assert result["row_count"] == 1000


# ---------------------------------------------------------------------------
# list_tables
# ---------------------------------------------------------------------------


class TestListTables:
    def test_empty_database(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        # Create an empty DuckDB file
        conn = duckdb.connect(db)
        conn.close()
        result = list_tables(db)
        assert result == []

    def test_single_table(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        result = list_tables(db)
        assert len(result) == 1
        assert result[0]["table_name"] == "sales"
        assert result[0]["row_count"] == 3
        assert len(result[0]["columns"]) == 4

    def test_multiple_tables(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        json_path = _write_json(tmp_path)
        db = _db_path(tmp_path)

        ingest_file(db, csv_path, "csv_data")
        ingest_file(db, json_path, "json_data")

        result = list_tables(db)
        assert len(result) == 2
        names = [t["table_name"] for t in result]
        assert "csv_data" in names
        assert "json_data" in names

    def test_column_types_present(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "typed")

        result = list_tables(db)
        cols = result[0]["columns"]
        for col in cols:
            assert "name" in col
            assert "type" in col
            assert "duckdb_type" in col

    def test_db_not_found(self) -> None:
        with pytest.raises(ValueError, match="Database file not found"):
            list_tables("/nonexistent/path.db")

    def test_tables_sorted(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "zebra")
        ingest_file(db, csv_path, "alpha")

        result = list_tables(db)
        names = [t["table_name"] for t in result]
        assert names == ["alpha", "zebra"]


# ---------------------------------------------------------------------------
# drop_table
# ---------------------------------------------------------------------------


class TestDropTable:
    def test_drop_existing_table(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        assert drop_table(db, "sales") is True
        assert list_tables(db) == []

    def test_drop_nonexistent_table(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        conn.close()
        assert drop_table(db, "nonexistent") is False

    def test_drop_one_of_many(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "alpha")
        ingest_file(db, csv_path, "beta")

        drop_table(db, "alpha")
        result = list_tables(db)
        assert len(result) == 1
        assert result[0]["table_name"] == "beta"

    def test_drop_db_not_found(self) -> None:
        with pytest.raises(ValueError, match="Database file not found"):
            drop_table("/nonexistent/path.db", "t")

    def test_drop_sanitizes_name(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "my_table")

        # "my-table" sanitizes to "my_table" which matches the existing table
        assert drop_table(db, "my-table") is True
        assert list_tables(db) == []


# ---------------------------------------------------------------------------
# export_table
# ---------------------------------------------------------------------------


class TestExportTable:
    def test_export_parquet(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        output = os.path.join(str(tmp_path), "export.parquet")
        export_table(db, "sales", output, "parquet")

        assert os.path.isfile(output)
        assert os.path.getsize(output) > 0

    def test_export_csv(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        output = os.path.join(str(tmp_path), "export.csv")
        export_table(db, "sales", output, "csv")

        assert os.path.isfile(output)
        with open(output, "r", encoding="utf-8") as f:
            content = f.read()
        assert "Alice" in content
        assert "Bob" in content

    def test_export_parquet_readable(self, tmp_path: object) -> None:
        """Exported Parquet can be read back by DuckDB."""
        import duckdb

        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        output = os.path.join(str(tmp_path), "export.parquet")
        export_table(db, "sales", output, "parquet")

        conn = duckdb.connect(":memory:")
        safe = output.replace("\\", "/")
        rows = conn.execute(f"SELECT * FROM read_parquet('{safe}')").fetchall()
        conn.close()
        assert len(rows) == 3

    def test_export_default_format_is_parquet(self, tmp_path: object) -> None:
        csv_path = _write_csv(tmp_path)
        db = _db_path(tmp_path)
        ingest_file(db, csv_path, "sales")

        output = os.path.join(str(tmp_path), "export.parquet")
        export_table(db, "sales", output)

        assert os.path.isfile(output)

    def test_export_nonexistent_table(self, tmp_path: object) -> None:
        import duckdb

        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        conn.close()

        output = os.path.join(str(tmp_path), "out.parquet")
        with pytest.raises(ValueError, match="Table not found"):
            export_table(db, "nonexistent", output)

    def test_export_db_not_found(self) -> None:
        with pytest.raises(ValueError, match="Database file not found"):
            export_table("/nonexistent/path.db", "t", "/tmp/out.parquet")
