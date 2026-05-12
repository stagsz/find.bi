"""Tests for the webhook API endpoints.

Covers:
- POST /api/webhooks/{workspace_id}/configure
- GET  /api/webhooks/{workspace_id}/config
- POST /api/webhooks/{workspace_id}/ingest
"""

from collections.abc import Generator
from unittest.mock import MagicMock, patch

import bcrypt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from db import get_db
from main import app
from models.base import Base

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def _override_db() -> Generator[None, None, None]:
    """Override get_db with in-memory SQLite; reset tables each test."""
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


def _register_and_login(
    client: TestClient,
    email: str = "ralph@springfield.edu",
) -> str:
    """Register a user and return a JWT token."""
    client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "display_name": "Ralph Wiggum",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    return resp.json()["access_token"]


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_workspace(client: TestClient, token: str) -> tuple[str, str]:
    """Return (workspace_id, duckdb_path)."""
    resp = client.get("/api/workspaces/", headers=_auth_headers(token))
    ws = resp.json()[0]
    return ws["id"], ws["duckdb_path"]


# ---------------------------------------------------------------------------
# POST /configure
# ---------------------------------------------------------------------------


def test_configure_returns_api_key(client: TestClient) -> None:
    """Configure returns a one-time API key and the table name."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    resp = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "api_key" in data
    assert data["table_name"] == "events"
    assert data["workspace_id"] == ws_id
    # The API key must look non-trivial (token_urlsafe(32) → ~43 chars)
    assert len(data["api_key"]) > 20


def test_configure_replaces_existing(client: TestClient) -> None:
    """A second configure call replaces the previous config."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    first = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "old_table"},
        headers=_auth_headers(token),
    )
    first_key = first.json()["api_key"]

    second = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "new_table"},
        headers=_auth_headers(token),
    )
    assert second.status_code == 200
    second_key = second.json()["api_key"]

    # New key should be different
    assert second_key != first_key
    assert second.json()["table_name"] == "new_table"

    # Old key should no longer work for ingest (can't verify without db file,
    # but config endpoint should reflect the new table name)
    cfg = client.get(
        f"/api/webhooks/{ws_id}/config",
        headers=_auth_headers(token),
    )
    assert cfg.json()["table_name"] == "new_table"


def test_configure_404_wrong_workspace(client: TestClient) -> None:
    """404 when workspace_id belongs to another user."""
    token_a = _register_and_login(client, "alice@example.com")
    ws_id_a, _ = _get_workspace(client, token_a)

    token_b = _register_and_login(client, "bob@example.com")

    resp = client.post(
        f"/api/webhooks/{ws_id_a}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


def test_configure_404_nonexistent_workspace(client: TestClient) -> None:
    """404 when workspace does not exist at all."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/webhooks/00000000-0000-0000-0000-000000000000/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_configure_requires_auth(client: TestClient) -> None:
    """Reject configure without JWT."""
    resp = client.post(
        "/api/webhooks/00000000-0000-0000-0000-000000000000/configure",
        json={"table_name": "events"},
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /config
# ---------------------------------------------------------------------------


def test_get_config_no_webhook(client: TestClient) -> None:
    """has_config is false when no webhook has been configured."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    resp = client.get(
        f"/api/webhooks/{ws_id}/config",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_config"] is False
    assert data["table_name"] is None
    assert data["workspace_id"] == ws_id


def test_get_config_with_webhook(client: TestClient) -> None:
    """has_config is true after configure."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "metrics"},
        headers=_auth_headers(token),
    )

    resp = client.get(
        f"/api/webhooks/{ws_id}/config",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_config"] is True
    assert data["table_name"] == "metrics"
    # api_key must never appear in the response
    assert "api_key" not in data
    assert "api_key_hash" not in data


def test_get_config_404_wrong_workspace(client: TestClient) -> None:
    """404 when workspace belongs to another user."""
    token_a = _register_and_login(client, "alice@example.com")
    ws_id_a, _ = _get_workspace(client, token_a)

    token_b = _register_and_login(client, "bob@example.com")

    resp = client.get(
        f"/api/webhooks/{ws_id_a}/config",
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /ingest
# ---------------------------------------------------------------------------


def test_ingest_dict_body(client: TestClient, tmp_path: object) -> None:
    """Ingest a single-record dict with the correct API key."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)

    cfg_resp = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )
    api_key = cfg_resp.json()["api_key"]

    with patch(
        "api.webhooks.ingest_from_records", return_value=1
    ) as mock_ingest:
        resp = client.post(
            f"/api/webhooks/{ws_id}/ingest",
            json={"event": "click", "user_id": "42"},
            headers={"X-Webhook-Key": api_key},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["ingested"] == 1
    assert data["table"] == "events"
    mock_ingest.assert_called_once()


def test_ingest_list_body(client: TestClient) -> None:
    """Ingest a list of records."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    cfg_resp = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "logs"},
        headers=_auth_headers(token),
    )
    api_key = cfg_resp.json()["api_key"]

    with patch(
        "api.webhooks.ingest_from_records", return_value=3
    ) as mock_ingest:
        resp = client.post(
            f"/api/webhooks/{ws_id}/ingest",
            json=[
                {"msg": "a"},
                {"msg": "b"},
                {"msg": "c"},
            ],
            headers={"X-Webhook-Key": api_key},
        )

    assert resp.status_code == 200
    assert resp.json()["ingested"] == 3
    mock_ingest.assert_called_once()


def test_ingest_wrong_key(client: TestClient) -> None:
    """401 when the webhook key is incorrect."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )

    resp = client.post(
        f"/api/webhooks/{ws_id}/ingest",
        json={"x": 1},
        headers={"X-Webhook-Key": "totally-wrong-key"},
    )
    assert resp.status_code == 401


def test_ingest_no_key(client: TestClient) -> None:
    """401 when X-Webhook-Key header is missing."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )

    resp = client.post(
        f"/api/webhooks/{ws_id}/ingest",
        json={"x": 1},
    )
    assert resp.status_code == 401


def test_ingest_no_config(client: TestClient) -> None:
    """401 when no webhook is configured for the workspace."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    resp = client.post(
        f"/api/webhooks/{ws_id}/ingest",
        json={"x": 1},
        headers={"X-Webhook-Key": "some-key"},
    )
    assert resp.status_code == 401


def test_ingest_workspace_not_found(client: TestClient) -> None:
    """404 when the workspace does not exist."""
    resp = client.post(
        "/api/webhooks/00000000-0000-0000-0000-000000000000/ingest",
        json={"x": 1},
        headers={"X-Webhook-Key": "some-key"},
    )
    assert resp.status_code == 404


def test_ingest_empty_list(client: TestClient) -> None:
    """400 when body is an empty list."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    cfg_resp = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )
    api_key = cfg_resp.json()["api_key"]

    resp = client.post(
        f"/api/webhooks/{ws_id}/ingest",
        json=[],
        headers={"X-Webhook-Key": api_key},
    )
    assert resp.status_code == 400


def test_ingest_invalid_body_type(client: TestClient) -> None:
    """400 when body is a plain string (not dict/list)."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    cfg_resp = client.post(
        f"/api/webhooks/{ws_id}/configure",
        json={"table_name": "events"},
        headers=_auth_headers(token),
    )
    api_key = cfg_resp.json()["api_key"]

    resp = client.post(
        f"/api/webhooks/{ws_id}/ingest",
        content=b'"just a string"',
        headers={
            "X-Webhook-Key": api_key,
            "Content-Type": "application/json",
        },
    )
    assert resp.status_code == 400
