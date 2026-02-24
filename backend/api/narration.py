"""Narration API: TTS streaming endpoint for dashboard narration playback."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse

from api.auth import get_authenticated_user
from models.user import User
from services.tts_service import stream_tts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/narration", tags=["narration"])

VALID_VOICES = {"alloy", "echo", "fable", "onyx", "nova", "shimmer"}
VALID_FORMATS = {"mp3", "opus", "aac", "flac"}

CONTENT_TYPES = {
    "mp3": "audio/mpeg",
    "opus": "audio/opus",
    "aac": "audio/aac",
    "flac": "audio/flac",
}


@router.post("/tts")
async def tts_endpoint(
    text: str = Query(..., min_length=1, max_length=4096),
    voice: str = Query("alloy"),
    response_format: str = Query("mp3"),
    speed: float = Query(1.0, ge=0.25, le=4.0),
    user: User = Depends(get_authenticated_user),
) -> StreamingResponse:
    """Stream TTS audio from OpenAI's API.

    Converts narration text to speech and streams the audio response
    back to the client. Audio begins streaming before the full response
    is ready, enabling low-latency playback.

    Query Parameters
    ----------------
    text : str
        Text to convert to speech (1-4096 characters).
    voice : str
        OpenAI TTS voice (alloy, echo, fable, onyx, nova, shimmer).
    response_format : str
        Audio format (mp3, opus, aac, flac).
    speed : float
        Playback speed (0.25 to 4.0).
    """
    if voice not in VALID_VOICES:
        valid = ", ".join(sorted(VALID_VOICES))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid voice '{voice}'. Must be one of: {valid}",
        )

    if response_format not in VALID_FORMATS:
        valid = ", ".join(sorted(VALID_FORMATS))
        raise HTTPException(
            status_code=400,
            detail=f"Invalid format '{response_format}'. Must be one of: {valid}",
        )

    try:
        audio_stream = stream_tts(
            text=text,
            voice=voice,
            response_format=response_format,
            speed=speed,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    content_type = CONTENT_TYPES[response_format]

    return StreamingResponse(
        audio_stream,
        media_type=content_type,
        headers={
            "Cache-Control": "no-cache",
            "X-Content-Type-Options": "nosniff",
        },
    )
