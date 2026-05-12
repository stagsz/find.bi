"""Alerts API: CRUD for workspace alerts + immediate evaluation."""

from __future__ import annotations

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.alert import Alert
from models.user import User
from models.workspace import Workspace
from services.alert_service import evaluate_alert

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

VALID_CONDITIONS = {"gt", "lt", "eq", "gte", "lte"}
VALID_CHANNELS = {"browser", "email", "webhook"}


class AlertRequest(BaseModel):
    name: str
    sql_query: str
    condition: str
    threshold: float
    channel: str
    webhook_url: str | None = None
    email: str | None = None


class AlertResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    sql_query: str
    condition: str
    threshold: float
    channel: str
    webhook_url: str | None
    email: str | None
    is_active: bool
    last_triggered_at: str | None
    last_value: float | None

    model_config = {"from_attributes": True}


class EvaluateResponse(BaseModel):
    triggered: bool
    value: float | None
    error: str | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _alert_to_response(alert: Alert) -> AlertResponse:
    return AlertResponse(
        id=str(alert.id),
        workspace_id=str(alert.workspace_id),
        name=alert.name,
        sql_query=alert.sql_query,
        condition=alert.condition,
        threshold=alert.threshold,
        channel=alert.channel,
        webhook_url=alert.webhook_url,
        email=alert.email,
        is_active=alert.is_active,
        last_triggered_at=(
            alert.last_triggered_at.isoformat() if alert.last_triggered_at else None
        ),
        last_value=alert.last_value,
    )


def _require_workspace(workspace_id: str, user: User, db: Session) -> Workspace:
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


def _validate_body(body: AlertRequest) -> None:
    if body.condition not in VALID_CONDITIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid condition '{body.condition}'. Must be one of: {sorted(VALID_CONDITIONS)}",
        )
    if body.channel not in VALID_CHANNELS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid channel '{body.channel}'. Must be one of: {sorted(VALID_CHANNELS)}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{workspace_id}", response_model=list[AlertResponse])
def list_alerts(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> list[AlertResponse]:
    """List all alerts for a workspace."""
    ws = _require_workspace(workspace_id, user, db)
    alerts = db.query(Alert).filter(Alert.workspace_id == ws.id).all()
    return [_alert_to_response(a) for a in alerts]


@router.post("/{workspace_id}", response_model=AlertResponse, status_code=201)
def create_alert(
    workspace_id: str,
    body: AlertRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    """Create a new alert for a workspace."""
    ws = _require_workspace(workspace_id, user, db)
    _validate_body(body)

    alert = Alert(
        workspace_id=ws.id,
        name=body.name,
        sql_query=body.sql_query,
        condition=body.condition,
        threshold=body.threshold,
        channel=body.channel,
        webhook_url=body.webhook_url,
        email=body.email,
        is_active=True,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return _alert_to_response(alert)


@router.put("/{workspace_id}/{alert_id}", response_model=AlertResponse)
def update_alert(
    workspace_id: str,
    alert_id: str,
    body: AlertRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> AlertResponse:
    """Update an existing alert."""
    ws = _require_workspace(workspace_id, user, db)
    _validate_body(body)

    try:
        alert_uuid = _uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert = (
        db.query(Alert)
        .filter(Alert.id == alert_uuid, Alert.workspace_id == ws.id)
        .first()
    )
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.name = body.name
    alert.sql_query = body.sql_query
    alert.condition = body.condition
    alert.threshold = body.threshold
    alert.channel = body.channel
    alert.webhook_url = body.webhook_url
    alert.email = body.email
    db.commit()
    db.refresh(alert)
    return _alert_to_response(alert)


@router.delete("/{workspace_id}/{alert_id}", status_code=204)
def delete_alert(
    workspace_id: str,
    alert_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete an alert."""
    ws = _require_workspace(workspace_id, user, db)

    try:
        alert_uuid = _uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert = (
        db.query(Alert)
        .filter(Alert.id == alert_uuid, Alert.workspace_id == ws.id)
        .first()
    )
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()


@router.post("/{workspace_id}/{alert_id}/evaluate", response_model=EvaluateResponse)
def evaluate_alert_endpoint(
    workspace_id: str,
    alert_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> EvaluateResponse:
    """Trigger an immediate evaluation of an alert."""
    ws = _require_workspace(workspace_id, user, db)

    try:
        alert_uuid = _uuid.UUID(alert_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert = (
        db.query(Alert)
        .filter(Alert.id == alert_uuid, Alert.workspace_id == ws.id)
        .first()
    )
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    try:
        result = evaluate_alert(str(ws.duckdb_path), alert, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return EvaluateResponse(**result)
