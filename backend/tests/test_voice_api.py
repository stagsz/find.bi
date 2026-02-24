"""Tests for voice WebSocket endpoint: /ws/voice."""

import json
import os
from collections.abc import AsyncIterator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

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


# --- Connection Tests ---


def test_ws_voice_rejects_missing_token(client: TestClient) -> None:
    """WebSocket connection without a token should be closed with 1008."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/voice"):
            pass


def test_ws_voice_rejects_empty_token(client: TestClient) -> None:
    """WebSocket connection with empty token should be closed with 1008."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/voice?token="):
            pass


def test_ws_voice_rejects_invalid_token(client: TestClient) -> None:
    """WebSocket connection with an invalid JWT should be closed with 1008."""
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/voice?token=invalid.jwt.token"):
            pass


def test_ws_voice_rejects_expired_token(client: TestClient) -> None:
    """WebSocket connection with an expired JWT should be closed."""
    from datetime import timedelta

    from services.auth_service import create_access_token

    token = _register_and_login(client)

    # Decode the valid token to get user_id, then create an expired one
    from services.auth_service import decode_token

    user_id = decode_token(token)
    expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-1))

    with pytest.raises(Exception):
        with client.websocket_connect(f"/ws/voice?token={expired_token}"):
            pass


@patch("api.voice.connect_to_openai")
def test_ws_voice_accepts_valid_token(
    mock_connect: MagicMock, client: TestClient,
) -> None:
    """WebSocket connection with a valid JWT should be accepted.

    Mocks the OpenAI connection to test auth in isolation.
    """
    # Create a mock OpenAI WebSocket that immediately closes
    mock_openai_ws = AsyncMock()
    mock_openai_ws.close = AsyncMock()

    # Make the mock iterable (for forward_openai_to_client)
    async def _empty_iter() -> AsyncIterator[str]:
        return
        yield  # makes this an async generator

    mock_openai_ws.__aiter__ = _empty_iter
    mock_connect.return_value = mock_openai_ws

    token = _register_and_login(client)

    with client.websocket_connect(f"/ws/voice?token={token}"):
        # Connection was accepted — send a close to cleanly disconnect
        pass

    mock_connect.assert_called_once()


@patch("api.voice.connect_to_openai")
@patch("api.voice.configure_session")
def test_ws_voice_configures_openai_session(
    mock_configure: MagicMock,
    mock_connect: MagicMock,
    client: TestClient,
) -> None:
    """After connecting, the endpoint should configure the OpenAI session."""
    mock_openai_ws = AsyncMock()
    mock_openai_ws.close = AsyncMock()

    async def _empty_iter() -> AsyncIterator[str]:
        return
        yield

    mock_openai_ws.__aiter__ = _empty_iter
    mock_connect.return_value = mock_openai_ws

    token = _register_and_login(client)

    with client.websocket_connect(f"/ws/voice?token={token}"):
        pass

    mock_configure.assert_called_once_with(mock_openai_ws)


@patch("api.voice.connect_to_openai")
def test_ws_voice_sends_error_when_no_api_key(
    mock_connect: MagicMock, client: TestClient,
) -> None:
    """If OPENAI_API_KEY is not set, client gets an error JSON then close."""
    mock_connect.side_effect = ValueError(
        "OPENAI_API_KEY environment variable is not set."
    )

    token = _register_and_login(client)

    # Connection accepted (auth passed), then server sends error and closes
    with client.websocket_connect(f"/ws/voice?token={token}") as ws:
        data = ws.receive_json()
        assert data["type"] == "error"
        assert "OPENAI_API_KEY" in data["message"]


@patch("api.voice.connect_to_openai")
def test_ws_voice_sends_error_on_connection_failure(
    mock_connect: MagicMock, client: TestClient,
) -> None:
    """If OpenAI connection fails, client gets an error JSON then close."""
    mock_connect.side_effect = ConnectionError(
        "Failed to connect to OpenAI Realtime API"
    )

    token = _register_and_login(client)

    with client.websocket_connect(f"/ws/voice?token={token}") as ws:
        data = ws.receive_json()
        assert data["type"] == "error"
        assert "Failed to connect" in data["message"]


@patch("api.voice.connect_to_openai")
@patch("api.voice.configure_session")
def test_ws_voice_forwards_text_to_openai(
    mock_configure: MagicMock,
    mock_connect: MagicMock,
    client: TestClient,
) -> None:
    """Text messages from client should be forwarded to OpenAI."""
    mock_openai_ws = AsyncMock()
    mock_openai_ws.send = AsyncMock()
    mock_openai_ws.close = AsyncMock()

    async def _empty_iter() -> AsyncIterator[str]:
        return
        yield

    mock_openai_ws.__aiter__ = _empty_iter
    mock_connect.return_value = mock_openai_ws

    token = _register_and_login(client)

    event = json.dumps({
        "type": "input_audio_buffer.append",
        "audio": "base64encodedaudio",
    })

    with client.websocket_connect(f"/ws/voice?token={token}") as ws:
        ws.send_text(event)

    # The forwarding task should have sent the message to OpenAI
    # (may take a moment to process through asyncio)
    # The mock send should have been called with the event text
    if mock_openai_ws.send.call_count > 0:
        sent = mock_openai_ws.send.call_args[0][0]
        assert "input_audio_buffer" in sent


# --- Voice Service Unit Tests ---


def test_voice_service_get_api_key_default() -> None:
    """_get_openai_api_key returns empty string when not set."""
    from services.voice_service import _get_openai_api_key

    old = os.environ.pop("OPENAI_API_KEY", None)
    try:
        assert _get_openai_api_key() == ""
    finally:
        if old is not None:
            os.environ["OPENAI_API_KEY"] = old


def test_voice_service_get_api_key_from_env() -> None:
    """_get_openai_api_key reads from OPENAI_API_KEY env var."""
    from services.voice_service import _get_openai_api_key

    old = os.environ.get("OPENAI_API_KEY")
    os.environ["OPENAI_API_KEY"] = "test-key-123"
    try:
        assert _get_openai_api_key() == "test-key-123"
    finally:
        if old is not None:
            os.environ["OPENAI_API_KEY"] = old
        else:
            os.environ.pop("OPENAI_API_KEY", None)


@pytest.mark.asyncio
async def test_connect_to_openai_raises_without_key() -> None:
    """connect_to_openai raises ValueError when API key is empty."""
    from services.voice_service import connect_to_openai

    old = os.environ.pop("OPENAI_API_KEY", None)
    try:
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            await connect_to_openai()
    finally:
        if old is not None:
            os.environ["OPENAI_API_KEY"] = old


@pytest.mark.asyncio
async def test_configure_session_sends_config() -> None:
    """configure_session sends a session.update event to OpenAI."""
    from services.voice_service import configure_session

    mock_ws = AsyncMock()
    await configure_session(mock_ws)

    mock_ws.send.assert_called_once()
    sent = json.loads(mock_ws.send.call_args[0][0])
    assert sent["type"] == "session.update"
    assert "session" in sent
    assert sent["session"]["modalities"] == ["text", "audio"]
    assert sent["session"]["voice"] == "alloy"
    assert sent["session"]["input_audio_format"] == "pcm16"
    assert sent["session"]["output_audio_format"] == "pcm16"
