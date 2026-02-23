"""Dashboard API routes: list, create, read, update, delete dashboards."""

import uuid as _uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.dashboard import Dashboard
from models.user import User
from models.workspace import Workspace

router = APIRouter(prefix="/api/dashboards", tags=["dashboards"])


# --- Request / Response models ---


class CreateDashboardRequest(BaseModel):
    workspace_id: str
    name: str
    layout_json: dict[str, Any] | None = None
    cards_json: dict[str, Any] | None = None
    filters_json: dict[str, Any] | None = None


class UpdateDashboardRequest(BaseModel):
    name: str | None = None
    layout_json: dict[str, Any] | None = None
    cards_json: dict[str, Any] | None = None
    filters_json: dict[str, Any] | None = None


class DashboardResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    layout_json: dict[str, Any]
    cards_json: dict[str, Any]
    filters_json: dict[str, Any]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


def _dashboard_response(d: Dashboard) -> DashboardResponse:
    return DashboardResponse(
        id=str(d.id),
        workspace_id=str(d.workspace_id),
        name=d.name,
        layout_json=d.layout_json,
        cards_json=d.cards_json,
        filters_json=d.filters_json,
        created_at=d.created_at.isoformat() if d.created_at else "",
        updated_at=d.updated_at.isoformat() if d.updated_at else "",
    )


def _verify_workspace_access(
    workspace_id: str, user: User, db: Session,
) -> Workspace:
    """Verify the workspace exists and belongs to the authenticated user."""
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


# --- Routes ---


@router.get("/", response_model=list[DashboardResponse])
def list_dashboards(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> list[DashboardResponse]:
    """List all dashboards in a workspace."""
    workspace = _verify_workspace_access(workspace_id, user, db)
    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.workspace_id == workspace.id)
        .order_by(Dashboard.created_at)
        .all()
    )
    return [_dashboard_response(d) for d in dashboards]


@router.post("/", response_model=DashboardResponse, status_code=201)
def create_dashboard(
    body: CreateDashboardRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    """Create a new dashboard in a workspace."""
    workspace = _verify_workspace_access(body.workspace_id, user, db)
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Dashboard name cannot be empty")
    dashboard = Dashboard(
        workspace_id=workspace.id,
        name=body.name.strip(),
        layout_json=body.layout_json or {},
        cards_json=body.cards_json or {},
        filters_json=body.filters_json or {},
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return _dashboard_response(dashboard)


@router.get("/{dashboard_id}", response_model=DashboardResponse)
def get_dashboard(
    dashboard_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    """Get a single dashboard by ID."""
    dashboard = _get_dashboard_for_user(dashboard_id, user, db)
    return _dashboard_response(dashboard)


@router.put("/{dashboard_id}", response_model=DashboardResponse)
def update_dashboard(
    dashboard_id: str,
    body: UpdateDashboardRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> DashboardResponse:
    """Update a dashboard's name, layout, cards, or filters."""
    dashboard = _get_dashboard_for_user(dashboard_id, user, db)
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(
                status_code=400, detail="Dashboard name cannot be empty",
            )
        dashboard.name = body.name.strip()
    if body.layout_json is not None:
        dashboard.layout_json = body.layout_json
    if body.cards_json is not None:
        dashboard.cards_json = body.cards_json
    if body.filters_json is not None:
        dashboard.filters_json = body.filters_json
    db.commit()
    db.refresh(dashboard)
    return _dashboard_response(dashboard)


@router.delete("/{dashboard_id}", status_code=204)
def delete_dashboard(
    dashboard_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a dashboard."""
    dashboard = _get_dashboard_for_user(dashboard_id, user, db)
    db.delete(dashboard)
    db.commit()


def _get_dashboard_for_user(
    dashboard_id: str, user: User, db: Session,
) -> Dashboard:
    """Load a dashboard and verify it belongs to a workspace owned by the user."""
    try:
        dash_uuid = _uuid.UUID(dashboard_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    dashboard = db.query(Dashboard).filter(Dashboard.id == dash_uuid).first()
    if dashboard is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    # Verify workspace ownership
    workspace = (
        db.query(Workspace)
        .filter(
            Workspace.id == dashboard.workspace_id,
            Workspace.owner_id == user.id,
        )
        .first()
    )
    if workspace is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboard
