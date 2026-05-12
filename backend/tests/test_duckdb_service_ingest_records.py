"""Unit tests for duckdb_service.ingest_from_records.

Uses real DuckDB files written to pytest's tmp_path for isolation.
"""

import os

import duckdb
import pytest

from services.duckdb_service import ingest_from_records


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(tmp_path: object) -> str:
    """Create an empty DuckDB file and return its path."""
    db_path = os.path.join(str(tmp_path), "test.db")
    conn = duckdb.connect(db_path)
    conn.close()
    return db_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_creates_new_table(tmp_path: object) -> None:
    """ingest_from_records creates the target table when it doesn't exist."""
    db_path = _make_db(tmp_path)
    records = [{"name": "Alice", "score": "95"}, {"name": "Bob", "score": "87"}]

    count = ingest_from_records(db_path, "results", records)

    assert count == 2

    conn = duckdb.connect(db_path)
    rows = conn.execute('SELECT name, score FROM "results" ORDER BY name').fetchall()
    conn.close()

    assert rows == [("Alice", "95"), ("Bob", "87")]


def test_inserts_into_existing_table(tmp_path: object) -> None:
    """ingest_from_records appends rows to an existing table."""
    db_path = _make_db(tmp_path)

    # Seed the table
    conn = duckdb.connect(db_path)
    conn.execute('CREATE TABLE "events" (event_type VARCHAR, user_id VARCHAR)')
    conn.execute('INSERT INTO "events" VALUES (\'click\', \'u1\')')
    conn.close()

    records = [{"event_type": "view", "user_id": "u2"}]
    count = ingest_from_records(db_path, "events", records)

    assert count == 1

    conn = duckdb.connect(db_path)
    total = conn.execute('SELECT COUNT(*) FROM "events"').fetchone()[0]
    conn.close()

    assert total == 2


def test_returns_correct_row_count(tmp_path: object) -> None:
    """ingest_from_records returns the number of records provided."""
    db_path = _make_db(tmp_path)
    records = [{"x": str(i)} for i in range(10)]

    count = ingest_from_records(db_path, "nums", records)

    assert count == 10


def test_single_record(tmp_path: object) -> None:
    """Works correctly with a single-element list."""
    db_path = _make_db(tmp_path)
    count = ingest_from_records(db_path, "solo", [{"val": "hello"}])
    assert count == 1


def test_error_on_missing_db(tmp_path: object) -> None:
    """ValueError when db_path does not exist."""
    missing_path = os.path.join(str(tmp_path), "ghost.db")

    with pytest.raises(ValueError, match="Database file not found"):
        ingest_from_records(missing_path, "t", [{"a": "1"}])


def test_error_on_empty_records(tmp_path: object) -> None:
    """ValueError when records list is empty."""
    db_path = _make_db(tmp_path)

    with pytest.raises(ValueError, match="records must not be empty"):
        ingest_from_records(db_path, "t", [])


def test_ignores_extra_keys_in_existing_table(tmp_path: object) -> None:
    """Extra keys in records are silently ignored for existing tables."""
    db_path = _make_db(tmp_path)

    conn = duckdb.connect(db_path)
    conn.execute('CREATE TABLE "narrow" (col_a VARCHAR)')
    conn.close()

    records = [{"col_a": "keep", "col_b": "extra"}]
    count = ingest_from_records(db_path, "narrow", records)
    assert count == 1

    conn = duckdb.connect(db_path)
    rows = conn.execute('SELECT * FROM "narrow"').fetchall()
    conn.close()

    assert rows == [("keep",)]


def test_sanitizes_table_name(tmp_path: object) -> None:
    """Table names with special characters are sanitized."""
    db_path = _make_db(tmp_path)
    count = ingest_from_records(db_path, "my-bad table!", [{"v": "1"}])
    assert count == 1

    conn = duckdb.connect(db_path)
    tables = {
        row[0]
        for row in conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main'"
        ).fetchall()
    }
    conn.close()

    # Should exist under the sanitized name (no hyphens / spaces)
    assert any("my" in t for t in tables)
