"""TTS service: OpenAI Text-to-Speech API client for narration playback.

Streams audio from OpenAI's TTS API for dashboard narration segments.
Audio is returned as an async byte generator for chunked streaming to
the frontend, allowing playback to begin before the full audio is ready.
"""

import logging
import os
from collections.abc import AsyncIterator

import httpx

logger = logging.getLogger(__name__)

OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
DEFAULT_TTS_MODEL = "tts-1"
DEFAULT_TTS_VOICE = "alloy"
# Chunk size for streaming audio (8KB)
TTS_CHUNK_SIZE = 8192


def _get_openai_api_key() -> str:
    """Read OPENAI_API_KEY from environment at call time."""
    return os.environ.get("OPENAI_API_KEY", "")


def _get_tts_model() -> str:
    """Read TTS model from environment or use default."""
    return os.environ.get("OPENAI_TTS_MODEL", DEFAULT_TTS_MODEL)


def _get_tts_voice() -> str:
    """Read TTS voice from environment or use default."""
    return os.environ.get("OPENAI_TTS_VOICE", DEFAULT_TTS_VOICE)


async def stream_tts(
    text: str,
    voice: str | None = None,
    response_format: str = "mp3",
    speed: float = 1.0,
) -> AsyncIterator[bytes]:
    """Stream TTS audio from OpenAI's API.

    Parameters
    ----------
    text : str
        The text to convert to speech (max 4096 chars).
    voice : str | None
        Voice to use. Falls back to env var or "alloy".
    response_format : str
        Audio format: mp3, opus, aac, flac, or pcm.
    speed : float
        Playback speed multiplier (0.25 to 4.0).

    Yields
    ------
    bytes
        Audio data chunks.

    Raises
    ------
    ValueError
        If OPENAI_API_KEY is not set or text is empty.
    httpx.HTTPStatusError
        If the OpenAI API returns an error status.
    """
    api_key = _get_openai_api_key()
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable is not set. "
            "TTS features require a valid OpenAI API key."
        )

    if not text.strip():
        raise ValueError("Text for TTS cannot be empty.")

    # Truncate to OpenAI's 4096 character limit
    if len(text) > 4096:
        text = text[:4096]

    model = _get_tts_model()
    resolved_voice = voice or _get_tts_voice()

    payload = {
        "model": model,
        "input": text,
        "voice": resolved_voice,
        "response_format": response_format,
        "speed": speed,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            OPENAI_TTS_URL,
            json=payload,
            headers=headers,
        ) as response:
            response.raise_for_status()
            async for chunk in response.aiter_bytes(TTS_CHUNK_SIZE):
                yield chunk
