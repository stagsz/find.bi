"""API tests for the alerts endpoints.

Uses in-memory SQLite for the metadata DB and mocks alert_service.evaluate_alert
for the /evaluate endpoint.
"""

from __future__ import annotations

import uuid
from collections.abc import Generator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _register_and_login(client: TestClient, email: str = "alert@test.com") -> str:
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


_ALERT_BODY = {
    "name": "High Revenue Alert",
    "sql_query": "SELECT SUM(revenue) FROM sales",
    "condition": "gt",
    "threshold": 1000.0,
    "channel": "browser",
}


# ---------------------------------------------------------------------------
# GET /api/alerts/{workspace_id}
# ---------------------------------------------------------------------------


def test_list_alerts_empty(client: TestClient) -> None:
    """Empty list returned when no alerts exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.get(f"/api/alerts/{ws_id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_alerts_workspace_not_found(client: TestClient) -> None:
    """Returns 404 for non-existent workspace."""
    token = _register_and_login(client)
    fake_id = str(uuid.uuid4())

    resp = client.get(f"/api/alerts/{fake_id}", headers=_auth(token))
    assert resp.status_code == 404


def test_list_alerts_no_auth(client: TestClient) -> None:
    """Returns 422 when no auth header is present."""
    resp = client.get("/api/alerts/some-id")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/alerts/{workspace_id}
# ---------------------------------------------------------------------------


def test_create_alert_success(client: TestClient) -> None:
    """Creates alert and returns 201 with full alert payload."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        f"/api/alerts/{ws_id}",
        json=_ALERT_BODY,
        headers=_auth(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "High Revenue Alert"
    assert data["condition"] == "gt"
    assert data["threshold"] == pytest.approx(1000.0)
    assert data["channel"] == "browser"
    assert "id" in data


def test_create_alert_appears_in_list(client: TestClient) -> None:
    """Created alert is visible in the GET list."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    client.post(f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token))
    resp = client.get(f"/api/alerts/{ws_id}", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_create_alert_invalid_condition(client: TestClient) -> None:
    """Returns 400 for an unknown condition string."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    body = {**_ALERT_BODY, "condition": "not_an_op"}
    resp = client.post(f"/api/alerts/{ws_id}", json=body, headers=_auth(token))
    assert resp.status_code == 400


def test_create_alert_workspace_not_found(client: TestClient) -> None:
    """Returns 404 for non-existent workspace."""
    token = _register_and_login(client)
    fake_id = str(uuid.uuid4())

    resp = client.post(
        f"/api/alerts/{fake_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /api/alerts/{workspace_id}/{alert_id}
# ---------------------------------------------------------------------------


def test_update_alert_success(client: TestClient) -> None:
    """Updates alert fields and returns updated payload."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    alert_id = create_resp.json()["id"]

    updated_body = {**_ALERT_BODY, "name": "Renamed Alert", "threshold": 2000.0}
    resp = client.put(
        f"/api/alerts/{ws_id}/{alert_id}", json=updated_body, headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Renamed Alert"
    assert data["threshold"] == pytest.approx(2000.0)


def test_update_alert_not_found(client: TestClient) -> None:
    """Returns 404 when alert does not exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    fake_alert_id = str(uuid.uuid4())

    resp = client.put(
        f"/api/alerts/{ws_id}/{fake_alert_id}",
        json=_ALERT_BODY,
        headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /api/alerts/{workspace_id}/{alert_id}
# ---------------------------------------------------------------------------


def test_delete_alert_success(client: TestClient) -> None:
    """Returns 204 and alert is gone from list."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    alert_id = create_resp.json()["id"]

    del_resp = client.delete(
        f"/api/alerts/{ws_id}/{alert_id}", headers=_auth(token),
    )
    assert del_resp.status_code == 204

    list_resp = client.get(f"/api/alerts/{ws_id}", headers=_auth(token))
    assert list_resp.json() == []


def test_delete_alert_not_found(client: TestClient) -> None:
    """Returns 404 when alert does not exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    fake_id = str(uuid.uuid4())

    resp = client.delete(f"/api/alerts/{ws_id}/{fake_id}", headers=_auth(token))
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/alerts/{workspace_id}/{alert_id}/evaluate
# ---------------------------------------------------------------------------


def test_evaluate_alert_triggered(client: TestClient) -> None:
    """Evaluate endpoint returns triggered=True when service says so."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    alert_id = create_resp.json()["id"]

    mock_result = {"triggered": True, "value": 1500.0, "error": None}
    with patch(
        "api.alerts.evaluate_alert", return_value=mock_result,
    ) as mock_eval:
        resp = client.post(
            f"/api/alerts/{ws_id}/{alert_id}/evaluate", headers=_auth(token),
        )
        assert mock_eval.called

    assert resp.status_code == 200
    data = resp.json()
    assert data["triggered"] is True
    assert data["value"] == pytest.approx(1500.0)
    assert data["error"] is None


def test_evaluate_alert_not_triggered(client: TestClient) -> None:
    """Evaluate endpoint returns triggered=False when service says so."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    alert_id = create_resp.json()["id"]

    mock_result = {"triggered": False, "value": 500.0, "error": None}
    with patch("api.alerts.evaluate_alert", return_value=mock_result):
        resp = client.post(
            f"/api/alerts/{ws_id}/{alert_id}/evaluate", headers=_auth(token),
        )

    assert resp.status_code == 200
    assert resp.json()["triggered"] is False


def test_evaluate_alert_not_found(client: TestClient) -> None:
    """Returns 404 when alert does not exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    fake_alert_id = str(uuid.uuid4())

    resp = client.post(
        f"/api/alerts/{ws_id}/{fake_alert_id}/evaluate", headers=_auth(token),
    )
    assert resp.status_code == 404


def test_evaluate_alert_service_error_returns_400(client: TestClient) -> None:
    """If evaluate_alert raises ValueError, the endpoint returns 400."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/alerts/{ws_id}", json=_ALERT_BODY, headers=_auth(token),
    )
    alert_id = create_resp.json()["id"]

    with patch(
        "api.alerts.evaluate_alert", side_effect=ValueError("Only SELECT queries"),
    ):
        resp = client.post(
            f"/api/alerts/{ws_id}/{alert_id}/evaluate", headers=_auth(token),
        )

    assert resp.status_code == 400
    assert "SELECT" in resp.json()["detail"]
