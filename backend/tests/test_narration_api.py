"""Tests for narration API routes: POST /api/narration/tts."""

from collections.abc import AsyncIterator, Generator
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


async def _fake_stream(*args: object, **kwargs: object) -> AsyncIterator[bytes]:
    """Fake TTS stream that yields test audio chunks."""
    yield b"fake-audio-chunk-1"
    yield b"fake-audio-chunk-2"


# --- Tests ---


def test_tts_requires_auth(client: TestClient) -> None:
    """POST /api/narration/tts without auth returns 422 (missing header)."""
    resp = client.post("/api/narration/tts?text=Hello")
    assert resp.status_code == 422


def test_tts_requires_text(client: TestClient) -> None:
    """POST /api/narration/tts without text query param returns 422."""
    token = _register_and_login(client)
    resp = client.post("/api/narration/tts", headers=_auth_headers(token))
    assert resp.status_code == 422


def test_tts_rejects_invalid_voice(client: TestClient) -> None:
    """POST /api/narration/tts with invalid voice returns 400."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello&voice=invalid",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "Invalid voice" in resp.json()["detail"]


def test_tts_rejects_invalid_format(client: TestClient) -> None:
    """POST /api/narration/tts with invalid format returns 400."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello&response_format=wav",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 400
    assert "Invalid format" in resp.json()["detail"]


@patch("api.narration.stream_tts", side_effect=_fake_stream)
def test_tts_streams_audio(mock_tts: object, client: TestClient) -> None:
    """POST /api/narration/tts streams audio bytes from TTS service."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello+Ralph",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/mpeg"
    assert len(resp.content) > 0


@patch("api.narration.stream_tts", side_effect=_fake_stream)
def test_tts_opus_format(mock_tts: object, client: TestClient) -> None:
    """POST /api/narration/tts with opus format returns audio/opus."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello&response_format=opus",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/opus"


@patch(
    "api.narration.stream_tts",
    side_effect=ValueError("OPENAI_API_KEY not set"),
)
def test_tts_returns_502_on_api_key_missing(
    mock_tts: object, client: TestClient,
) -> None:
    """POST /api/narration/tts returns 502 when API key is missing."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 502
    assert "OPENAI_API_KEY" in resp.json()["detail"]


def test_tts_rejects_speed_out_of_range(client: TestClient) -> None:
    """POST /api/narration/tts with speed out of range returns 422."""
    token = _register_and_login(client)
    resp = client.post(
        "/api/narration/tts?text=Hello&speed=5.0",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/narration/tts?text=Hello&speed=0.1",
        headers=_auth_headers(token),
    )
    assert resp.status_code == 422
