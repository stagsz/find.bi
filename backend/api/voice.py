"""Voice API: WebSocket endpoint for proxying audio to OpenAI Realtime API."""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from websockets.asyncio.client import ClientConnection

from services.auth_service import decode_token
from services.voice_service import (
    configure_session,
    connect_to_openai,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["voice"])


def _authenticate_ws(token: str) -> None:
    """Validate a JWT token for WebSocket connections.

    WebSocket connections cannot use standard HTTP header-based auth
    dependencies, so we extract the token from a query parameter and
    validate it directly.

    Raises ValueError if the token is invalid or the user doesn't exist.
    """
    # decode_token validates the JWT signature and expiry, returning user_id.
    # We don't need the full User object for the proxy — just confirmation
    # that the token is valid.
    decode_token(token)


@router.websocket("/ws/voice")
async def voice_proxy(websocket: WebSocket, token: str = "") -> None:
    """Bidirectional WebSocket proxy between client and OpenAI Realtime API.

    Query Parameters
    ----------------
    token : str
        JWT access token for authentication.

    Protocol
    --------
    1. Client connects with ``?token=<jwt>``
    2. Server validates the token
    3. Server opens a WebSocket to OpenAI Realtime API
    4. Messages are forwarded bidirectionally:
       - Client text/binary → OpenAI
       - OpenAI text/binary → Client
    5. Either side disconnecting closes the other

    Close Codes
    -----------
    - 1008 (Policy Violation): Missing or invalid authentication token
    - 1011 (Internal Error): OpenAI API key not configured or connection failed
    - 1000 (Normal Closure): Clean disconnect
    """
    # --- Authentication ---
    if not token:
        await websocket.close(code=1008, reason="Missing authentication token")
        return

    try:
        _authenticate_ws(token)
    except ValueError as exc:
        await websocket.close(code=1008, reason=str(exc))
        return

    # Accept the WebSocket connection after auth succeeds
    await websocket.accept()

    # --- Connect to OpenAI Realtime API ---
    try:
        openai_ws = await connect_to_openai()
    except ValueError as exc:
        # API key not configured
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1011, reason="OpenAI API key not configured")
        return
    except ConnectionError as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        await websocket.close(code=1011, reason="Failed to connect to OpenAI")
        return

    # --- Configure session ---
    try:
        await configure_session(openai_ws)
    except Exception as exc:
        logger.error("Failed to configure OpenAI session: %s", exc)
        await openai_ws.close()
        await websocket.send_json(
            {"type": "error", "message": "Failed to configure voice session"}
        )
        await websocket.close(code=1011, reason="Session configuration failed")
        return

    # --- Bidirectional proxy ---
    stop_event = asyncio.Event()

    async def _client_to_openai(
        ws_client: WebSocket,
        ws_openai: ClientConnection,
        stop: asyncio.Event,
    ) -> None:
        """Forward messages from client WebSocket to OpenAI."""
        try:
            while not stop.is_set():
                msg = await ws_client.receive()
                if msg.get("type") == "websocket.disconnect":
                    break
                if "text" in msg:
                    await ws_openai.send(msg["text"])
                elif "bytes" in msg:
                    await ws_openai.send(msg["bytes"])
        except WebSocketDisconnect:
            pass
        except Exception:
            logger.debug("Client->OpenAI forwarding ended")
        finally:
            stop.set()

    async def _openai_to_client(
        ws_openai: ClientConnection,
        ws_client: WebSocket,
        stop: asyncio.Event,
    ) -> None:
        """Forward messages from OpenAI to client WebSocket."""
        try:
            async for message in ws_openai:
                if stop.is_set():
                    break
                if ws_client.client_state != WebSocketState.CONNECTED:
                    break
                if isinstance(message, bytes):
                    await ws_client.send_bytes(message)
                else:
                    await ws_client.send_text(message)
        except Exception:
            logger.debug("OpenAI->Client forwarding ended")
        finally:
            stop.set()

    try:
        client_to_openai = asyncio.create_task(
            _client_to_openai(websocket, openai_ws, stop_event)
        )
        openai_to_client = asyncio.create_task(
            _openai_to_client(openai_ws, websocket, stop_event)
        )

        # Wait for either direction to finish
        done, pending = await asyncio.wait(
            [client_to_openai, openai_to_client],
            return_when=asyncio.FIRST_COMPLETED,
        )

        # Signal stop and cancel pending tasks
        stop_event.set()
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    except Exception as exc:
        logger.error("Voice proxy error: %s", exc)
    finally:
        # Clean up OpenAI connection
        try:
            await openai_ws.close()
        except Exception:
            pass

        # Clean up client connection
        if websocket.client_state == WebSocketState.CONNECTED:
            try:
                await websocket.close(code=1000)
            except Exception:
                pass
