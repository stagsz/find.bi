"""Schema detection service using server-side DuckDB.

Sniffs column names, types, and row count from uploaded data files.
Supports CSV, JSON, Parquet, and Excel (.xlsx, .xls) formats.
"""

from __future__ import annotations

import os
from typing import Any

import duckdb

# Map DuckDB type names to simpler, frontend-friendly type strings.
_TYPE_MAP: dict[str, str] = {
    "BIGINT": "integer",
    "INTEGER": "integer",
    "SMALLINT": "integer",
    "TINYINT": "integer",
    "HUGEINT": "integer",
    "UBIGINT": "integer",
    "UINTEGER": "integer",
    "USMALLINT": "integer",
    "UTINYINT": "integer",
    "UHUGEINT": "integer",
    "FLOAT": "float",
    "DOUBLE": "float",
    "DECIMAL": "float",
    "BOOLEAN": "boolean",
    "DATE": "date",
    "TIME": "time",
    "TIMESTAMP": "datetime",
    "TIMESTAMP WITH TIME ZONE": "datetime",
    "TIMESTAMP_S": "datetime",
    "TIMESTAMP_MS": "datetime",
    "TIMESTAMP_NS": "datetime",
    "INTERVAL": "interval",
    "BLOB": "binary",
    "UUID": "uuid",
}


def _friendly_type(duckdb_type: str) -> str:
    """Convert a DuckDB type string to a simplified type name."""
    upper = duckdb_type.upper()
    if upper in _TYPE_MAP:
        return _TYPE_MAP[upper]
    # Handle parameterised types like DECIMAL(18,3) or VARCHAR(255)
    base = upper.split("(")[0].strip()
    if base in _TYPE_MAP:
        return _TYPE_MAP[base]
    if base == "VARCHAR" or base == "TEXT" or base.startswith("CHAR"):
        return "string"
    # Struct, list, map, etc. — keep original
    return duckdb_type.lower()


def _read_function(ext: str) -> str:
    """Return the DuckDB read function for a given file extension."""
    ext = ext.lower()
    if ext == ".csv":
        return "read_csv_auto"
    if ext == ".json":
        return "read_json_auto"
    if ext == ".parquet":
        return "read_parquet"
    if ext in {".xlsx", ".xls"}:
        return "st_read"
    raise ValueError(f"Unsupported file type: {ext}")


def detect_schema(file_path: str) -> dict[str, Any]:
    """Detect the schema of a data file using DuckDB.

    Parameters
    ----------
    file_path:
        Absolute path to the uploaded file.

    Returns
    -------
    dict with keys:
        columns  – list of {"name": str, "type": str, "duckdb_type": str}
        row_count – int total rows
        file_path – str (echo back for caller convenience)

    Raises
    ------
    ValueError
        If the file does not exist, has an unsupported extension,
        or cannot be parsed by DuckDB.
    """
    if not os.path.isfile(file_path):
        raise ValueError(f"File not found: {file_path}")

    _, ext = os.path.splitext(file_path)
    if not ext:
        raise ValueError("File has no extension")

    read_fn = _read_function(ext)  # raises ValueError if unsupported

    conn = duckdb.connect(":memory:")
    try:
        # For Excel files, DuckDB needs the spatial extension for st_read
        if read_fn == "st_read":
            conn.install_extension("spatial")
            conn.load_extension("spatial")

        # Use forward slashes — DuckDB on Windows chokes on backslashes
        safe_path = file_path.replace("\\", "/")

        # Read the file into a temporary view
        conn.execute(
            f"CREATE VIEW _schema_detect AS SELECT * FROM {read_fn}('{safe_path}')"
        )

        # Fetch column metadata via DESCRIBE
        describe_result = conn.execute("DESCRIBE _schema_detect").fetchall()
        columns = []
        for row in describe_result:
            col_name = row[0]
            duckdb_type = row[1]
            columns.append(
                {
                    "name": col_name,
                    "type": _friendly_type(duckdb_type),
                    "duckdb_type": duckdb_type,
                }
            )

        # Count rows
        count_result = conn.execute(
            "SELECT COUNT(*) FROM _schema_detect"
        ).fetchone()
        row_count = count_result[0] if count_result else 0

        return {
            "columns": columns,
            "row_count": row_count,
            "file_path": file_path,
        }
    except duckdb.Error as e:
        raise ValueError(f"Failed to parse file: {e}") from e
    finally:
        conn.close()
