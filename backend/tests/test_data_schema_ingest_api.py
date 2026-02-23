"""Tests for data schema detection and ingestion API routes.

Covers POST /api/data/detect-schema and POST /api/data/ingest.
"""

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
def _use_tmp_upload_dir(tmp_path: object, monkeypatch: pytest.MonkeyPatch) -> None:
    """Point upload directory to a temp folder for each test."""
    monkeypatch.setattr(data_module, "DUCKDB_PATH", str(tmp_path))


def _register_and_login(
    client: TestClient, email: str = "ralph@springfield.edu",
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


def _get_workspace_id(client: TestClient, token: str) -> str:
    """Get the default workspace ID for the logged-in user."""
    resp = client.get("/api/workspaces/", headers=_auth_headers(token))
    ws_id: str = resp.json()[0]["id"]
    return ws_id


def _upload_csv(
    client: TestClient, token: str, ws_id: str,
    filename: str = "sales.csv",
    content: bytes = b"region,revenue\nNorth,100\nSouth,200",
) -> dict[str, str | int]:
    """Upload a CSV file and return the response JSON."""
    resp = client.post(
        "/api/data/upload",
        files={"file": (filename, content, "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    result: dict[str, str | int] = resp.json()
    return result


# --- POST /api/data/detect-schema: success ---


def test_detect_schema_csv(client: TestClient) -> None:
    """Detect schema of a CSV file returns columns and row count."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    upload = _upload_csv(client, token, ws_id)

    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": upload["path"], "workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 2
    col_names = [c["name"] for c in data["columns"]]
    assert "region" in col_names
    assert "revenue" in col_names


def test_detect_schema_returns_types(client: TestClient) -> None:
    """Schema detection returns friendly type names."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    upload = _upload_csv(client, token, ws_id)

    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": upload["path"], "workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    data = resp.json()
    for col in data["columns"]:
        assert "name" in col
        assert "type" in col
        assert "duckdb_type" in col


def test_detect_schema_json_file(client: TestClient) -> None:
    """Detect schema from a JSON file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    content = b'[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]'
    resp = client.post(
        "/api/data/upload",
        files={"file": ("people.json", content, "application/json")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    upload = resp.json()

    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": upload["path"], "workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["row_count"] == 2
    col_names = [c["name"] for c in data["columns"]]
    assert "name" in col_names
    assert "age" in col_names


# --- POST /api/data/detect-schema: errors ---


def test_detect_schema_bad_workspace(client: TestClient) -> None:
    """Reject schema detection for non-existent workspace."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/data/detect-schema",
        json={
            "file_path": "/some/path.csv",
            "workspace_id": "00000000-0000-0000-0000-000000000000",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_detect_schema_path_outside_workspace(client: TestClient) -> None:
    """Reject schema detection for file outside workspace directory."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": "/etc/passwd", "workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 403


def test_detect_schema_file_not_found(client: TestClient, tmp_path: object) -> None:
    """Reject schema detection for non-existent file (within workspace dir)."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    # Get the user ID to construct a valid-looking path
    me = client.get("/api/auth/me", headers=_auth_headers(token))
    user_id = me.json()["id"]
    fake_path = os.path.join(str(tmp_path), user_id, ws_id, "uploads", "fake.csv")

    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": fake_path, "workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400


def test_detect_schema_no_auth(client: TestClient) -> None:
    """Reject schema detection without auth."""
    resp = client.post(
        "/api/data/detect-schema",
        json={"file_path": "/some/path.csv", "workspace_id": "some-id"},
    )
    assert resp.status_code == 422


# --- POST /api/data/ingest: success ---


def test_ingest_csv(client: TestClient) -> None:
    """Ingest a CSV file creates a table and returns metadata."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    upload = _upload_csv(client, token, ws_id)

    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": upload["path"],
            "workspace_id": ws_id,
            "table_name": "sales",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["table_name"] == "sales"
    assert data["row_count"] == 2
    col_names = [c["name"] for c in data["columns"]]
    assert "region" in col_names
    assert "revenue" in col_names


def test_ingest_shows_in_sources(client: TestClient) -> None:
    """After ingestion, the table appears in the sources list."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    upload = _upload_csv(client, token, ws_id)

    client.post(
        "/api/data/ingest",
        json={
            "file_path": upload["path"],
            "workspace_id": ws_id,
            "table_name": "my_table",
        },
        headers=_auth_headers(token),
    )

    resp = client.get(
        f"/api/data/sources?workspace_id={ws_id}",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    tables = [t["table_name"] for t in resp.json()]
    assert "my_table" in tables


def test_ingest_custom_table_name(client: TestClient) -> None:
    """Table name is sanitized but used."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    upload = _upload_csv(client, token, ws_id)

    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": upload["path"],
            "workspace_id": ws_id,
            "table_name": "My Sales Data!",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    # Sanitized: special chars replaced, spaces to underscores
    assert resp.json()["table_name"] == "My_Sales_Data"


def test_ingest_duplicate_name_deduplicates(client: TestClient) -> None:
    """Ingesting with a duplicate name auto-appends suffix."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    upload1 = _upload_csv(client, token, ws_id)
    client.post(
        "/api/data/ingest",
        json={
            "file_path": upload1["path"],
            "workspace_id": ws_id,
            "table_name": "sales",
        },
        headers=_auth_headers(token),
    )

    upload2 = _upload_csv(
        client, token, ws_id,
        filename="sales2.csv",
        content=b"region,revenue\nEast,300",
    )
    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": upload2["path"],
            "workspace_id": ws_id,
            "table_name": "sales",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["table_name"] == "sales_2"


# --- POST /api/data/ingest: errors ---


def test_ingest_bad_workspace(client: TestClient) -> None:
    """Reject ingestion for non-existent workspace."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": "/some/path.csv",
            "workspace_id": "00000000-0000-0000-0000-000000000000",
            "table_name": "test",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404


def test_ingest_path_outside_workspace(client: TestClient) -> None:
    """Reject ingestion for file outside workspace directory."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": "/etc/passwd",
            "workspace_id": ws_id,
            "table_name": "test",
        },
        headers=_auth_headers(token),
    )
    assert resp.status_code == 403


def test_ingest_no_auth(client: TestClient) -> None:
    """Reject ingestion without auth."""
    resp = client.post(
        "/api/data/ingest",
        json={
            "file_path": "/some/path.csv",
            "workspace_id": "some-id",
            "table_name": "test",
        },
    )
    assert resp.status_code == 422
