"""API routes for external database connections."""

from __future__ import annotations

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.user import User
from models.workspace import Workspace
from services import connection_service

router = APIRouter(prefix="/api/connections", tags=["connections"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class TestConnectionRequest(BaseModel):
    conn_type: str
    host: str | None = None
    port: int | None = None
    database: str
    username: str | None = None
    password: str | None = None


class TestConnectionResponse(BaseModel):
    success: bool
    error: str | None = None
    tables: list[str]


class SaveConnectionRequest(BaseModel):
    name: str
    conn_type: str
    host: str | None = None
    port: int | None = None
    database: str
    username: str | None = None
    password: str | None = None


class ConnectionResponse(BaseModel):
    id: str
    name: str
    conn_type: str
    host: str | None = None
    port: int | None = None
    database: str
    username: str | None = None

    model_config = {"from_attributes": True}


class TablesResponse(BaseModel):
    tables: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _get_workspace(
    workspace_id: str,
    user: User,
    db: Session,
) -> Workspace:
    """Validate workspace ownership and return the Workspace record."""
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/{workspace_id}/test", response_model=TestConnectionResponse)
def test_connection_endpoint(
    workspace_id: str,
    body: TestConnectionRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> TestConnectionResponse:
    """Test an external database connection without saving it."""
    _get_workspace(workspace_id, user, db)

    try:
        result = connection_service.test_connection(
            conn_type=body.conn_type,
            host=body.host,
            port=body.port,
            database=body.database,
            username=body.username,
            password=body.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TestConnectionResponse(**result)


@router.get("/{workspace_id}", response_model=list[ConnectionResponse])
def list_connections(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> list[ConnectionResponse]:
    """List all saved external connections for a workspace (passwords omitted)."""
    _get_workspace(workspace_id, user, db)

    connections = connection_service.get_connections(db, workspace_id)
    return [
        ConnectionResponse(
            id=str(c.id),
            name=c.name,
            conn_type=c.conn_type,
            host=c.host,
            port=c.port,
            database=c.database,
            username=c.username,
        )
        for c in connections
    ]


@router.post("/{workspace_id}", response_model=ConnectionResponse, status_code=201)
def create_connection(
    workspace_id: str,
    body: SaveConnectionRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> ConnectionResponse:
    """Save a new external connection configuration."""
    _get_workspace(workspace_id, user, db)

    conn = connection_service.save_connection(
        db_session=db,
        workspace_id=workspace_id,
        name=body.name,
        conn_type=body.conn_type,
        host=body.host,
        port=body.port,
        database=body.database,
        username=body.username,
        password=body.password,
    )
    return ConnectionResponse(
        id=str(conn.id),
        name=conn.name,
        conn_type=conn.conn_type,
        host=conn.host,
        port=conn.port,
        database=conn.database,
        username=conn.username,
    )


@router.delete("/{workspace_id}/{connection_id}", status_code=204)
def delete_connection(
    workspace_id: str,
    connection_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> Response:
    """Delete a saved external connection."""
    _get_workspace(workspace_id, user, db)

    deleted = connection_service.delete_connection(db, workspace_id, connection_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Connection not found")
    return Response(status_code=204)


@router.post("/{workspace_id}/{connection_id}/tables", response_model=TablesResponse)
def list_tables_from_saved_connection(
    workspace_id: str,
    connection_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> TablesResponse:
    """List tables from a saved connection (password decrypted automatically)."""
    _get_workspace(workspace_id, user, db)

    # Find the saved connection
    connections = connection_service.get_connections(db, workspace_id)
    try:
        conn_uuid = _uuid.UUID(connection_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Connection not found")

    record = next((c for c in connections if c.id == conn_uuid), None)
    if record is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    # Decrypt password if present
    password: str | None = None
    if record.password_encrypted:
        try:
            password = connection_service._decrypt(record.password_encrypted)
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail="Failed to decrypt stored password"
            ) from exc

    try:
        tables = connection_service.list_external_tables(
            conn_type=record.conn_type,
            host=record.host,
            port=record.port,
            database=record.database,
            username=record.username,
            password=password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return TablesResponse(tables=tables)
