"""DuckDB ingestion service for loading files into workspace databases.

Loads uploaded data files (CSV, JSON, Parquet, Excel) into named tables
within a workspace's DuckDB database file.
"""

from __future__ import annotations

import os
import re
from typing import Any

import duckdb

from services.schema_service import _friendly_type, _read_function


def _sanitize_table_name(name: str) -> str:
    """Sanitize a user-provided table name for use as a DuckDB identifier.

    Keeps only alphanumeric characters and underscores. Strips leading
    digits so the result is a valid SQL identifier. Falls back to
    ``"table_"`` if the result would be empty.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "_", name)
    cleaned = re.sub(r"^[0-9]+", "", cleaned)
    cleaned = cleaned.strip("_")
    return cleaned if cleaned else "table_"


def _resolve_table_name(conn: duckdb.DuckDBPyConnection, desired: str) -> str:
    """Return a unique table name, appending ``_2``, ``_3``, … if needed."""
    existing: set[str] = {
        row[0]
        for row in conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main'"
        ).fetchall()
    }
    if desired not in existing:
        return desired
    suffix = 2
    while f"{desired}_{suffix}" in existing:
        suffix += 1
    return f"{desired}_{suffix}"


def ingest_file(
    db_path: str,
    file_path: str,
    table_name: str,
) -> dict[str, Any]:
    """Load an uploaded file into a workspace DuckDB database as a table.

    Parameters
    ----------
    db_path:
        Absolute path to the workspace ``.db`` file. The file (and its
        parent directories) will be created if they don't exist.
    file_path:
        Absolute path to the uploaded data file.
    table_name:
        Desired table name. Will be sanitized and de-duplicated.

    Returns
    -------
    dict with keys:
        table_name – str, the actual table name used (may differ from input)
        columns    – list of {"name": str, "type": str, "duckdb_type": str}
        row_count  – int, total rows ingested
        db_path    – str, echo back for caller convenience

    Raises
    ------
    ValueError
        If the file does not exist, has an unsupported extension,
        or cannot be ingested by DuckDB.
    """
    if not os.path.isfile(file_path):
        raise ValueError(f"File not found: {file_path}")

    _, ext = os.path.splitext(file_path)
    if not ext:
        raise ValueError("File has no extension")

    read_fn = _read_function(ext)  # raises ValueError if unsupported

    # Ensure parent directory for the .db file exists
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    safe_name = _sanitize_table_name(table_name)

    conn = duckdb.connect(db_path)
    try:
        # For Excel files, DuckDB needs the spatial extension
        if read_fn == "st_read":
            conn.install_extension("spatial")
            conn.load_extension("spatial")

        # Use forward slashes — DuckDB on Windows chokes on backslashes
        safe_path = file_path.replace("\\", "/")

        # Resolve a unique table name in case of duplicates
        final_name = _resolve_table_name(conn, safe_name)

        # Ingest the file into a persistent table
        conn.execute(
            f'CREATE TABLE "{final_name}" AS '
            f"SELECT * FROM {read_fn}('{safe_path}')"
        )

        # Read back column metadata
        describe_result = conn.execute(f'DESCRIBE "{final_name}"').fetchall()
        columns: list[dict[str, str]] = []
        for row in describe_result:
            columns.append(
                {
                    "name": row[0],
                    "type": _friendly_type(row[1]),
                    "duckdb_type": row[1],
                }
            )

        # Row count
        count_result = conn.execute(
            f'SELECT COUNT(*) FROM "{final_name}"'
        ).fetchone()
        row_count: int = count_result[0] if count_result else 0

        return {
            "table_name": final_name,
            "columns": columns,
            "row_count": row_count,
            "db_path": db_path,
        }
    except duckdb.Error as e:
        raise ValueError(f"Failed to ingest file: {e}") from e
    finally:
        conn.close()


def list_tables(db_path: str) -> list[dict[str, Any]]:
    """List all tables in a workspace DuckDB database with schema info.

    Parameters
    ----------
    db_path:
        Absolute path to the workspace ``.db`` file.

    Returns
    -------
    list of dicts, each with keys:
        table_name – str
        columns    – list of {"name": str, "type": str, "duckdb_type": str}
        row_count  – int

    Raises
    ------
    ValueError
        If the database file does not exist.
    """
    if not os.path.isfile(db_path):
        raise ValueError(f"Database file not found: {db_path}")

    conn = duckdb.connect(db_path, read_only=True)
    try:
        tables_result = conn.execute(
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'main' "
            "ORDER BY table_name"
        ).fetchall()

        tables: list[dict[str, Any]] = []
        for (tbl_name,) in tables_result:
            describe_result = conn.execute(f'DESCRIBE "{tbl_name}"').fetchall()
            columns: list[dict[str, str]] = []
            for row in describe_result:
                columns.append(
                    {
                        "name": row[0],
                        "type": _friendly_type(row[1]),
                        "duckdb_type": row[1],
                    }
                )

            count_result = conn.execute(
                f'SELECT COUNT(*) FROM "{tbl_name}"'
            ).fetchone()
            row_count: int = count_result[0] if count_result else 0

            tables.append(
                {
                    "table_name": tbl_name,
                    "columns": columns,
                    "row_count": row_count,
                }
            )
        return tables
    except duckdb.Error as e:
        raise ValueError(f"Failed to read database: {e}") from e
    finally:
        conn.close()


def export_table(
    db_path: str,
    table_name: str,
    output_path: str,
    export_format: str = "parquet",
) -> None:
    """Export a table from workspace DuckDB to a file.

    Parameters
    ----------
    db_path:
        Absolute path to the workspace ``.db`` file.
    table_name:
        Name of the table to export.
    output_path:
        Absolute path for the output file.
    export_format:
        Output format: ``"parquet"`` or ``"csv"``.

    Raises
    ------
    ValueError
        If the database file doesn't exist, the table doesn't exist,
        or the export fails.
    """
    if not os.path.isfile(db_path):
        raise ValueError(f"Database file not found: {db_path}")

    safe_name = _sanitize_table_name(table_name)

    conn = duckdb.connect(db_path, read_only=True)
    try:
        existing = {
            row[0]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main'"
            ).fetchall()
        }
        if safe_name not in existing:
            raise ValueError(f"Table not found: {table_name}")

        safe_output = output_path.replace("\\", "/")
        if export_format == "csv":
            conn.execute(
                f'COPY "{safe_name}" TO \'{safe_output}\' (FORMAT CSV, HEADER)'
            )
        else:
            conn.execute(
                f'COPY "{safe_name}" TO \'{safe_output}\' (FORMAT PARQUET)'
            )
    except duckdb.Error as e:
        raise ValueError(f"Failed to export table: {e}") from e
    finally:
        conn.close()


def drop_table(db_path: str, table_name: str) -> bool:
    """Drop a table from a workspace DuckDB database.

    Parameters
    ----------
    db_path:
        Absolute path to the workspace ``.db`` file.
    table_name:
        Name of the table to drop.

    Returns
    -------
    True if the table was dropped, False if it didn't exist.

    Raises
    ------
    ValueError
        If the database file does not exist.
    """
    if not os.path.isfile(db_path):
        raise ValueError(f"Database file not found: {db_path}")

    safe_name = _sanitize_table_name(table_name)

    conn = duckdb.connect(db_path)
    try:
        existing = {
            row[0]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main'"
            ).fetchall()
        }
        if safe_name not in existing:
            return False

        conn.execute(f'DROP TABLE "{safe_name}"')
        return True
    except duckdb.Error as e:
        raise ValueError(f"Failed to drop table: {e}") from e
    finally:
        conn.close()
