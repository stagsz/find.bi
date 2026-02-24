"""Voice service: OpenAI Realtime API WebSocket proxy.

Manages WebSocket connections to the OpenAI Realtime API for
bidirectional audio streaming.
"""

import json
import logging
import os
from typing import Any

import websockets
from websockets.asyncio.client import ClientConnection

logger = logging.getLogger(__name__)

OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"
OPENAI_REALTIME_MODEL = "gpt-4o-realtime-preview"


def _get_openai_api_key() -> str:
    """Read OPENAI_API_KEY from environment at call time."""
    return os.environ.get("OPENAI_API_KEY", "")


def _get_realtime_model() -> str:
    """Read the realtime model from environment at call time."""
    return os.environ.get("OPENAI_REALTIME_MODEL", OPENAI_REALTIME_MODEL)


async def connect_to_openai() -> ClientConnection:
    """Open a WebSocket connection to the OpenAI Realtime API.

    Returns the connected WebSocket client.

    Raises
    ------
    ValueError
        If the OPENAI_API_KEY is not configured.
    ConnectionError
        If the WebSocket connection to OpenAI fails.
    """
    api_key = _get_openai_api_key()
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY environment variable is not set. "
            "Voice features require a valid OpenAI API key."
        )

    model = _get_realtime_model()
    url = f"{OPENAI_REALTIME_URL}?model={model}"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "OpenAI-Beta": "realtime=v1",
    }

    try:
        ws = await websockets.connect(url, additional_headers=headers)
    except Exception as exc:
        raise ConnectionError(
            f"Failed to connect to OpenAI Realtime API: {exc}"
        ) from exc

    return ws


async def configure_session(openai_ws: ClientConnection) -> None:
    """Send session configuration to the OpenAI Realtime API.

    Configures the session for voice input/output with automatic
    turn detection and transcription enabled.
    """
    session_config: dict[str, Any] = {
        "type": "session.update",
        "session": {
            "modalities": ["text", "audio"],
            "voice": "alloy",
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {
                "model": "whisper-1",
            },
            "turn_detection": {
                "type": "server_vad",
                "threshold": 0.5,
                "prefix_padding_ms": 300,
                "silence_duration_ms": 500,
            },
        },
    }

    await openai_ws.send(json.dumps(session_config))
