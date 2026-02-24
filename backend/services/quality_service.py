"""Data quality analysis service for workspace DuckDB tables.

Scans a table and produces a quality score (0-100) with a detailed
issues list covering null values, duplicate rows, type consistency,
and outlier detection (IQR method).
"""

from __future__ import annotations

import os
from typing import Any

import duckdb

from services.schema_service import _friendly_type


def _get_column_info(
    conn: duckdb.DuckDBPyConnection, table_name: str
) -> list[dict[str, str]]:
    """Return column metadata for a table."""
    describe_result = conn.execute(f'DESCRIBE "{table_name}"').fetchall()
    columns: list[dict[str, str]] = []
    for row in describe_result:
        columns.append(
            {
                "name": row[0],
                "type": _friendly_type(row[1]),
                "duckdb_type": row[1],
            }
        )
    return columns


def _check_nulls(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[dict[str, str]],
    row_count: int,
) -> list[dict[str, Any]]:
    """Check for NULL values in each column."""
    issues: list[dict[str, Any]] = []
    if row_count == 0:
        return issues

    # Build a single query to count nulls for all columns at once
    null_exprs = [
        f'COUNT(*) FILTER (WHERE "{col["name"]}" IS NULL) AS "{col["name"]}"'
        for col in columns
    ]
    query = f'SELECT {", ".join(null_exprs)} FROM "{table_name}"'
    result = conn.execute(query).fetchone()
    if not result:
        return issues

    for i, col in enumerate(columns):
        null_count = result[i]
        if null_count > 0:
            pct = round(null_count / row_count * 100, 1)
            issues.append(
                {
                    "type": "nulls",
                    "column": col["name"],
                    "count": null_count,
                    "description": (
                        f'Column "{col["name"]}" has {null_count} null '
                        f"values ({pct}% of rows)"
                    ),
                }
            )
    return issues


def _check_duplicates(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    row_count: int,
) -> list[dict[str, Any]]:
    """Check for fully duplicate rows."""
    issues: list[dict[str, Any]] = []
    if row_count == 0:
        return issues

    distinct_result = conn.execute(
        f'SELECT COUNT(*) FROM (SELECT DISTINCT * FROM "{table_name}")'
    ).fetchone()
    distinct_count = distinct_result[0] if distinct_result else row_count
    dup_count = row_count - distinct_count

    if dup_count > 0:
        pct = round(dup_count / row_count * 100, 1)
        issues.append(
            {
                "type": "duplicates",
                "column": None,
                "count": dup_count,
                "description": (
                    f"{dup_count} duplicate rows found ({pct}% of rows)"
                ),
            }
        )
    return issues


def _check_type_consistency(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[dict[str, str]],
    row_count: int,
) -> list[dict[str, Any]]:
    """Check VARCHAR columns for values that look like other types.

    If most non-null values in a VARCHAR column are numeric or boolean,
    the column may have been incorrectly typed during ingestion.
    """
    issues: list[dict[str, Any]] = []
    if row_count == 0:
        return issues

    varchar_cols = [c for c in columns if c["type"] == "string"]
    for col in varchar_cols:
        name = col["name"]
        # Count non-null values and how many look numeric
        result = conn.execute(
            f'SELECT '
            f'COUNT(*) FILTER (WHERE "{name}" IS NOT NULL), '
            f'COUNT(*) FILTER (WHERE "{name}" IS NOT NULL '
            f'  AND TRY_CAST("{name}" AS DOUBLE) IS NOT NULL) '
            f'FROM "{table_name}"'
        ).fetchone()
        if not result:
            continue

        non_null_count = result[0]
        numeric_count = result[1]

        if non_null_count == 0:
            continue

        numeric_pct = numeric_count / non_null_count
        if numeric_pct >= 0.8:
            issues.append(
                {
                    "type": "type_mismatch",
                    "column": name,
                    "count": numeric_count,
                    "description": (
                        f'Column "{name}" is VARCHAR but {round(numeric_pct * 100)}% '
                        f"of values are numeric — consider casting to a number type"
                    ),
                }
            )
    return issues


