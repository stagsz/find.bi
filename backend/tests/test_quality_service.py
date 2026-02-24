"""Tests for the data quality analysis service."""

from __future__ import annotations

import os

import duckdb
import pytest

from services.quality_service import analyze_table

# ---------------------------------------------------------------------------
# Helpers: create DuckDB tables with specific quality characteristics
# ---------------------------------------------------------------------------


def _db_path(tmp_path: object, name: str = "test.db") -> str:
    """Return a path for a test DuckDB database."""
    return os.path.join(str(tmp_path), name)


def _create_table(
    db_path: str,
    table_name: str,
    ddl: str,
    inserts: list[str],
) -> None:
    """Create a table in a DuckDB database with the given DDL and data."""
    conn = duckdb.connect(db_path)
    try:
        conn.execute(ddl)
        for insert in inserts:
            conn.execute(insert)
    finally:
        conn.close()


def _create_clean_table(tmp_path: object) -> str:
    """Create a table with no quality issues (no nulls, no dupes, no outliers)."""
    db = _db_path(tmp_path)
    _create_table(
        db,
        "clean",
        'CREATE TABLE "clean" (id INTEGER, name VARCHAR, score DOUBLE)',
        [
            "INSERT INTO clean VALUES (1, 'Alice', 90.0)",
            "INSERT INTO clean VALUES (2, 'Bob', 85.0)",
            "INSERT INTO clean VALUES (3, 'Charlie', 88.0)",
            "INSERT INTO clean VALUES (4, 'Diana', 92.0)",
            "INSERT INTO clean VALUES (5, 'Eve', 87.0)",
        ],
    )
    return db


def _create_table_with_nulls(tmp_path: object) -> str:
    """Create a table where some columns have NULL values."""
    db = _db_path(tmp_path)
    _create_table(
        db,
        "nulls_data",
        'CREATE TABLE "nulls_data" (id INTEGER, name VARCHAR, score DOUBLE)',
        [
            "INSERT INTO nulls_data VALUES (1, 'Alice', 90.0)",
            "INSERT INTO nulls_data VALUES (2, NULL, 85.0)",
            "INSERT INTO nulls_data VALUES (3, 'Charlie', NULL)",
            "INSERT INTO nulls_data VALUES (4, NULL, NULL)",
            "INSERT INTO nulls_data VALUES (5, 'Eve', 87.0)",
        ],
    )
    return db


def _create_table_with_many_nulls(tmp_path: object) -> str:
    """Create a table where a column has >10% nulls."""
    db = _db_path(tmp_path)
    inserts = []
    for i in range(10):
        if i < 8:
            inserts.append(f"INSERT INTO many_nulls VALUES ({i}, 'name_{i}')")
        else:
            inserts.append(f"INSERT INTO many_nulls VALUES ({i}, NULL)")
    _create_table(
        db,
        "many_nulls",
        'CREATE TABLE "many_nulls" (id INTEGER, name VARCHAR)',
        inserts,
    )
    return db


def _create_table_with_duplicates(tmp_path: object) -> str:
    """Create a table with duplicate rows."""
    db = _db_path(tmp_path)
    _create_table(
        db,
        "dupes",
        'CREATE TABLE "dupes" (id INTEGER, name VARCHAR, val DOUBLE)',
        [
            "INSERT INTO dupes VALUES (1, 'Alice', 10.0)",
            "INSERT INTO dupes VALUES (1, 'Alice', 10.0)",
            "INSERT INTO dupes VALUES (2, 'Bob', 20.0)",
            "INSERT INTO dupes VALUES (3, 'Charlie', 30.0)",
            "INSERT INTO dupes VALUES (3, 'Charlie', 30.0)",
            "INSERT INTO dupes VALUES (3, 'Charlie', 30.0)",
        ],
    )
    return db


def _create_table_with_type_mismatch(tmp_path: object) -> str:
    """Create a table with a VARCHAR column that is mostly numeric."""
    db = _db_path(tmp_path)
    _create_table(
        db,
        "types",
        'CREATE TABLE "types" (id INTEGER, amount VARCHAR)',
        [
            "INSERT INTO types VALUES (1, '100.50')",
            "INSERT INTO types VALUES (2, '200.75')",
            "INSERT INTO types VALUES (3, '300.00')",
            "INSERT INTO types VALUES (4, '400.25')",
            "INSERT INTO types VALUES (5, 'N/A')",
        ],
    )
    return db


