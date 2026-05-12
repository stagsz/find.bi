"""API tests for the scheduler endpoints.

Follows the same pattern as test_data_sources_api.py:
  - in-memory SQLite for the metadata DB
  - monkeypatched scheduler singleton via services.scheduler_service._scheduler
"""

from __future__ import annotations

import uuid
from collections.abc import Generator

import pytest
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import services.scheduler_service as svc
from db import get_db
from main import app
from models.base import Base

# ---------------------------------------------------------------------------
# Test database setup
# ---------------------------------------------------------------------------

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def _override_db() -> Generator[None, None, None]:
    """Replace get_db with in-memory SQLite; reset tables each test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    def override() -> Generator[Session, None, None]:
        session = TestSession()
        try:
            yield session
        finally:
            session.rollback()
            session.close()

    app.dependency_overrides[get_db] = override
    yield
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _fresh_scheduler(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    """Patch module-level scheduler with a fresh started instance per test."""
    s = BackgroundScheduler()
    s.start()
    monkeypatch.setattr(svc, "_scheduler", s)
    yield
    s.shutdown(wait=False)
    monkeypatch.setattr(svc, "_scheduler", None)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _register_and_login(client: TestClient, email: str = "sched@test.com") -> str:
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "pass1234", "display_name": "Tester"},
    )
    resp = client.post(
        "/api/auth/login", json={"email": email, "password": "pass1234"},
    )
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_workspace_id(client: TestClient, token: str) -> str:
    resp = client.get("/api/workspaces/", headers=_auth(token))
    return resp.json()[0]["id"]


# ---------------------------------------------------------------------------
# POST /api/scheduler/{workspace_id}/jobs
# ---------------------------------------------------------------------------


def test_create_job_success(client: TestClient) -> None:
    """Creates a job and returns 201 with job details."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        f"/api/scheduler/{ws_id}/jobs",
        json={"table_name": "sales", "cron_expr": "0 9 * * *"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "job_id" in data
    assert data["table_name"] == "sales"
    assert data["cron_expr"] == "0 9 * * *"


def test_create_job_invalid_cron(client: TestClient) -> None:
    """Returns 400 for an invalid cron expression."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        f"/api/scheduler/{ws_id}/jobs",
        json={"table_name": "sales", "cron_expr": "bad cron"},
        headers=_auth(token),
    )
    assert resp.status_code == 400


def test_create_job_workspace_not_found(client: TestClient) -> None:
    """Returns 404 for a non-existent workspace."""
    token = _register_and_login(client)
    fake_id = str(uuid.uuid4())

    resp = client.post(
        f"/api/scheduler/{fake_id}/jobs",
        json={"table_name": "sales", "cron_expr": "0 9 * * *"},
        headers=_auth(token),
    )
    assert resp.status_code == 404


def test_create_job_no_auth(client: TestClient) -> None:
    """Returns 422 when no Authorization header is provided."""
    resp = client.post(
        "/api/scheduler/some-id/jobs",
        json={"table_name": "sales", "cron_expr": "0 9 * * *"},
    )
    assert resp.status_code == 422


def test_create_job_other_users_workspace(client: TestClient) -> None:
    """Cannot schedule a job in another user's workspace."""
    token_a = _register_and_login(client, "owner@sched.test")
    ws_id = _get_workspace_id(client, token_a)
    token_b = _register_and_login(client, "intruder@sched.test")

    resp = client.post(
        f"/api/scheduler/{ws_id}/jobs",
        json={"table_name": "sales", "cron_expr": "0 9 * * *"},
        headers=_auth(token_b),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/scheduler/{workspace_id}/jobs
# ---------------------------------------------------------------------------


def test_list_jobs_empty(client: TestClient) -> None:
    """Returns empty list when no jobs exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.get(f"/api/scheduler/{ws_id}/jobs", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_jobs_after_create(client: TestClient) -> None:
    """Created job appears in list."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    client.post(
        f"/api/scheduler/{ws_id}/jobs",
        json={"table_name": "revenue", "cron_expr": "0 6 * * *"},
        headers=_auth(token),
    )
    resp = client.get(f"/api/scheduler/{ws_id}/jobs", headers=_auth(token))
    assert resp.status_code == 200
    jobs = resp.json()
    assert len(jobs) == 1
    assert "revenue" in jobs[0]["job_id"]


def test_list_jobs_workspace_not_found(client: TestClient) -> None:
    """Returns 404 for non-existent workspace."""
    token = _register_and_login(client)
    fake_id = str(uuid.uuid4())

    resp = client.get(f"/api/scheduler/{fake_id}/jobs", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/scheduler/{workspace_id}/jobs/{job_id}
# ---------------------------------------------------------------------------


def test_delete_job_success(client: TestClient) -> None:
    """Returns 204 and job is gone."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/scheduler/{ws_id}/jobs",
        json={"table_name": "orders", "cron_expr": "0 0 * * *"},
        headers=_auth(token),
    )
    job_id = create_resp.json()["job_id"]

    del_resp = client.delete(
        f"/api/scheduler/{ws_id}/jobs/{job_id}", headers=_auth(token),
    )
    assert del_resp.status_code == 204

    list_resp = client.get(f"/api/scheduler/{ws_id}/jobs", headers=_auth(token))
    assert list_resp.json() == []


def test_delete_job_not_found(client: TestClient) -> None:
    """Returns 404 when job does not exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.delete(
        f"/api/scheduler/{ws_id}/jobs/nonexistent-job-id",
        headers=_auth(token),
    )
    assert resp.status_code == 404


def test_delete_job_workspace_not_found(client: TestClient) -> None:
    """Returns 404 when workspace does not exist."""
    token = _register_and_login(client)
    fake_ws_id = str(uuid.uuid4())

    resp = client.delete(
        f"/api/scheduler/{fake_ws_id}/jobs/some-job",
        headers=_auth(token),
    )
    assert resp.status_code == 404
