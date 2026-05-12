"""Tests for the export API router (backend/api/export.py).

Uses an in-memory SQLite database for workspace/auth state and mocks
the export_service functions so no real DuckDB files are needed.

Covers:
  - 200 responses with correct content-type and Content-Disposition headers
  - 401 when no / invalid auth token is provided
  - 404 when the workspace does not exist or belongs to another user
  - 400 when export_service raises ValueError (table does not exist)
"""

from __future__ import annotations

from collections.abc import Generator
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import api.export as export_module  # noqa: F401 — imported for monkeypatching
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
# Auth helpers (mirror pattern from other API test modules)
# ---------------------------------------------------------------------------


def _register_and_login(
    client: TestClient,
    email: str = "ralph@springfield.edu",
) -> str:
    """Register a user (creates default workspace) and return access token."""
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


def _get_workspace(client: TestClient, token: str) -> tuple[str, str]:
    """Return (workspace_id, duckdb_path) for the user's default workspace."""
    resp = client.get("/api/workspaces/", headers=_auth_headers(token))
    ws = resp.json()[0]
    return ws["id"], ws["duckdb_path"]


# ---------------------------------------------------------------------------
# CSV endpoint
# ---------------------------------------------------------------------------


class TestExportCsv:
    def test_200_correct_content_type(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_csv",
            return_value=b"id,name\n1,Alice\n",
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/csv",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 200
        assert resp.headers["content-type"] == "text/csv; charset=utf-8"

    def test_200_content_disposition(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_csv",
            return_value=b"id,name\n1,Alice\n",
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/csv",
                headers=_auth_headers(token),
            )

        assert "sales.csv" in resp.headers["content-disposition"]

    def test_401_no_token(self, client: TestClient) -> None:
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/csv"
        )
        # Missing Authorization header → FastAPI returns 422 (validation error)
        # because the Header(...) parameter is required.
        assert resp.status_code == 422

    def test_404_workspace_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/csv",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_404_other_users_workspace(self, client: TestClient) -> None:
        token_a = _register_and_login(client, "owner@example.com")
        ws_id, _ = _get_workspace(client, token_a)

        token_b = _register_and_login(client, "intruder@example.com")
        resp = client.get(
            f"/api/export/{ws_id}/tables/sales/csv",
            headers=_auth_headers(token_b),
        )
        assert resp.status_code == 404

    def test_400_table_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_csv",
            side_effect=ValueError("Table not found: ghost"),
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/ghost/csv",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 400
        assert "ghost" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# Excel endpoint
# ---------------------------------------------------------------------------


class TestExportExcel:
    _XLSX_MIME = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

    def test_200_correct_content_type(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_excel",
            return_value=b"fakexlsxbytes",
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/excel",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 200
        assert self._XLSX_MIME in resp.headers["content-type"]

    def test_200_content_disposition(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_excel",
            return_value=b"fakexlsxbytes",
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/excel",
                headers=_auth_headers(token),
            )

        assert "sales.xlsx" in resp.headers["content-disposition"]

    def test_401_no_token(self, client: TestClient) -> None:
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/excel"
        )
        assert resp.status_code == 422

    def test_404_workspace_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/excel",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_400_table_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_excel",
            side_effect=ValueError("Table not found: ghost"),
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/ghost/excel",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# JSON endpoint
# ---------------------------------------------------------------------------


class TestExportJson:
    def test_200_correct_content_type(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_json",
            return_value=b'[{"id":1}]',
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/json",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 200
        assert "application/json" in resp.headers["content-type"]

    def test_200_content_disposition(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_json",
            return_value=b'[{"id":1}]',
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/sales/json",
                headers=_auth_headers(token),
            )

        assert "sales.json" in resp.headers["content-disposition"]

    def test_401_no_token(self, client: TestClient) -> None:
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/json"
        )
        assert resp.status_code == 422

    def test_404_workspace_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        resp = client.get(
            "/api/export/00000000-0000-0000-0000-000000000000/tables/sales/json",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_400_table_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        ws_id, _ = _get_workspace(client, token)

        with patch(
            "api.export.export_service.export_to_json",
            side_effect=ValueError("Table not found: ghost"),
        ):
            resp = client.get(
                f"/api/export/{ws_id}/tables/ghost/json",
                headers=_auth_headers(token),
            )

        assert resp.status_code == 400