def _create_table_with_outliers(tmp_path: object) -> str:
    """Create a table with numeric outliers (IQR method)."""
    db = _db_path(tmp_path)
    # Normal values cluster around 50-60, outlier at 500
    _create_table(
        db,
        "outliers",
        'CREATE TABLE "outliers" (id INTEGER, value DOUBLE)',
        [
            "INSERT INTO outliers VALUES (1, 50.0)",
            "INSERT INTO outliers VALUES (2, 52.0)",
            "INSERT INTO outliers VALUES (3, 55.0)",
            "INSERT INTO outliers VALUES (4, 58.0)",
            "INSERT INTO outliers VALUES (5, 51.0)",
            "INSERT INTO outliers VALUES (6, 53.0)",
            "INSERT INTO outliers VALUES (7, 56.0)",
            "INSERT INTO outliers VALUES (8, 59.0)",
            "INSERT INTO outliers VALUES (9, 54.0)",
            "INSERT INTO outliers VALUES (10, 500.0)",
        ],
    )
    return db


def _create_empty_table(tmp_path: object) -> str:
    """Create a table with columns but zero rows."""
    db = _db_path(tmp_path)
    _create_table(
        db,
        "empty",
        'CREATE TABLE "empty" (id INTEGER, name VARCHAR)',
        [],
    )
    return db


# ---------------------------------------------------------------------------
# analyze_table — clean data (perfect score)
# ---------------------------------------------------------------------------


class TestCleanTable:
    def test_perfect_score(self, tmp_path: object) -> None:
        db = _create_clean_table(tmp_path)
        result = analyze_table(db, "clean")
        assert result["quality_score"] == 100

    def test_no_issues(self, tmp_path: object) -> None:
        db = _create_clean_table(tmp_path)
        result = analyze_table(db, "clean")
        assert result["issues"] == []

    def test_return_structure(self, tmp_path: object) -> None:
        db = _create_clean_table(tmp_path)
        result = analyze_table(db, "clean")
        assert "quality_score" in result
        assert "issues" in result
        assert "table_name" in result
        assert "row_count" in result
        assert "column_count" in result

    def test_row_and_column_counts(self, tmp_path: object) -> None:
        db = _create_clean_table(tmp_path)
        result = analyze_table(db, "clean")
        assert result["row_count"] == 5
        assert result["column_count"] == 3
        assert result["table_name"] == "clean"


# ---------------------------------------------------------------------------
# analyze_table — null detection
# ---------------------------------------------------------------------------


class TestNullDetection:
    def test_detects_nulls(self, tmp_path: object) -> None:
        db = _create_table_with_nulls(tmp_path)
        result = analyze_table(db, "nulls_data")
        null_issues = [i for i in result["issues"] if i["type"] == "nulls"]
        assert len(null_issues) == 2  # name and score columns

    def test_null_counts_correct(self, tmp_path: object) -> None:
        db = _create_table_with_nulls(tmp_path)
        result = analyze_table(db, "nulls_data")
        null_issues = {
            i["column"]: i["count"]
            for i in result["issues"]
            if i["type"] == "nulls"
        }
        assert null_issues["name"] == 2
        assert null_issues["score"] == 2

    def test_null_description_includes_percentage(self, tmp_path: object) -> None:
        db = _create_table_with_nulls(tmp_path)
        result = analyze_table(db, "nulls_data")
        null_issues = [i for i in result["issues"] if i["type"] == "nulls"]
        for issue in null_issues:
            assert "%" in issue["description"]

    def test_score_deducted_for_nulls(self, tmp_path: object) -> None:
        db = _create_table_with_nulls(tmp_path)
        result = analyze_table(db, "nulls_data")
        # 2 columns with nulls at 40% each → -5 each → score 90
        assert result["quality_score"] < 100

    def test_high_null_percentage_deduction(self, tmp_path: object) -> None:
        db = _create_table_with_many_nulls(tmp_path)
        result = analyze_table(db, "many_nulls")
        # name column has 20% nulls (>10%) → -5
        null_issues = [i for i in result["issues"] if i["type"] == "nulls"]
        assert len(null_issues) == 1
        assert null_issues[0]["column"] == "name"
        assert result["quality_score"] == 95


# ---------------------------------------------------------------------------
# analyze_table — duplicate detection
# ---------------------------------------------------------------------------


