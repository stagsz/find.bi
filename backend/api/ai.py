"""AI API routes: text-to-SQL and related AI endpoints."""

import os
import uuid as _uuid
from typing import Any

import duckdb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.auth import get_authenticated_user
from db import get_db
from models.insight_cache import InsightCache
from models.user import User
from models.workspace import Workspace
from services.ai_service import chat as ai_chat
from services.ai_service import generate_deck as ai_generate_deck
from services.ai_service import generate_insights, text_to_sql
from services.duckdb_service import list_tables

DUCKDB_PATH = os.environ.get("DUCKDB_PATH", "/data/workspaces")

router = APIRouter(prefix="/api/ai", tags=["ai"])


class TextToSqlRequest(BaseModel):
    question: str
    workspace_id: str


class TextToSqlResponse(BaseModel):
    sql: str
    explanation: str


class InsightsRequest(BaseModel):
    workspace_id: str


class InsightItem(BaseModel):
    type: str
    title: str
    description: str
    severity: str
    table: str | None = None
    columns: list[str] | None = None
    metrics: dict[str, float] | None = None


class InsightsResponse(BaseModel):
    insights: list[InsightItem]


class CachedInsightEntry(BaseModel):
    table_name: str
    status: str
    insights: list[InsightItem]

    model_config = {"from_attributes": True}


class CachedInsightsResponse(BaseModel):
    entries: list[CachedInsightEntry]


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    workspace_id: str
    history: list[ChatMessage] = []


class DataTable(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class ChatResponse(BaseModel):
    text: str
    sql: str | None = None
    plot_spec: dict[str, Any] | None = None
    data_table: DataTable | None = None


def _get_workspace_db_path(
    workspace_id: str,
    user: User,
    db: Session,
) -> str:
    """Validate workspace ownership and return its DuckDB path."""
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


@router.post("/insights", response_model=InsightsResponse)
def insights_endpoint(
    body: InsightsRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> InsightsResponse:
    """Generate AI insights for a workspace's data using Claude.

    Fetches the workspace schema and sample rows from DuckDB, sends
    them to the AI service, and returns structured insight cards.
    """
    db_path = _get_workspace_db_path(body.workspace_id, user, db)

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

    table_names = [t["table_name"] for t in schema]
    sample_rows = _fetch_sample_rows(db_path, table_names)

    try:
        result = generate_insights(schema, sample_rows)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return InsightsResponse(
        insights=[InsightItem(**i) for i in result["insights"]],
    )


@router.get("/insights/cached", response_model=CachedInsightsResponse)
def cached_insights_endpoint(
    workspace_id: str,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> CachedInsightsResponse:
    """Retrieve cached insights for a workspace.

    Returns all cached insight entries with their status (pending, ready,
    error). Frontend polls this endpoint after upload to check if background
    insight generation is complete.
    """
    # Validate workspace ownership
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

    caches = (
        db.query(InsightCache)
        .filter(InsightCache.workspace_id == ws_uuid)
        .order_by(InsightCache.updated_at.desc())
        .all()
    )

    entries = []
    for cache in caches:
        insights_data = cache.insights_json if cache.insights_json else []
        entries.append(
            CachedInsightEntry(
                table_name=cache.table_name,
                status=cache.status,
                insights=[InsightItem(**i) for i in insights_data],
            )
        )

    return CachedInsightsResponse(entries=entries)


@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(
    body: ChatRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Conversational chat about workspace data using Claude AI.

    Accepts a message and optional conversation history. Claude receives
    full schema context and returns a text response with optional SQL
    and/or Observable Plot chart specification.
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")

    db_path = _get_workspace_db_path(body.workspace_id, user, db)

    # Get schema from DuckDB
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

    # Convert Pydantic models to dicts for the service layer
    history = [{"role": m.role, "content": m.content} for m in body.history]

    try:
        result = ai_chat(body.message, history, schema, sample_rows)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    data_table = result.get("data_table")
    data_table_model = None
    if isinstance(data_table, dict):
        cols = data_table.get("columns")
        rows = data_table.get("rows")
        if isinstance(cols, list) and isinstance(rows, list):
            data_table_model = DataTable(columns=cols, rows=rows)

    return ChatResponse(
        text=result["text"],
        sql=result.get("sql"),
        plot_spec=result.get("plot_spec"),
        data_table=data_table_model,
    )


class DeckRequest(BaseModel):
    workspace_id: str
    user_goal: str = ""


class DeckSlide(BaseModel):
    title: str
    narrative: str
    plot_spec: dict[str, Any] | None = None


class DeckResponse(BaseModel):
    deck_title: str
    summary: str
    slides: list[DeckSlide]


@router.post("/deck", response_model=DeckResponse)
def deck_endpoint(
    body: DeckRequest,
    user: User = Depends(get_authenticated_user),
    db: Session = Depends(get_db),
) -> DeckResponse:
    """Generate a multi-slide analysis deck for workspace data.

    Claude analyzes the full schema and sample data, producing a
    structured deck with title, executive summary, data-driven slides
    (each with optional Observable Plot chart), and recommendations.
    """
    db_path = _get_workspace_db_path(body.workspace_id, user, db)

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

    table_names = [t["table_name"] for t in schema]
    sample_rows = _fetch_sample_rows(db_path, table_names)

    try:
        result = ai_generate_deck(schema, sample_rows, body.user_goal)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return DeckResponse(
        deck_title=result["deck_title"],
        summary=result["summary"],
        slides=[DeckSlide(**s) for s in result["slides"]],
    )