def _check_outliers(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    columns: list[dict[str, str]],
    row_count: int,
) -> list[dict[str, Any]]:
    """Detect outliers in numeric columns using the IQR method.

    Outliers are values below Q1 - 1.5*IQR or above Q3 + 1.5*IQR.
    """
    issues: list[dict[str, Any]] = []
    if row_count < 4:
        # Need enough data for meaningful quartile calculation
        return issues

    numeric_cols = [c for c in columns if c["type"] in ("integer", "float")]
    for col in numeric_cols:
        name = col["name"]
        # Calculate Q1, Q3 using PERCENTILE_CONT
        iqr_result = conn.execute(
            f'SELECT '
            f'PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{name}"), '
            f'PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{name}") '
            f'FROM "{table_name}" '
            f'WHERE "{name}" IS NOT NULL'
        ).fetchone()
        if not iqr_result or iqr_result[0] is None or iqr_result[1] is None:
            continue

        q1 = float(iqr_result[0])
        q3 = float(iqr_result[1])
        iqr = q3 - q1

        if iqr == 0:
            # All values in the IQR are the same — no meaningful outliers
            continue

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outlier_result = conn.execute(
            f'SELECT COUNT(*) FROM "{table_name}" '
            f'WHERE "{name}" IS NOT NULL '
            f'AND ("{name}" < {lower_bound} OR "{name}" > {upper_bound})'
        ).fetchone()
        outlier_count = outlier_result[0] if outlier_result else 0

        if outlier_count > 0:
            pct = round(outlier_count / row_count * 100, 1)
            issues.append(
                {
                    "type": "outliers",
                    "column": name,
                    "count": outlier_count,
                    "description": (
                        f'Column "{name}" has {outlier_count} outliers '
                        f"({pct}% of rows) outside IQR bounds "
                        f"[{round(lower_bound, 2)}, {round(upper_bound, 2)}]"
                    ),
                }
            )
    return issues


def _compute_score(
    issues: list[dict[str, Any]],
    row_count: int,
) -> int:
    """Compute a quality score from 0-100 based on detected issues.

    Deduction rules:
    - Each column with >10% nulls: -5
    - Any column with nulls (<=10%): -2
    - Duplicate rows present: -min(20, dup_pct / 2)
    - Each type-mismatch column: -3
    - Each column with outliers: -1 (capped at -20 total)
    """
    score = 100.0

    outlier_deduction = 0.0
    for issue in issues:
        if issue["type"] == "nulls":
            # Deduct based on severity
            if row_count > 0:
                null_pct = issue["count"] / row_count * 100
                if null_pct > 10:
                    score -= 5
                else:
                    score -= 2

        elif issue["type"] == "duplicates":
            if row_count > 0:
                dup_pct = issue["count"] / row_count * 100
                score -= min(20, dup_pct / 2)

        elif issue["type"] == "type_mismatch":
            score -= 3

        elif issue["type"] == "outliers":
            outlier_deduction += 1

    score -= min(20, outlier_deduction)

    return max(0, min(100, round(score)))


def analyze_table(db_path: str, table_name: str) -> dict[str, Any]:
    """Analyze data quality for a table in a workspace DuckDB database.

    Runs four checks: null values, duplicate rows, type consistency
    (VARCHAR columns with mostly numeric values), and outlier detection
    (IQR method on numeric columns).

    Parameters
    ----------
    db_path:
        Absolute path to the workspace ``.db`` file.
    table_name:
        Name of the table to analyze.

    Returns
    -------
    dict with keys:
        quality_score – int (0-100)
        issues        – list of issue dicts, each with keys:
                        type (nulls|duplicates|type_mismatch|outliers),
                        column (str or None), count (int), description (str)
        table_name    – str
        row_count     – int
        column_count  – int

    Raises
    ------
    ValueError
        If the database file doesn't exist or the table is not found.
    """
    if not os.path.isfile(db_path):
        raise ValueError(f"Database file not found: {db_path}")

    conn = duckdb.connect(db_path, read_only=True)
    try:
        # Verify the table exists
        existing = {
            row[0]
            for row in conn.execute(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'main'"
            ).fetchall()
        }
        if table_name not in existing:
            raise ValueError(f"Table not found: {table_name}")

        columns = _get_column_info(conn, table_name)

        count_result = conn.execute(
            f'SELECT COUNT(*) FROM "{table_name}"'
        ).fetchone()
        row_count: int = count_result[0] if count_result else 0

        # Run all quality checks
        issues: list[dict[str, Any]] = []
        issues.extend(_check_nulls(conn, table_name, columns, row_count))
        issues.extend(_check_duplicates(conn, table_name, row_count))
        issues.extend(
            _check_type_consistency(conn, table_name, columns, row_count)
        )
        issues.extend(_check_outliers(conn, table_name, columns, row_count))

        quality_score = _compute_score(issues, row_count)

        return {
            "quality_score": quality_score,
            "issues": issues,
            "table_name": table_name,
            "row_count": row_count,
            "column_count": len(columns),
        }
    except duckdb.Error as e:
        raise ValueError(f"Failed to analyze table: {e}") from e
    finally:
        conn.close()
