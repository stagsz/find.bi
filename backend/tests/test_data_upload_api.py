"""Tests for data upload API routes.

Covers POST /api/data/upload with file type and size validation.
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


# --- POST /api/data/upload: success cases ---


def test_upload_csv_success(client: TestClient) -> None:
    """Upload a valid CSV file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={
            "file": ("sales.csv", b"region,revenue\nNorth,100\nSouth,200", "text/csv"),
        },
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["filename"] == "sales.csv"
    assert data["size"] == len(b"region,revenue\nNorth,100\nSouth,200")
    assert data["file_id"]
    assert data["path"]
    assert data["content_type"] == "text/csv"


def test_upload_json_success(client: TestClient) -> None:
    """Upload a valid JSON file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    content = b'[{"name": "Alice", "age": 30}]'

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.json", content, "application/json")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["filename"] == "data.json"
    assert resp.json()["size"] == len(content)


def test_upload_parquet_success(client: TestClient) -> None:
    """Upload a Parquet file (binary content, just checking extension)."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={
            "file": ("data.parquet", b"\x00\x01\x02\x03", "application/octet-stream"),
        },
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["filename"] == "data.parquet"


def test_upload_xlsx_success(client: TestClient) -> None:
    """Upload an Excel .xlsx file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={
            "file": (
                "report.xlsx",
                b"\x00\x01\x02\x03",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ),
        },
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["filename"] == "report.xlsx"


def test_upload_xls_success(client: TestClient) -> None:
    """Upload an Excel .xls file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("legacy.xls", b"\x00\x01\x02\x03", "application/vnd.ms-excel")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["filename"] == "legacy.xls"


def test_upload_file_saved_to_disk(client: TestClient, tmp_path: object) -> None:
    """Uploaded file should be written to the workspace upload directory."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)
    content = b"col1,col2\n1,2\n3,4"

    resp = client.post(
        "/api/data/upload",
        files={"file": ("test.csv", content, "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    file_path = resp.json()["path"]
    assert os.path.isfile(file_path)
    with open(file_path, "rb") as f:
        assert f.read() == content


def test_upload_response_fields(client: TestClient) -> None:
    """Response should include all expected fields."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    data = resp.json()
    assert "file_id" in data
    assert "filename" in data
    assert "size" in data
    assert "content_type" in data
    assert "path" in data


# --- POST /api/data/upload: validation errors ---


def test_upload_unsupported_file_type(client: TestClient) -> None:
    """Reject files with unsupported extensions."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("script.py", b"print('hello')", "text/plain")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "unsupported file type" in resp.json()["detail"].lower()


def test_upload_empty_file(client: TestClient) -> None:
    """Reject empty files."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("empty.csv", b"", "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


def test_upload_file_too_large(
    client: TestClient, monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject files exceeding the size limit."""
    # Temporarily lower the limit for testing
    monkeypatch.setattr(data_module, "MAX_FILE_SIZE", 100)

    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("big.csv", b"x" * 200, "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "too large" in resp.json()["detail"].lower()


def test_upload_no_extension(client: TestClient) -> None:
    """Reject files without an extension."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("datafile", b"some content", "application/octet-stream")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "unsupported file type" in resp.json()["detail"].lower()


# --- POST /api/data/upload: workspace validation ---


def test_upload_workspace_not_found(client: TestClient) -> None:
    """Reject upload to a non-existent workspace."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": "00000000-0000-0000-0000-000000000000"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_upload_workspace_invalid_uuid(client: TestClient) -> None:
    """Reject upload with invalid workspace UUID."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": "not-a-uuid"},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_upload_other_users_workspace(client: TestClient) -> None:
    """Cannot upload to another user's workspace."""
    token_a = _register_and_login(client, "owner@example.com")
    ws_id = _get_workspace_id(client, token_a)

    token_b = _register_and_login(client, "intruder@example.com")

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token_b),
    )
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


# --- POST /api/data/upload: auth ---


def test_upload_no_auth(client: TestClient) -> None:
    """Reject upload without authentication."""
    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": "some-id"},
    )
    assert resp.status_code == 422


def test_upload_invalid_token(client: TestClient) -> None:
    """Reject upload with invalid token."""
    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": "some-id"},
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401


# --- POST /api/data/upload: missing fields ---


def test_upload_missing_file(client: TestClient) -> None:
    """Reject request without a file."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422


def test_upload_missing_workspace_id(client: TestClient) -> None:
    """Reject request without workspace_id."""
    token = _register_and_login(client)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("data.csv", b"a,b\n1,2", "text/csv")},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422


def test_upload_case_insensitive_extension(client: TestClient) -> None:
    """File extensions should be matched case-insensitively."""
    token = _register_and_login(client)
    ws_id = _get_workspace_id(client, token)

    resp = client.post(
        "/api/data/upload",
        files={"file": ("DATA.CSV", b"a,b\n1,2", "text/csv")},
        data={"workspace_id": ws_id},
        headers=_auth_headers(token),
    )
    assert resp.status_code == 201
    assert resp.json()["filename"] == "DATA.CSV"
