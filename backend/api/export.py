"""Export API router: download workspace table data as CSV, Excel, or JSON.

Prefix: /api/export

All endpoints require a valid Bearer token and validate that the requested
workspace is owned by the authenticated user.
"""

from __future__ import annotations

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.user import User
from models.workspace import Workspace
from services import export_service

router = APIRouter(prefix="/api/export", tags=["export"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_workspace_db_path(
    workspace_id: str,
    user: User,
    db: Session,
) -> str:
    """Validate workspace ownership and return its DuckDB path.

    Raises HTTPException 404 if the workspace does not exist or is not
    owned by *user*.
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
    return str(workspace.duckdb_path)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/{workspace_id}/tables/{table_name}/csv")
def export_csv(
    workspace_id: str,
    table_name: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> Response:
    """Download a workspace table as a CSV file."""
    db_path = _get_workspace_db_path(workspace_id, user, db)

    try:
        content = export_service.export_to_csv(db_path, table_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{table_name}.csv"',
        },
    )


@router.get("/{workspace_id}/tables/{table_name}/excel")
def export_excel(
    workspace_id: str,
    table_name: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> Response:
    """Download a workspace table as an Excel (.xlsx) file."""
    db_path = _get_workspace_db_path(workspace_id, user, db)

    try:
        content = export_service.export_to_excel(db_path, table_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type=(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        headers={
            "Content-Disposition": (
                f'attachment; filename="{table_name}.xlsx"'
            ),
        },
    )


@router.get("/{workspace_id}/tables/{table_name}/json")
def export_json(
    workspace_id: str,
    table_name: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> Response:
    """Download a workspace table as a JSON file (array of row objects)."""
    db_path = _get_workspace_db_path(workspace_id, user, db)

    try:
        content = export_service.export_to_json(db_path, table_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{table_name}.json"'
            ),
        },
    )