class TestDuplicateDetection:
    def test_detects_duplicates(self, tmp_path: object) -> None:
        db = _create_table_with_duplicates(tmp_path)
        result = analyze_table(db, "dupes")
        dup_issues = [i for i in result["issues"] if i["type"] == "duplicates"]
        assert len(dup_issues) == 1

    def test_duplicate_count(self, tmp_path: object) -> None:
        db = _create_table_with_duplicates(tmp_path)
        result = analyze_table(db, "dupes")
        dup_issues = [i for i in result["issues"] if i["type"] == "duplicates"]
        # 6 rows, 3 distinct → 3 duplicates
        assert dup_issues[0]["count"] == 3

    def test_duplicate_description(self, tmp_path: object) -> None:
        db = _create_table_with_duplicates(tmp_path)
        result = analyze_table(db, "dupes")
        dup_issues = [i for i in result["issues"] if i["type"] == "duplicates"]
        assert "duplicate" in dup_issues[0]["description"].lower()
        assert "%" in dup_issues[0]["description"]

    def test_duplicate_column_is_none(self, tmp_path: object) -> None:
        db = _create_table_with_duplicates(tmp_path)
        result = analyze_table(db, "dupes")
        dup_issues = [i for i in result["issues"] if i["type"] == "duplicates"]
        assert dup_issues[0]["column"] is None

    def test_score_deducted_for_duplicates(self, tmp_path: object) -> None:
        db = _create_table_with_duplicates(tmp_path)
        result = analyze_table(db, "dupes")
        assert result["quality_score"] < 100


# ---------------------------------------------------------------------------
# analyze_table — type consistency
# ---------------------------------------------------------------------------


class TestTypeConsistency:
    def test_detects_type_mismatch(self, tmp_path: object) -> None:
        db = _create_table_with_type_mismatch(tmp_path)
        result = analyze_table(db, "types")
        type_issues = [
            i for i in result["issues"] if i["type"] == "type_mismatch"
        ]
        assert len(type_issues) == 1
        assert type_issues[0]["column"] == "amount"

    def test_type_mismatch_description(self, tmp_path: object) -> None:
        db = _create_table_with_type_mismatch(tmp_path)
        result = analyze_table(db, "types")
        type_issues = [
            i for i in result["issues"] if i["type"] == "type_mismatch"
        ]
        assert "numeric" in type_issues[0]["description"].lower()

    def test_no_type_mismatch_for_text_column(self, tmp_path: object) -> None:
        """A VARCHAR column with all text values should not trigger."""
        db = _db_path(tmp_path)
        _create_table(
            db,
            "text_only",
            'CREATE TABLE "text_only" (id INTEGER, label VARCHAR)',
            [
                "INSERT INTO text_only VALUES (1, 'red')",
                "INSERT INTO text_only VALUES (2, 'blue')",
                "INSERT INTO text_only VALUES (3, 'green')",
            ],
        )
        result = analyze_table(db, "text_only")
        type_issues = [
            i for i in result["issues"] if i["type"] == "type_mismatch"
        ]
        assert len(type_issues) == 0

    def test_score_deducted_for_type_mismatch(self, tmp_path: object) -> None:
        db = _create_table_with_type_mismatch(tmp_path)
        result = analyze_table(db, "types")
        assert result["quality_score"] == 97  # -3 for one mismatch


# ---------------------------------------------------------------------------
# analyze_table — outlier detection
# ---------------------------------------------------------------------------


class TestOutlierDetection:
    def test_detects_outliers(self, tmp_path: object) -> None:
        db = _create_table_with_outliers(tmp_path)
        result = analyze_table(db, "outliers")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        assert len(outlier_issues) == 1
        assert outlier_issues[0]["column"] == "value"

    def test_outlier_count(self, tmp_path: object) -> None:
        db = _create_table_with_outliers(tmp_path)
        result = analyze_table(db, "outliers")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        # Value 500 is far outside the IQR of ~50-59
        assert outlier_issues[0]["count"] >= 1

    def test_outlier_description_includes_bounds(self, tmp_path: object) -> None:
        db = _create_table_with_outliers(tmp_path)
        result = analyze_table(db, "outliers")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        assert "IQR" in outlier_issues[0]["description"]

    def test_no_outliers_uniform_data(self, tmp_path: object) -> None:
        """Uniform data should have no outliers."""
        db = _db_path(tmp_path)
        inserts = [
            f"INSERT INTO uniform VALUES ({i}, {50 + i})"
            for i in range(10)
        ]
        _create_table(
            db,
            "uniform",
            'CREATE TABLE "uniform" (id INTEGER, val DOUBLE)',
            inserts,
        )
        result = analyze_table(db, "uniform")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        assert len(outlier_issues) == 0

    def test_no_outliers_few_rows(self, tmp_path: object) -> None:
        """Tables with fewer than 4 rows skip outlier detection."""
        db = _db_path(tmp_path)
        _create_table(
            db,
            "tiny",
            'CREATE TABLE "tiny" (id INTEGER, val DOUBLE)',
            [
                "INSERT INTO tiny VALUES (1, 10.0)",
                "INSERT INTO tiny VALUES (2, 1000.0)",
                "INSERT INTO tiny VALUES (3, 10.0)",
            ],
        )
        result = analyze_table(db, "tiny")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        assert len(outlier_issues) == 0

    def test_no_outliers_constant_column(self, tmp_path: object) -> None:
        """A column with all identical values (IQR=0) should not report outliers."""
        db = _db_path(tmp_path)
        inserts = [
            f"INSERT INTO constant VALUES ({i}, 42.0)"
            for i in range(10)
        ]
        _create_table(
            db,
            "constant",
            'CREATE TABLE "constant" (id INTEGER, val DOUBLE)',
            inserts,
        )
        result = analyze_table(db, "constant")
        outlier_issues = [
            i for i in result["issues"] if i["type"] == "outliers"
        ]
        assert len(outlier_issues) == 0


