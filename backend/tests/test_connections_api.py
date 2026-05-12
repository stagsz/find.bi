"""Tests for the external connections API routes.

Covers POST /{workspace_id}/test, GET /{workspace_id},
POST /{workspace_id}, DELETE /{workspace_id}/{connection_id},
and POST /{workspace_id}/{connection_id}/tables.
"""

from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

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
    """Override get_db with an in-memory SQLite; reset tables each test."""
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
# Auth helpers
# ---------------------------------------------------------------------------


def _register_and_login(
    client: TestClient,
    email: str = "ralph@springfield.edu",
) -> str:
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


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_workspace_id(client: TestClient, token: str) -> str:
    resp = client.get("/api/workspaces/", headers=_auth(token))
    return resp.json()[0]["id"]


# ---------------------------------------------------------------------------
# POST /{workspace_id}/test
# ---------------------------------------------------------------------------


def test_test_connection_success(client: TestClient) -> None:
    """Returns 200 with success=True on successful test."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    with patch(
        "api.connections.connection_service.test_connection",
        return_value={"success": True, "error": None, "tables": ["users"]},
    ):
        resp = client.post(
            f"/api/connections/{ws_id}/test",
            json={"conn_type": "postgresql", "host": "localhost", "port": 5432,
                  "database": "mydb", "username": "admin", "password": "secret"},
            headers=_auth(token),
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["tables"] == ["users"]


def test_test_connection_workspace_not_found(client: TestClient) -> None:
    """404 when workspace does not belong to user."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/connections/00000000-0000-0000-0000-000000000000/test",
        json={"conn_type": "postgresql", "database": "x"},
        headers=_auth(token),
    )
    assert resp.status_code == 404


def test_test_connection_failure_result(client: TestClient) -> None:
    """Returns 200 with success=False on connection error (service handles exc)."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    with patch(
        "api.connections.connection_service.test_connection",
        return_value={"success": False, "error": "refused", "tables": []},
    ):
        resp = client.post(
            f"/api/connections/{ws_id}/test",
            json={"conn_type": "postgresql", "database": "mydb"},
            headers=_auth(token),
        )

    assert resp.status_code == 200
    assert resp.json()["success"] is False


# ---------------------------------------------------------------------------
# GET /{workspace_id}
# ---------------------------------------------------------------------------


def test_list_connections_empty(client: TestClient) -> None:
    """Returns empty list when no connections exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.get(f"/api/connections/{ws_id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_connections_after_create(client: TestClient) -> None:
    """Lists created connections."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    with patch(
        "api.connections.connection_service.test_connection",
        return_value={"success": True, "error": None, "tables": []},
    ):
        client.post(
            f"/api/connections/{ws_id}",
            json={"name": "Prod", "conn_type": "postgresql",
                  "host": "localhost", "port": 5432, "database": "proddb",
                  "username": "admin", "password": "s3cr3t"},
            headers=_auth(token),
        )

    resp = client.get(f"/api/connections/{ws_id}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Prod"
    assert "password" not in data[0]  # password must not be exposed


def test_list_connections_workspace_not_found(client: TestClient) -> None:
    """404 when workspace does not belong to user."""
    token = _register_and_login(client)
    resp = client.get(
        "/api/connections/00000000-0000-0000-0000-000000000000",
        headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /{workspace_id}
# ---------------------------------------------------------------------------


def test_create_connection_success(client: TestClient) -> None:
    """Returns 201 with connection metadata (no password)."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        f"/api/connections/{ws_id}",
        json={"name": "Analytics DB", "conn_type": "mysql",
              "host": "db.example.com", "port": 3306,
              "database": "analytics", "username": "reader", "password": "pw"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Analytics DB"
    assert body["conn_type"] == "mysql"
    assert "id" in body
    assert "password" not in body


def test_create_connection_workspace_not_found(client: TestClient) -> None:
    """404 when workspace not owned by user."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/connections/00000000-0000-0000-0000-000000000000",
        json={"name": "X", "conn_type": "sqlite", "database": "/tmp/x.db"},
        headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /{workspace_id}/{connection_id}
# ---------------------------------------------------------------------------


def test_delete_connection_success(client: TestClient) -> None:
    """Returns 204 after successful deletion."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/connections/{ws_id}",
        json={"name": "TempDB", "conn_type": "sqlite", "database": "/tmp/t.db"},
        headers=_auth(token),
    )
    conn_id = create_resp.json()["id"]

    resp = client.delete(
        f"/api/connections/{ws_id}/{conn_id}",
        headers=_auth(token),
    )
    assert resp.status_code == 204

    # Should no longer appear in list
    list_resp = client.get(f"/api/connections/{ws_id}", headers=_auth(token))
    assert list_resp.json() == []


def test_delete_connection_not_found(client: TestClient) -> None:
    """404 when connection does not exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.delete(
        f"/api/connections/{ws_id}/00000000-0000-0000-0000-000000000000",
        headers=_auth(token),
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /{workspace_id}/{connection_id}/tables
# ---------------------------------------------------------------------------


def test_tables_from_saved_connection_success(client: TestClient) -> None:
    """Returns table list from a saved connection."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/connections/{ws_id}",
        json={"name": "MyDB", "conn_type": "postgresql",
              "host": "localhost", "port": 5432, "database": "testdb",
              "username": "alice", "password": "pw"},
        headers=_auth(token),
    )
    conn_id = create_resp.json()["id"]

    with patch(
        "api.connections.connection_service.list_external_tables",
        return_value=["alpha", "beta"],
    ):
        resp = client.post(
            f"/api/connections/{ws_id}/{conn_id}/tables",
            headers=_auth(token),
        )

    assert resp.status_code == 200
    assert resp.json()["tables"] == ["alpha", "beta"]


def test_tables_from_saved_connection_failure(client: TestClient) -> None:
    """400 when the connection test fails."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    create_resp = client.post(
        f"/api/connections/{ws_id}",
        json={"name": "BadDB", "conn_type": "postgresql",
              "host": "dead-host", "port": 5432, "database": "db",
              "username": "u", "password": "p"},
        headers=_auth(token),
    )
    conn_id = create_resp.json()["id"]

    with patch(
        "api.connections.connection_service.list_external_tables",
        side_effect=ValueError("connection refused"),
    ):
        resp = client.post(
            f"/api/connections/{ws_id}/{conn_id}/tables",
            headers=_auth(token),
        )

    assert resp.status_code == 400
    assert "refused" in resp.json()["detail"]


def test_tables_connection_not_found(client: TestClient) -> None:
    """404 when saved connection ID doesn't exist."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        f"/api/connections/{ws_id}/00000000-0000-0000-0000-000000000000/tables",
        headers=_auth(token),
    )
    assert resp.status_code == 404
