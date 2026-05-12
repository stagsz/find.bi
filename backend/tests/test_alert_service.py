"""Unit tests for alert_service.evaluate_alert.

Tests run against real DuckDB tmp files — no mocking of DuckDB.
"""

from __future__ import annotations

import os
import uuid

import duckdb
import pytest

from models.alert import Alert
from services import alert_service


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_db(tmp_path: object, table_sql: str) -> str:
    """Create a DuckDB file in tmp_path, run table_sql, return its path."""
    db_path = os.path.join(str(tmp_path), f"{uuid.uuid4()}.duckdb")
    conn = duckdb.connect(db_path)
    conn.execute(table_sql)
    conn.close()
    return db_path


def _make_alert(**kwargs) -> Alert:
    """Build an in-memory Alert object (not persisted)."""
    defaults = dict(
        id=uuid.uuid4(),
        workspace_id=uuid.uuid4(),
        name="test alert",
        sql_query="SELECT 1",
        condition="gt",
        threshold=0.0,
        channel="browser",
        webhook_url=None,
        email=None,
        is_active=True,
        last_triggered_at=None,
        last_value=None,
    )
    defaults.update(kwargs)
    alert = Alert.__new__(Alert)
    for k, v in defaults.items():
        setattr(alert, k, v)
    return alert


class _FakeSession:
    """Minimal session stub that records commit calls."""

    committed = False

    def commit(self) -> None:
        self.committed = True


# ---------------------------------------------------------------------------
# Condition: gt
# ---------------------------------------------------------------------------


def test_evaluate_alert_gt_triggered(tmp_path: object) -> None:
    """Alert with condition 'gt' fires when value > threshold."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 10 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gt", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is True
    assert result["value"] == pytest.approx(10.0)
    assert result["error"] is None
    assert session.committed is True


def test_evaluate_alert_gt_not_triggered(tmp_path: object) -> None:
    """Alert with condition 'gt' does not fire when value <= threshold."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 3 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gt", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is False
    assert session.committed is False


# ---------------------------------------------------------------------------
# Condition: lt
# ---------------------------------------------------------------------------


def test_evaluate_alert_lt_triggered(tmp_path: object) -> None:
    """Alert with condition 'lt' fires when value < threshold."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 2 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="lt", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is True


def test_evaluate_alert_lt_not_triggered(tmp_path: object) -> None:
    """Alert with condition 'lt' does not fire when value >= threshold."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 7 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="lt", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is False


# ---------------------------------------------------------------------------
# Condition: eq
# ---------------------------------------------------------------------------


def test_evaluate_alert_eq_triggered(tmp_path: object) -> None:
    """Alert with condition 'eq' fires when value == threshold."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 5 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="eq", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is True


# ---------------------------------------------------------------------------
# Condition: gte / lte
# ---------------------------------------------------------------------------


def test_evaluate_alert_gte_boundary(tmp_path: object) -> None:
    """Alert with condition 'gte' fires when value == threshold (boundary)."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 5 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gte", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is True


def test_evaluate_alert_lte_boundary(tmp_path: object) -> None:
    """Alert with condition 'lte' fires when value == threshold (boundary)."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 5 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="lte", threshold=5.0)
    session = _FakeSession()

    result = alert_service.evaluate_alert(db_path, alert, session)
    assert result["triggered"] is True


# ---------------------------------------------------------------------------
# Validation guards
# ---------------------------------------------------------------------------


def test_evaluate_alert_non_select_rejected(tmp_path: object) -> None:
    """Non-SELECT queries raise ValueError."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 1 AS v")
    alert = _make_alert(sql_query="DROP TABLE t", condition="gt", threshold=0.0)
    session = _FakeSession()

    with pytest.raises(ValueError, match="SELECT"):
        alert_service.evaluate_alert(db_path, alert, session)


def test_evaluate_alert_no_rows_raises(tmp_path: object) -> None:
    """Queries returning no rows raise ValueError."""
    db_path = _make_db(tmp_path, "CREATE TABLE t (v INTEGER)")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gt", threshold=0.0)
    session = _FakeSession()

    with pytest.raises(ValueError, match="no rows"):
        alert_service.evaluate_alert(db_path, alert, session)


def test_evaluate_alert_non_numeric_raises(tmp_path: object) -> None:
    """Queries returning a non-numeric first value raise ValueError."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 'hello' AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gt", threshold=0.0)
    session = _FakeSession()

    with pytest.raises(ValueError, match="not numeric"):
        alert_service.evaluate_alert(db_path, alert, session)


# ---------------------------------------------------------------------------
# last_value and last_triggered_at persistence
# ---------------------------------------------------------------------------


def test_evaluate_alert_updates_last_value(tmp_path: object) -> None:
    """Triggering an alert updates last_value and last_triggered_at on the model."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 42 AS v")
    alert = _make_alert(sql_query="SELECT v FROM t", condition="gt", threshold=0.0)
    session = _FakeSession()

    alert_service.evaluate_alert(db_path, alert, session)
    assert alert.last_value == pytest.approx(42.0)
    assert alert.last_triggered_at is not None


def test_evaluate_alert_does_not_update_last_value_when_not_triggered(
    tmp_path: object,
) -> None:
    """Non-triggering evaluation leaves last_value unchanged."""
    db_path = _make_db(tmp_path, "CREATE TABLE t AS SELECT 1 AS v")
    alert = _make_alert(
        sql_query="SELECT v FROM t",
        condition="gt",
        threshold=100.0,
        last_value=None,
    )
    session = _FakeSession()

    alert_service.evaluate_alert(db_path, alert, session)
    assert alert.last_value is None
    assert alert.last_triggered_at is None
