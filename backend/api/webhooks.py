"""Webhook API routes: configure, ingest, and inspect webhook configs.

Endpoints use two authentication schemes:
- JWT bearer token (get_authenticated_user) for management endpoints.
- X-Webhook-Key header (bcrypt-verified) for the ingest endpoint.
"""

import secrets
import uuid as _uuid
from typing import Union

import bcrypt
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.user import User
from models.webhook import WebhookConfig
from models.workspace import Workspace
from services.duckdb_service import ingest_from_records

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------


class ConfigureRequest(BaseModel):
    table_name: str


class ConfigureResponse(BaseModel):
    api_key: str
    workspace_id: str
    table_name: str


class ConfigInfoResponse(BaseModel):
    workspace_id: str
    table_name: str | None
    has_config: bool


class IngestResponse(BaseModel):
    ingested: int
    table: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_owned_workspace(
    workspace_id: str,
    user: User,
    db: Session,
) -> Workspace:
    """Resolve workspace_id to a Workspace owned by *user*.

    Raises HTTPException 404 if not found or not owned by this user.
    """
    try:
        ws_uuid = _uuid.UUID(workspace_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == ws_uuid, Workspace.owner_id == user.id)
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _verify_webhook_key(api_key: str, config: WebhookConfig) -> bool:
    """Return True if *api_key* matches the stored bcrypt hash."""
    return bcrypt.checkpw(api_key.encode(), config.api_key_hash.encode())


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{workspace_id}/configure", response_model=ConfigureResponse)
def configure_webhook(
    workspace_id: str,
    body: ConfigureRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> ConfigureResponse:
    """Create or replace the webhook configuration for a workspace.

    Generates a new random API key, stores only its bcrypt hash, and
    returns the plaintext key **once** — it cannot be retrieved again.
    """
    workspace = _get_owned_workspace(workspace_id, user, db)

    if not body.table_name or not body.table_name.strip():
        raise HTTPException(status_code=422, detail="table_name is required")

    # Generate a new random key and hash it
    plain_key = secrets.token_urlsafe(32)
    key_hash = bcrypt.hashpw(plain_key.encode(), bcrypt.gensalt()).decode()

    # Upsert: replace existing config for this workspace if one exists
    existing = (
        db.query(WebhookConfig)
        .filter(WebhookConfig.workspace_id == workspace.id)
        .first()
    )
    if existing is not None:
        existing.api_key_hash = key_hash
        existing.table_name = body.table_name.strip()
        db.commit()
        db.refresh(existing)
    else:
        config = WebhookConfig(
            workspace_id=workspace.id,
            api_key_hash=key_hash,
            table_name=body.table_name.strip(),
        )
        db.add(config)
        db.commit()
        db.refresh(config)

    return ConfigureResponse(
        api_key=plain_key,
        workspace_id=str(workspace.id),
        table_name=body.table_name.strip(),
    )


@router.get("/{workspace_id}/config", response_model=ConfigInfoResponse)
def get_webhook_config(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> ConfigInfoResponse:
    """Return webhook configuration status for a workspace.

    Never exposes the API key or its hash.
    """
    workspace = _get_owned_workspace(workspace_id, user, db)

    config = (
        db.query(WebhookConfig)
        .filter(WebhookConfig.workspace_id == workspace.id)
        .first()
    )

    return ConfigInfoResponse(
        workspace_id=str(workspace.id),
        table_name=config.table_name if config else None,
        has_config=config is not None,
    )


@router.post("/{workspace_id}/ingest", response_model=IngestResponse)
def ingest_webhook(
    workspace_id: str,
    body: Union[dict, list] = Body(...),
    x_webhook_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> IngestResponse:
    """Ingest JSON data into a workspace DuckDB table via webhook.

    Authentication is via X-Webhook-Key header (not JWT).
    Body must be a JSON object or array of objects.
    """
    if x_webhook_key is None:
        raise HTTPException(status_code=401, detail="Missing X-Webhook-Key header")

    # Resolve the workspace (no user auth — key-based only)
    try:
        ws_uuid = _uuid.UUID(workspace_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == ws_uuid)
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # Look up webhook config
    config = (
        db.query(WebhookConfig)
        .filter(WebhookConfig.workspace_id == workspace.id)
        .first()
    )
    if config is None:
        raise HTTPException(status_code=401, detail="No webhook configured for this workspace")

    # Verify the key
    if not _verify_webhook_key(x_webhook_key, config):
        raise HTTPException(status_code=401, detail="Invalid webhook key")

    # Validate and normalise body
    if isinstance(body, dict):
        records = [body]
    elif isinstance(body, list):
        records = body
    else:
        raise HTTPException(status_code=400, detail="Body must be a JSON object or array")

    if not records:
        raise HTTPException(status_code=400, detail="Body must not be empty")

    # All elements must be dicts
    if not all(isinstance(r, dict) for r in records):
        raise HTTPException(status_code=400, detail="Each element in the array must be a JSON object")

    try:
        count = ingest_from_records(
            str(workspace.duckdb_path),
            config.table_name,
            records,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return IngestResponse(ingested=count, table=config.table_name)
