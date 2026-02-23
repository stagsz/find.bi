"""Tests for dashboard API routes.

Covers GET, POST, GET/:id, PUT/:id, DELETE/:id for /api/dashboards.
"""

from collections.abc import Generator

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


# --- Helpers ---


def _register_and_login(
    client: TestClient, email: str = "ralph@springfield.edu",
) -> str:
    """Register a user and return JWT token."""
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
    token: str = resp.json()["access_token"]
    return token


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_workspace_id(client: TestClient, token: str) -> str:
    """Get the default workspace ID for the authenticated user."""
    resp = client.get("/api/workspaces/", headers=_auth_headers(token))
    ws_id: str = resp.json()[0]["id"]
    return ws_id


def _create_dashboard(
    client: TestClient,
    token: str,
    workspace_id: str,
    name: str = "Sales Dashboard",
) -> dict:
    """Create a dashboard and return the response body."""
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": workspace_id, "name": name},
        headers=_auth_headers(token),
    )
    data: dict = resp.json()
    return data


# --- POST /api/dashboards/ ---


def test_create_dashboard_success(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": ws_id, "name": "Revenue Report"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Revenue Report"
    assert data["workspace_id"] == ws_id
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["layout_json"] == {}
    assert data["cards_json"] == {}
    assert data["filters_json"] == {}


def test_create_dashboard_with_json_data(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    layout = {"items": [{"i": "c1", "x": 0, "y": 0, "w": 4, "h": 3}]}
    cards = {"cards": [{"id": "c1", "type": "bar"}]}
    filters = {"filters": [{"id": "f1", "type": "search"}]}
    resp = client.post(
        "/api/dashboards/",
        json={
            "workspace_id": ws_id,
            "name": "Full Dashboard",
            "layout_json": layout,
            "cards_json": cards,
            "filters_json": filters,
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["layout_json"] == layout
    assert data["cards_json"] == cards
    assert data["filters_json"] == filters


def test_create_dashboard_strips_whitespace(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": ws_id, "name": "  Trimmed  "},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["name"] == "Trimmed"


def test_create_dashboard_empty_name(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": ws_id, "name": "   "},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_create_dashboard_workspace_not_found(client: TestClient) -> None:
    token = _register_and_login(client)
    resp = client.post(
        "/api/dashboards/",
        json={
            "workspace_id": "00000000-0000-0000-0000-000000000000",
            "name": "Test",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_create_dashboard_other_users_workspace(client: TestClient) -> None:
    token_a = _register_and_login(client, "owner@example.com")
    token_b = _register_and_login(client, "intruder@example.com")
    ws_id = _get_workspace_id(client, token_a)
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": ws_id, "name": "Sneaky Dashboard"},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


def test_create_dashboard_no_auth(client: TestClient) -> None:
    resp = client.post(
        "/api/dashboards/",
        json={"workspace_id": "some-id", "name": "Test"},
    )
    assert resp.status_code == 422


# --- GET /api/dashboards/ ---


def test_list_dashboards_empty(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    resp = client.get(
        f"/api/dashboards/?workspace_id={ws_id}",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_dashboards_returns_created(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    _create_dashboard(client, token, ws_id, "Dashboard A")
    _create_dashboard(client, token, ws_id, "Dashboard B")
    resp = client.get(
        f"/api/dashboards/?workspace_id={ws_id}",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    names = [d["name"] for d in data]
    assert "Dashboard A" in names
    assert "Dashboard B" in names


def test_list_dashboards_scoped_to_workspace(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    # Create a second workspace
    ws2_resp = client.post(
        "/api/workspaces/",
        json={"name": "Second WS"},
        headers=_auth_headers(token),
    )
    ws2_id = ws2_resp.json()["id"]
    _create_dashboard(client, token, ws_id, "WS1 Dash")
    _create_dashboard(client, token, ws2_id, "WS2 Dash")

    resp1 = client.get(
        f"/api/dashboards/?workspace_id={ws_id}",
        headers=_auth_headers(token),
    )
    resp2 = client.get(
        f"/api/dashboards/?workspace_id={ws2_id}",
        headers=_auth_headers(token),
    )
    assert len(resp1.json()) == 1
    assert resp1.json()[0]["name"] == "WS1 Dash"
    assert len(resp2.json()) == 1
    assert resp2.json()[0]["name"] == "WS2 Dash"


def test_list_dashboards_other_users_workspace(client: TestClient) -> None:
    token_a = _register_and_login(client, "owner@example.com")
    token_b = _register_and_login(client, "intruder@example.com")
    ws_id = _get_workspace_id(client, token_a)
    resp = client.get(
        f"/api/dashboards/?workspace_id={ws_id}",
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


def test_list_dashboards_no_auth(client: TestClient) -> None:
    resp = client.get("/api/dashboards/?workspace_id=some-id")
    assert resp.status_code == 422


# --- GET /api/dashboards/:id ---


def test_get_dashboard_success(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id, "My Dashboard")
    resp = client.get(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == created["id"]
    assert data["name"] == "My Dashboard"


def test_get_dashboard_not_found(client: TestClient) -> None:
    token = _register_and_login(client)
    resp = client.get(
        "/api/dashboards/00000000-0000-0000-0000-000000000000",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_get_dashboard_other_user(client: TestClient) -> None:
    token_a = _register_and_login(client, "owner@example.com")
    token_b = _register_and_login(client, "intruder@example.com")
    ws_id = _get_workspace_id(client, token_a)
    created = _create_dashboard(client, token_a, ws_id)
    resp = client.get(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


# --- PUT /api/dashboards/:id ---


def test_update_dashboard_name(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id, "Old Name")
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"name": "New Name"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


def test_update_dashboard_layout(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id)
    new_layout = {"items": [{"i": "c1", "x": 0, "y": 0, "w": 6, "h": 4}]}
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"layout_json": new_layout},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.json()["layout_json"] == new_layout


def test_update_dashboard_cards_and_filters(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id)
    new_cards = {"cards": [{"id": "c1", "type": "line"}]}
    new_filters = {"filters": [{"id": "f1", "type": "search"}]}
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"cards_json": new_cards, "filters_json": new_filters},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cards_json"] == new_cards
    assert data["filters_json"] == new_filters


def test_update_dashboard_partial_preserves_others(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id, "Original")
    # Update only name — layout/cards/filters should remain unchanged
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"name": "Updated"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated"
    assert data["layout_json"] == created["layout_json"]
    assert data["cards_json"] == created["cards_json"]
    assert data["filters_json"] == created["filters_json"]


def test_update_dashboard_empty_name(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id)
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"name": "   "},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_update_dashboard_not_found(client: TestClient) -> None:
    token = _register_and_login(client)
    resp = client.put(
        "/api/dashboards/00000000-0000-0000-0000-000000000000",
        json={"name": "Test"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_update_dashboard_other_user(client: TestClient) -> None:
    token_a = _register_and_login(client, "owner@example.com")
    token_b = _register_and_login(client, "intruder@example.com")
    ws_id = _get_workspace_id(client, token_a)
    created = _create_dashboard(client, token_a, ws_id)
    resp = client.put(
        f"/api/dashboards/{created['id']}",
        json={"name": "Hijacked"},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404


# --- DELETE /api/dashboards/:id ---


def test_delete_dashboard_success(client: TestClient) -> None:
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    created = _create_dashboard(client, token, ws_id)
    resp = client.delete(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 204
    # Verify it's gone
    get_resp = client.get(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token),
    )
    assert get_resp.status_code == 404


def test_delete_dashboard_not_found(client: TestClient) -> None:
    token = _register_and_login(client)
    resp = client.delete(
        "/api/dashboards/00000000-0000-0000-0000-000000000000",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_delete_dashboard_other_user(client: TestClient) -> None:
    token_a = _register_and_login(client, "owner@example.com")
    token_b = _register_and_login(client, "intruder@example.com")
    ws_id = _get_workspace_id(client, token_a)
    created = _create_dashboard(client, token_a, ws_id)
    resp = client.delete(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404
    # Verify it still exists for user A
    get_resp = client.get(
        f"/api/dashboards/{created['id']}",
        headers=_auth_headers(token_a),
    )
    assert get_resp.status_code == 200


def test_delete_dashboard_no_auth(client: TestClient) -> None:
    resp = client.delete("/api/dashboards/some-id")
    assert resp.status_code == 422


def test_delete_dashboard_invalid_token(client: TestClient) -> None:
    resp = client.delete(
        "/api/dashboards/some-id",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401