# ---------------------------------------------------------------------------
# analyze_table — empty table
# ---------------------------------------------------------------------------


class TestEmptyTable:
    def test_empty_table_perfect_score(self, tmp_path: object) -> None:
        db = _create_empty_table(tmp_path)
        result = analyze_table(db, "empty")
        assert result["quality_score"] == 100

    def test_empty_table_no_issues(self, tmp_path: object) -> None:
        db = _create_empty_table(tmp_path)
        result = analyze_table(db, "empty")
        assert result["issues"] == []

    def test_empty_table_zero_rows(self, tmp_path: object) -> None:
        db = _create_empty_table(tmp_path)
        result = analyze_table(db, "empty")
        assert result["row_count"] == 0
        assert result["column_count"] == 2


# ---------------------------------------------------------------------------
# analyze_table — error cases
# ---------------------------------------------------------------------------


class TestErrors:
    def test_db_not_found(self) -> None:
        with pytest.raises(ValueError, match="Database file not found"):
            analyze_table("/nonexistent/path.db", "t")

    def test_table_not_found(self, tmp_path: object) -> None:
        db = _db_path(tmp_path)
        conn = duckdb.connect(db)
        conn.close()
        with pytest.raises(ValueError, match="Table not found"):
            analyze_table(db, "nonexistent")


# ---------------------------------------------------------------------------
# analyze_table — score clamping
# ---------------------------------------------------------------------------


class TestScoreClamping:
    def test_score_never_below_zero(self, tmp_path: object) -> None:
        """A table with many issues should still score >= 0."""
        db = _db_path(tmp_path)
        # Create a table with lots of nulls and duplicates
        inserts = []
        for i in range(20):
            inserts.append("INSERT INTO bad VALUES (1, NULL, NULL)")
        _create_table(
            db,
            "bad",
            'CREATE TABLE "bad" (id INTEGER, a VARCHAR, b DOUBLE)',
            inserts,
        )
        result = analyze_table(db, "bad")
        assert result["quality_score"] >= 0

    def test_score_never_above_100(self, tmp_path: object) -> None:
        db = _create_clean_table(tmp_path)
        result = analyze_table(db, "clean")
        assert result["quality_score"] <= 100


# ---------------------------------------------------------------------------
# analyze_table — combined issues
# ---------------------------------------------------------------------------


class TestCombinedIssues:
    def test_multiple_issue_types(self, tmp_path: object) -> None:
        """A table with nulls, duplicates, and outliers."""
        db = _db_path(tmp_path)
        _create_table(
            db,
            "mixed",
            'CREATE TABLE "mixed" (id INTEGER, val DOUBLE)',
            [
                "INSERT INTO mixed VALUES (1, 50.0)",
                "INSERT INTO mixed VALUES (1, 50.0)",  # duplicate
                "INSERT INTO mixed VALUES (2, 52.0)",
                "INSERT INTO mixed VALUES (3, NULL)",  # null
                "INSERT INTO mixed VALUES (4, 55.0)",
                "INSERT INTO mixed VALUES (5, 58.0)",
                "INSERT INTO mixed VALUES (6, 51.0)",
                "INSERT INTO mixed VALUES (7, 53.0)",
                "INSERT INTO mixed VALUES (8, 500.0)",  # outlier
                "INSERT INTO mixed VALUES (NULL, 54.0)",  # null in id
            ],
        )
        result = analyze_table(db, "mixed")

        issue_types = {i["type"] for i in result["issues"]}
        assert "nulls" in issue_types
        assert "duplicates" in issue_types
        assert "outliers" in issue_types
        assert result["quality_score"] < 100
