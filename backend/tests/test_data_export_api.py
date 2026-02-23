"""Tests for data export API route: GET /api/data/export/{table_name}."""

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

import api.data as data_module
from db import get_db
from main import app
from models.base import Base
from services.duckdb_service import ingest_file

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


@pytest.fixture(autouse=True)
def _use_tmp_dir(
    tmp_path: object, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Point DUCKDB_PATH to a temp folder for each test."""
    monkeypatch.setattr(data_module, "DUCKDB_PATH", str(tmp_path))


def _register_and_login(
    client: TestClient,
    email: str = "ralph@springfield.edu",
) -> str:
    """Register a user (creates default workspace) and return token."""
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


def _get_workspace(
    client: TestClient, token: str,
) -> tuple[str, str]:
    """Return (workspace_id, duckdb_path) for the default workspace."""
    resp = client.get(
        "/api/workspaces/", headers=_auth_headers(token),
    )
    ws = resp.json()[0]
    return ws["id"], ws["duckdb_path"]


def _create_csv(tmp_path: object, name: str = "sample.csv") -> str:
    """Write a simple CSV and return its absolute path."""
    path = os.path.join(str(tmp_path), name)
    with open(path, "w", encoding="utf-8") as f:
        f.write("id,name,score\n")
        f.write("1,Alice,95.5\n")
        f.write("2,Bob,87.0\n")
    return path


def _ingest_csv_into_workspace(
    tmp_path: object,
    db_path: str,
    table_name: str,
) -> None:
    """Create a CSV and ingest it into the workspace DuckDB."""
    csv_path = _create_csv(tmp_path, f"{table_name}.csv")
    ingest_file(db_path, csv_path, table_name)


# --- GET /api/data/export/{table_name}: success cases ---


def test_export_parquet(
    client: TestClient, tmp_path: object,
) -> None:
    """Export table as Parquet (binary)."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)
    _ingest_csv_into_workspace(tmp_path, db_path, "sales")

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id, "format": "parquet"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert "application/octet-stream" in resp.headers["content-type"]
    assert len(resp.content) > 0


def test_export_csv(
    client: TestClient, tmp_path: object,
) -> None:
    """Export table as CSV with headers."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)
    _ingest_csv_into_workspace(tmp_path, db_path, "sales")

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id, "format": "csv"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert b"Alice" in resp.content
    assert b"Bob" in resp.content


def test_export_default_format_is_parquet(
    client: TestClient, tmp_path: object,
) -> None:
    """Default format is Parquet when not specified."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)
    _ingest_csv_into_workspace(tmp_path, db_path, "sales")

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert "application/octet-stream" in resp.headers["content-type"]


def test_export_content_disposition(
    client: TestClient, tmp_path: object,
) -> None:
    """Response includes content-disposition header with filename."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)
    _ingest_csv_into_workspace(tmp_path, db_path, "sales")

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id, "format": "csv"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert "sales.csv" in resp.headers.get("content-disposition", "")


# --- GET /api/data/export/{table_name}: error cases ---


def test_export_invalid_format(
    client: TestClient, tmp_path: object,
) -> None:
    """400 for unsupported format."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id, "format": "xml"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400


def test_export_table_not_found(
    client: TestClient, tmp_path: object,
) -> None:
    """404 when table doesn't exist."""
    token = _register_and_login(client)
    ws_id, db_path = _get_workspace(client, token)
    _ingest_csv_into_workspace(tmp_path, db_path, "other")

    resp = client.get(
        "/api/data/export/nonexistent",
        params={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_export_no_db_file(
    client: TestClient,
) -> None:
    """404 when workspace DuckDB file doesn't exist yet."""
    token = _register_and_login(client)
    ws_id, _ = _get_workspace(client, token)

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_export_workspace_not_found(
    client: TestClient,
) -> None:
    """404 for non-existent workspace."""
    token = _register_and_login(client)
    resp = client.get(
        "/api/data/export/sales",
        params={
            "workspace_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_export_no_auth(client: TestClient) -> None:
    """Reject without authentication."""
    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": "some-id"},
    )
    assert resp.status_code == 422


def test_export_invalid_token(client: TestClient) -> None:
    """Reject with invalid token."""
    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": "some-id"},
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401


def test_export_other_users_workspace(
    client: TestClient, tmp_path: object,
) -> None:
    """Cannot export from another user's workspace."""
    token_a = _register_and_login(client, "owner@example.com")
    ws_id, db_path = _get_workspace(client, token_a)
    _ingest_csv_into_workspace(tmp_path, db_path, "sales")

    token_b = _register_and_login(client, "intruder@example.com")

    resp = client.get(
        "/api/data/export/sales",
        params={"workspace_id": ws_id},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404
