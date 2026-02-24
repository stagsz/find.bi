"""Tests for TTS service: OpenAI TTS API streaming client."""

import os
from collections.abc import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.tts_service import (
    DEFAULT_TTS_MODEL,
    DEFAULT_TTS_VOICE,
    OPENAI_TTS_URL,
    stream_tts,
)


@pytest.fixture(autouse=True)
def _set_api_key() -> Generator[None, None, None]:
    """Provide a fake OPENAI_API_KEY for all tests."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": "sk-test-key"}):
        yield


@pytest.mark.asyncio
async def test_stream_tts_raises_without_api_key() -> None:
    """stream_tts raises ValueError when OPENAI_API_KEY is unset."""
    with patch.dict(os.environ, {"OPENAI_API_KEY": ""}):
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            async for _ in stream_tts("Hello"):
                pass


@pytest.mark.asyncio
async def test_stream_tts_raises_on_empty_text() -> None:
    """stream_tts raises ValueError for empty or whitespace-only text."""
    with pytest.raises(ValueError, match="empty"):
        async for _ in stream_tts(""):
            pass

    with pytest.raises(ValueError, match="empty"):
        async for _ in stream_tts("   "):
            pass


@pytest.mark.asyncio
async def test_stream_tts_yields_audio_chunks() -> None:
    """stream_tts yields byte chunks from OpenAI TTS API."""
    chunks = [b"audio-chunk-1", b"audio-chunk-2", b"audio-chunk-3"]

    mock_response = AsyncMock()
    mock_response.raise_for_status = MagicMock()

    async def mock_aiter_bytes(
        chunk_size: int,
    ) -> AsyncGenerator[bytes, None]:
        for chunk in chunks:
            yield chunk

    mock_response.aiter_bytes = mock_aiter_bytes

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)

    with patch(
        "services.tts_service.httpx.AsyncClient",
        return_value=mock_client,
    ):
        result: list[bytes] = []
        async for chunk in stream_tts("Hello world"):
            result.append(chunk)

    assert result == chunks

    # Verify the API was called with correct parameters
    mock_client.stream.assert_called_once_with(
        "POST",
        OPENAI_TTS_URL,
        json={
            "model": DEFAULT_TTS_MODEL,
            "input": "Hello world",
            "voice": DEFAULT_TTS_VOICE,
            "response_format": "mp3",
            "speed": 1.0,
        },
        headers={
            "Authorization": "Bearer sk-test-key",
            "Content-Type": "application/json",
        },
    )


@pytest.mark.asyncio
async def test_stream_tts_custom_voice_and_format() -> None:
    """stream_tts passes custom voice and format to OpenAI."""
    mock_response = AsyncMock()
    mock_response.raise_for_status = MagicMock()

    async def mock_aiter_bytes(
        chunk_size: int,
    ) -> AsyncGenerator[bytes, None]:
        yield b"data"

    mock_response.aiter_bytes = mock_aiter_bytes

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)

    with patch(
        "services.tts_service.httpx.AsyncClient",
        return_value=mock_client,
    ):
        async for _ in stream_tts(
            "Hi", voice="nova", response_format="opus", speed=1.5,
        ):
            pass

    call_kwargs = mock_client.stream.call_args
    payload = call_kwargs.kwargs["json"]
    assert payload["voice"] == "nova"
    assert payload["response_format"] == "opus"
    assert payload["speed"] == 1.5


@pytest.mark.asyncio
async def test_stream_tts_truncates_long_text() -> None:
    """stream_tts truncates text to 4096 characters."""
    long_text = "A" * 5000

    mock_response = AsyncMock()
    mock_response.raise_for_status = MagicMock()

    async def mock_aiter_bytes(
        chunk_size: int,
    ) -> AsyncGenerator[bytes, None]:
        yield b"data"

    mock_response.aiter_bytes = mock_aiter_bytes

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)

    with patch(
        "services.tts_service.httpx.AsyncClient",
        return_value=mock_client,
    ):
        async for _ in stream_tts(long_text):
            pass

    call_kwargs = mock_client.stream.call_args
    payload = call_kwargs.kwargs["json"]
    assert len(payload["input"]) == 4096


@pytest.mark.asyncio
async def test_stream_tts_uses_env_model_and_voice() -> None:
    """stream_tts reads model and voice from environment."""
    mock_response = AsyncMock()
    mock_response.raise_for_status = MagicMock()

    async def mock_aiter_bytes(
        chunk_size: int,
    ) -> AsyncGenerator[bytes, None]:
        yield b"data"

    mock_response.aiter_bytes = mock_aiter_bytes

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)

    env = {
        "OPENAI_API_KEY": "sk-test-key",
        "OPENAI_TTS_MODEL": "tts-1-hd",
        "OPENAI_TTS_VOICE": "shimmer",
    }
    with (
        patch.dict(os.environ, env),
        patch(
            "services.tts_service.httpx.AsyncClient",
            return_value=mock_client,
        ),
    ):
        async for _ in stream_tts("Test"):
            pass

    call_kwargs = mock_client.stream.call_args
    payload = call_kwargs.kwargs["json"]
    assert payload["model"] == "tts-1-hd"
    assert payload["voice"] == "shimmer"
