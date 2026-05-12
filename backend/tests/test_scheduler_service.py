"""Unit tests for scheduler_service.

Each test creates a fresh BackgroundScheduler (not the module singleton) so
tests are fully isolated from each other and from production state.
"""

from __future__ import annotations

import pytest
from apscheduler.schedulers.background import BackgroundScheduler

import services.scheduler_service as svc


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fresh_scheduler() -> BackgroundScheduler:
    """Return a started BackgroundScheduler for use in a single test."""
    s = BackgroundScheduler()
    s.start()
    return s


def _patch_scheduler(monkeypatch: pytest.MonkeyPatch) -> BackgroundScheduler:
    """Swap the module-level singleton with a fresh started scheduler."""
    s = _fresh_scheduler()
    monkeypatch.setattr(svc, "_scheduler", s)
    return s


# ---------------------------------------------------------------------------
# parse_cron
# ---------------------------------------------------------------------------


def test_parse_cron_valid_all_stars() -> None:
    """'* * * * *' parses to all-star fields."""
    result = svc.parse_cron("* * * * *")
    assert result == {
        "minute": "*",
        "hour": "*",
        "day": "*",
        "month": "*",
        "day_of_week": "*",
    }


def test_parse_cron_valid_specific_values() -> None:
    """Specific values are parsed into the correct keys."""
    result = svc.parse_cron("0 9 1 6 1")
    assert result["minute"] == "0"
    assert result["hour"] == "9"
    assert result["day"] == "1"
    assert result["month"] == "6"
    assert result["day_of_week"] == "1"


def test_parse_cron_valid_complex_expression() -> None:
    """Ranges and steps pass through unchanged."""
    result = svc.parse_cron("*/15 8-18 * * 1-5")
    assert result["minute"] == "*/15"
    assert result["hour"] == "8-18"
    assert result["day_of_week"] == "1-5"


def test_parse_cron_too_few_fields() -> None:
    """Fewer than 5 fields raises ValueError."""
    with pytest.raises(ValueError, match="5 fields"):
        svc.parse_cron("0 9 * *")


def test_parse_cron_too_many_fields() -> None:
    """More than 5 fields raises ValueError."""
    with pytest.raises(ValueError, match="5 fields"):
        svc.parse_cron("0 9 * * * extra")


def test_parse_cron_empty_string() -> None:
    """Empty string raises ValueError."""
    with pytest.raises(ValueError):
        svc.parse_cron("")


# ---------------------------------------------------------------------------
# add_refresh_job
# ---------------------------------------------------------------------------


def test_add_refresh_job_returns_job_id(monkeypatch: pytest.MonkeyPatch) -> None:
    """add_refresh_job returns a non-empty job ID string."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-abc", "sales", "0 9 * * *")
        assert isinstance(job_id, str)
        assert len(job_id) > 0
    finally:
        s.shutdown(wait=False)


def test_add_refresh_job_id_contains_workspace_and_table(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Job ID encodes workspace_id and table_name."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-123", "revenue", "30 8 * * 1")
        assert "ws-123" in job_id
        assert "revenue" in job_id
    finally:
        s.shutdown(wait=False)


def test_add_refresh_job_invalid_cron_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """add_refresh_job propagates ValueError from parse_cron."""
    s = _patch_scheduler(monkeypatch)
    try:
        with pytest.raises(ValueError):
            svc.add_refresh_job("ws-1", "tbl", "bad cron expr here extra fields")
    finally:
        s.shutdown(wait=False)


def test_add_refresh_job_replace_existing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Adding a job with the same workspace+table replaces the old one."""
    s = _patch_scheduler(monkeypatch)
    try:
        id1 = svc.add_refresh_job("ws-1", "tbl", "0 9 * * *")
        id2 = svc.add_refresh_job("ws-1", "tbl", "0 10 * * *")
        assert id1 == id2
        # Only one job should exist for this id
        assert s.get_job(id1) is not None
    finally:
        s.shutdown(wait=False)


# ---------------------------------------------------------------------------
# remove_refresh_job
# ---------------------------------------------------------------------------


def test_remove_refresh_job_returns_true_when_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """remove_refresh_job returns True when job exists."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-rm", "tbl", "0 0 * * *")
        result = svc.remove_refresh_job(job_id)
        assert result is True
    finally:
        s.shutdown(wait=False)


def test_remove_refresh_job_returns_false_when_not_found(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """remove_refresh_job returns False for a non-existent job ID."""
    s = _patch_scheduler(monkeypatch)
    try:
        result = svc.remove_refresh_job("does-not-exist")
        assert result is False
    finally:
        s.shutdown(wait=False)


def test_remove_refresh_job_actually_removes(monkeypatch: pytest.MonkeyPatch) -> None:
    """After removal the job is no longer in the scheduler."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-gone", "tbl", "0 0 * * *")
        svc.remove_refresh_job(job_id)
        assert s.get_job(job_id) is None
    finally:
        s.shutdown(wait=False)


# ---------------------------------------------------------------------------
# list_jobs
# ---------------------------------------------------------------------------


def test_list_jobs_empty(monkeypatch: pytest.MonkeyPatch) -> None:
    """list_jobs returns empty list when no jobs are scheduled."""
    s = _patch_scheduler(monkeypatch)
    try:
        assert svc.list_jobs() == []
    finally:
        s.shutdown(wait=False)


def test_list_jobs_contains_added_job(monkeypatch: pytest.MonkeyPatch) -> None:
    """list_jobs includes a job after it is added."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-list", "sales", "0 6 * * *")
        jobs = svc.list_jobs()
        ids = [j["job_id"] for j in jobs]
        assert job_id in ids
    finally:
        s.shutdown(wait=False)


def test_list_jobs_response_shape(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each entry from list_jobs has the expected keys."""
    s = _patch_scheduler(monkeypatch)
    try:
        svc.add_refresh_job("ws-shape", "tbl", "0 12 * * *")
        jobs = svc.list_jobs()
        assert len(jobs) >= 1
        for j in jobs:
            assert "job_id" in j
            assert "name" in j
            assert "next_run_time" in j
    finally:
        s.shutdown(wait=False)


def test_list_jobs_excludes_removed_job(monkeypatch: pytest.MonkeyPatch) -> None:
    """list_jobs does not include a job that was removed."""
    s = _patch_scheduler(monkeypatch)
    try:
        job_id = svc.add_refresh_job("ws-excl", "tbl", "0 0 * * *")
        svc.remove_refresh_job(job_id)
        ids = [j["job_id"] for j in svc.list_jobs()]
        assert job_id not in ids
    finally:
        s.shutdown(wait=False)
