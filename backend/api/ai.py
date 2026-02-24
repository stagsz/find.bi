"""AI API routes: text-to-SQL and related AI endpoints."""

import os
from typing import Any

import duckdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.user import User
from models.workspace import Workspace
from services.ai_service import text_to_sql
from services.duckdb_service import list_tables

DUCKDB_PATH = os.environ.get("DUCKDB_PATH", "/data/workspaces")

router = APIRouter(prefix="/api/ai", tags=["ai"])


class TextToSqlRequest(BaseModel):
    question: str
    workspace_id: str


class TextToSqlResponse(BaseModel):
    sql: str
    explanation: str


def _get_workspace_db_path(
    workspace_id: str,
    user: User,
    db: Session,
) -> str:
    """Validate workspace ownership and return its DuckDB path."""
    import uuid as _uuid

    try:
        ws_uuid = _uuid.UUID(workspace_id)
    except ValueError:
        raise HTTPException(
            status_code=404, detail="Workspace not found",
        )

    workspace = (
        db.query(Workspace)
        .filter(Workspace.id == ws_uuid, Workspace.owner_id == user.id)
        .first()
    )
    if workspace is None:
        raise HTTPException(
            status_code=404, detail="Workspace not found",
        )
    return str(workspace.duckdb_path)


def _fetch_sample_rows(
    db_path: str,
    table_names: list[str],
    max_rows: int = 50,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch sample rows from each table in the workspace DuckDB.

    Returns a dict mapping table names to lists of row dicts (up to
    ``max_rows`` per table). Returns empty dict if the DB file doesn't
    exist or a table can't be read.
    """
    if not os.path.isfile(db_path):
        return {}

    result: dict[str, list[dict[str, Any]]] = {}
    conn = duckdb.connect(db_path, read_only=True)
    try:
        for table_name in table_names:
            try:
                rows = conn.execute(
                    f'SELECT * FROM "{table_name}" LIMIT {max_rows}'
                ).fetchall()
                columns = [
                    desc[0]
                    for desc in conn.execute(
                        f'SELECT * FROM "{table_name}" LIMIT 0'
                    ).description
                ]
                result[table_name] = [
                    dict(zip(columns, row)) for row in rows
                ]
            except duckdb.Error:
                result[table_name] = []
    finally:
        conn.close()

    return result


@router.post("/text-to-sql", response_model=TextToSqlResponse)
def text_to_sql_endpoint(
    body: TextToSqlRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> TextToSqlResponse:
    """Convert a natural language question to SQL using Claude AI.

    Fetches the workspace schema and sample rows from DuckDB, sends
    them to the AI service along with the question, and returns the
    generated SQL query plus an explanation.
    """
    if not body.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    db_path = _get_workspace_db_path(body.workspace_id, user, db)

    # Get schema from DuckDB (returns empty list if DB file doesn't exist)
    if os.path.isfile(db_path):
        try:
            schema = list_tables(db_path)
        except ValueError:
            schema = []
    else:
        schema = []

    if not schema:
        raise HTTPException(
            status_code=400,
            detail="No data tables found in workspace. Upload data first.",
        )

    # Fetch sample rows for AI context
    table_names = [t["table_name"] for t in schema]
    sample_rows = _fetch_sample_rows(db_path, table_names)

    try:
        result = text_to_sql(body.question, schema, sample_rows)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return TextToSqlResponse(
        sql=result["sql"],
        explanation=result["explanation"],
    )
