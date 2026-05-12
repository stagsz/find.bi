"""Scheduler API: manage APScheduler cron refresh jobs per workspace."""

from __future__ import annotations

import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.user import User
from models.workspace import Workspace
from services.scheduler_service import (
    add_refresh_job,
    list_jobs,
    remove_refresh_job,
)

router = APIRouter(prefix="/api/scheduler", tags=["scheduler"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class AddJobRequest(BaseModel):
    table_name: str
    cron_expr: str


class JobResponse(BaseModel):
    job_id: str
    table_name: str
    cron_expr: str


class JobSummary(BaseModel):
    job_id: str
    name: str
    next_run_time: str | None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _require_workspace(
    workspace_id: str,
    user: User,
    db: Session,
) -> Workspace:
    """Return workspace if owned by user, else raise 404."""
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


@router.post("/{workspace_id}/jobs", response_model=JobResponse, status_code=201)
def create_job(
    workspace_id: str,
    body: AddJobRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> JobResponse:
    """Schedule a cron refresh job for a workspace table."""
    _require_workspace(workspace_id, user, db)
    try:
        job_id = add_refresh_job(workspace_id, body.table_name, body.cron_expr)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return JobResponse(
        job_id=job_id,
        table_name=body.table_name,
        cron_expr=body.cron_expr,
    )


@router.get("/{workspace_id}/jobs", response_model=list[JobSummary])
def get_jobs(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> list[JobSummary]:
    """List all scheduled jobs for a workspace."""
    _require_workspace(workspace_id, user, db)
    all_jobs = list_jobs()
    # Filter to jobs that belong to this workspace (named with workspace_id prefix)
    prefix = workspace_id
    return [
        JobSummary(
            job_id=j["job_id"],
            name=j["name"],
            next_run_time=j["next_run_time"],
        )
        for j in all_jobs
        if j["job_id"].startswith(prefix)
    ]


@router.delete("/{workspace_id}/jobs/{job_id}", status_code=204)
def delete_job(
    workspace_id: str,
    job_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> None:
    """Remove a scheduled refresh job."""
    _require_workspace(workspace_id, user, db)
    removed = remove_refresh_job(job_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Job not found")
