"""Tests for auth API routes: POST /register, POST /login, GET /me."""

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
    """Override the get_db dependency with an in-memory SQLite session."""

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


def _register(
    client: TestClient, email: str = "ralph@springfield.edu",
) -> dict[str, str]:
    """Helper: register a user and return response JSON."""
    data: dict[str, str] = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "display_name": "Ralph Wiggum",
        },
    ).json()
    return data


def _login(client: TestClient, email: str = "ralph@springfield.edu") -> str:
    """Helper: register + login and return the access token."""
    _register(client, email)
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    token: str = resp.json()["access_token"]
    return token


# --- POST /api/auth/register ---


def test_register_success(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "ralph@springfield.edu",
            "password": "password123",
            "display_name": "Ralph Wiggum",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "ralph@springfield.edu"
    assert data["display_name"] == "Ralph Wiggum"
    assert "id" in data


def test_register_returns_uuid_id(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",
            "password": "pass",
            "display_name": "Test",
        },
    )
    data = resp.json()
    # UUID format: 8-4-4-4-12 hex chars
    assert len(data["id"].split("-")) == 5


def test_register_duplicate_email(client: TestClient) -> None:
    _register(client, "dupe@example.com")
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "dupe@example.com",
            "password": "pass2",
            "display_name": "Dupe",
        },
    )
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"]


def test_register_invalid_email(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "not-an-email",
            "password": "pass",
            "display_name": "Bad",
        },
    )
    assert resp.status_code == 422


def test_register_missing_fields(client: TestClient) -> None:
    resp = client.post("/api/auth/register", json={"email": "a@b.com"})
    assert resp.status_code == 422


# --- POST /api/auth/login ---


def test_login_success(client: TestClient) -> None:
    _register(client)
    resp = client.post(
        "/api/auth/login",
        json={"email": "ralph@springfield.edu", "password": "password123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password(client: TestClient) -> None:
    _register(client)
    resp = client.post(
        "/api/auth/login",
        json={"email": "ralph@springfield.edu", "password": "wrong"},
    )
    assert resp.status_code == 401
    assert "Invalid" in resp.json()["detail"]


def test_login_unknown_email(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "nobody@example.com", "password": "anything"},
    )
    assert resp.status_code == 401


def test_login_invalid_email_format(client: TestClient) -> None:
    resp = client.post(
        "/api/auth/login",
        json={"email": "bad-email", "password": "pass"},
    )
    assert resp.status_code == 422


# --- GET /api/auth/me ---


def test_me_success(client: TestClient) -> None:
    token = _login(client)
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "ralph@springfield.edu"
    assert data["display_name"] == "Ralph Wiggum"
    assert "id" in data


def test_me_no_auth_header(client: TestClient) -> None:
    resp = client.get("/api/auth/me")
    assert resp.status_code == 422


def test_me_invalid_token(client: TestClient) -> None:
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert resp.status_code == 401


def test_me_missing_bearer_prefix(client: TestClient) -> None:
    token = _login(client, "prefix@example.com")
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": token},
    )
    assert resp.status_code == 401
    assert "authorization header" in resp.json()["detail"].lower()


def test_me_does_not_return_password(client: TestClient) -> None:
    token = _login(client, "nopw@example.com")
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    data = resp.json()
    assert "password" not in data
    assert "password_hash" not in data
