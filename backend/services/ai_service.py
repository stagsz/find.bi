"""AI service: Claude API client for text-to-SQL and related AI features."""

import json
import logging
import os
from typing import Any

import anthropic
import duckdb

logger = logging.getLogger(__name__)


def _get_api_key() -> str:
    """Read ANTHROPIC_API_KEY from environment at call time."""
    return os.environ.get("ANTHROPIC_API_KEY", "")


def _get_model() -> str:
    """Read AI model from environment at call time."""
    return os.environ.get("AI_MODEL", "claude-sonnet-4-6")


def _get_client() -> anthropic.Anthropic:
    """Create an Anthropic client, raising ValueError if no API key."""
    key = _get_api_key()
    if not key:
        raise ValueError(
            "ANTHROPIC_API_KEY environment variable is not set. "
            "AI features require a valid Anthropic API key."
        )
    return anthropic.Anthropic(api_key=key)


def _build_schema_context(
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
) -> str:
    """Format schema and sample rows into a context string for the prompt."""
    parts: list[str] = []
    for table in schema:
        table_name = table["table_name"]
        columns = table.get("columns", [])
        row_count = table.get("row_count", 0)

        col_defs = ", ".join(
            f'{c["name"]} ({c["type"]})' for c in columns
        )
        parts.append(f"Table: {table_name} ({row_count} rows)")
        parts.append(f"  Columns: {col_defs}")

        rows = sample_rows.get(table_name, [])
        if rows:
            parts.append(f"  Sample rows (first {len(rows)}):")
            for row in rows[:5]:
                parts.append(f"    {row}")
            if len(rows) > 5:
                parts.append(f"    ... ({len(rows)} total sample rows)")
        parts.append("")

    return "\n".join(parts)


SYSTEM_PROMPT = """\
You are a SQL expert assistant for a Business Intelligence application.
The user's data is stored in DuckDB. You generate SQL queries from natural
language questions.

Rules:
- Return ONLY the SQL query, no explanation, no markdown fences.
- Use DuckDB SQL syntax (compatible with PostgreSQL with extensions).
- Reference only tables and columns that exist in the provided schema.
- Use appropriate aggregations, JOINs, and filters based on the question.
- Limit results to 1000 rows unless the user asks for a specific count.
- Do NOT use INSERT, UPDATE, DELETE, DROP, ALTER, or any DDL/DML statements.
  Only SELECT queries are allowed.
"""

# Mark types supported by the frontend PlotRenderer (must stay in sync).
SUPPORTED_MARK_TYPES: set[str] = {
    "area", "areaX", "areaY", "barX", "barY",
    "cell", "cellX", "cellY",
    "dot", "dotX", "dotY",
    "frame",
    "line", "lineX", "lineY",
    "link",
    "rect", "rectX", "rectY",
    "ruleX", "ruleY",
    "text", "textX", "textY",
    "tickX", "tickY",
    "tip",
}

PLOT_SYSTEM_PROMPT = """\
You are a data visualisation assistant for a Business Intelligence application.
Given a user question and the result of a SQL query, generate an Observable Plot
chart specification as JSON.

The specification must follow this exact structure:
{
  "marks": [
    {
      "type": "<mark_type>",
      "data": [ ... ],
      "options": { "x": "<column>", "y": "<column>", ... }
    }
  ],
  "width": 640,
  "height": 400,
  "x": { "label": "X Axis Label" },
  "y": { "label": "Y Axis Label" }
}

Supported mark types:
  area, areaX, areaY, barX, barY, cell, cellX, cellY,
  dot, dotX, dotY, frame, line, lineX, lineY, link,
  rect, rectX, rectY, ruleX, ruleY, text, textX, textY,
  tickX, tickY, tip

Rules:
- Return ONLY valid JSON, no explanation, no markdown fences.
- Choose the most appropriate mark type for the data and question.
- Embed the full query result rows in the mark's "data" array.
- Use column names from the query result as keys in "options" (x, y, fill, etc.).
- Keep the spec minimal — only include options that are needed.
- For categorical comparisons use barY or barX.
- For trends over time use line.
- For distributions use dot or rect.
- For parts of a whole, consider cell or barY with stacking.
"""


VALID_INSIGHT_TYPES: set[str] = {"trend", "anomaly", "correlation", "outlier"}
VALID_SEVERITY_LEVELS: set[str] = {"info", "warning", "important"}

INSIGHTS_SYSTEM_PROMPT = """\
You are a data analyst assistant for a Business Intelligence application.
Given a database schema and sample data, generate actionable insights about
the data: trends, anomalies, correlations, and outliers.

Return ONLY a JSON array of insight objects. Each object must have:
{
  "type": "trend" | "anomaly" | "correlation" | "outlier",
  "title": "Short, descriptive title",
  "description": "One to two sentence explanation of the insight",
  "severity": "info" | "warning" | "important",
  "table": "table_name",
  "columns": ["column1", "column2"],
  "metrics": { ... optional supporting numbers ... }
}

Rules:
- Return ONLY valid JSON (an array), no explanation, no markdown fences.
- Generate between 3 and 10 insights depending on dataset complexity.
- Focus on the most interesting and actionable findings.
- Each insight must reference real table and column names from the schema.
- Use "important" severity sparingly — only for critical findings.
- Metrics should contain numeric values that support the insight.
"""


def _validate_insights(insights: Any) -> list[dict[str, Any]]:
    """Validate and sanitize a list of insight dicts.

    Raises ValueError if the input is fundamentally invalid.
    Filters out insights with missing or invalid required fields.
    """
    if not isinstance(insights, list):
        raise ValueError("Insights must be a JSON array")

    if len(insights) == 0:
        raise ValueError("Insights array must not be empty")

    valid: list[dict[str, Any]] = []
    for item in insights:
        if not isinstance(item, dict):
            continue
        insight_type = item.get("type")
        if not isinstance(insight_type, str) or insight_type not in VALID_INSIGHT_TYPES:
            continue
        severity = item.get("severity")
        if not isinstance(severity, str) or severity not in VALID_SEVERITY_LEVELS:
            continue
        title = item.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        description = item.get("description")
        if not isinstance(description, str) or not description.strip():
            continue
        valid.append(item)

    if len(valid) == 0:
        raise ValueError(
            "No valid insights found. Each insight must have type "
            f"({sorted(VALID_INSIGHT_TYPES)}), severity "
            f"({sorted(VALID_SEVERITY_LEVELS)}), title, and description."
        )

    return valid


def generate_insights(
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    """Generate data insights from schema and sample data using Claude.

    Parameters
    ----------
    schema:
        List of table metadata dicts, each with ``table_name``, ``columns``
        (list of ``{name, type}``), and ``row_count``.
    sample_rows:
        Dict mapping table names to lists of sample row dicts (max 50 each).

    Returns
    -------
    dict with keys:
        ``insights`` — list of validated insight dicts.

    Raises
    ------
    ValueError
        If the API key is missing, the API call fails, or the response
        is not valid JSON / contains no valid insights.
    """
    client = _get_client()
    schema_context = _build_schema_context(schema, sample_rows)

    user_message = (
        f"Database schema and sample data:\n{schema_context}\n"
        "Analyze this data and generate insights. "
        "Return only the JSON array of insight objects."
    )

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=4096,
            system=INSIGHTS_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as exc:
        raise ValueError(f"Claude API error: {exc}") from exc

    raw = ""
    for block in response.content:
        if block.type == "text":
            raw = block.text.strip()
            break

    raw = _extract_json(raw)

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned invalid JSON: {exc}") from exc

    insights = _validate_insights(parsed)

    return {"insights": insights}


def generate_and_cache_insights(
    workspace_id: str,
    table_name: str,
    db_path: str,
) -> None:
    """Background task: generate insights for a table and cache in PostgreSQL.

    Called by FastAPI BackgroundTasks after file ingestion. Fetches schema and
    sample rows from DuckDB, calls Claude, and stores the result in the
    insight_caches table.
    """
    import uuid as _uuid

    from db import SessionLocal
    from models.insight_cache import InsightCache
    from services.duckdb_service import list_tables

    ws_uuid = _uuid.UUID(workspace_id)

    session = SessionLocal()
    try:
        # Upsert: find existing cache row or create a new one
        cache_row = (
            session.query(InsightCache)
            .filter(
                InsightCache.workspace_id == ws_uuid,
                InsightCache.table_name == table_name,
            )
            .first()
        )
        if cache_row is None:
            cache_row = InsightCache(
                workspace_id=ws_uuid,
                table_name=table_name,
                status="pending",
                insights_json=[],
            )
            session.add(cache_row)
        else:
            cache_row.status = "pending"
            cache_row.insights_json = []
        session.commit()

        # Fetch schema and sample rows from DuckDB
        if not os.path.isfile(db_path):
            cache_row.status = "error"
            session.commit()
            return

        try:
            schema = list_tables(db_path)
        except ValueError:
            cache_row.status = "error"
            session.commit()
            return

        if not schema:
            cache_row.status = "error"
            session.commit()
            return

        # Fetch sample rows for the specific table
        sample_rows: dict[str, list[dict[str, Any]]] = {}
        conn = duckdb.connect(db_path, read_only=True)
        try:
            for table in schema:
                tname = table["table_name"]
                try:
                    rows = conn.execute(
                        f'SELECT * FROM "{tname}" LIMIT 50'
                    ).fetchall()
                    columns = [
                        desc[0]
                        for desc in conn.execute(
                            f'SELECT * FROM "{tname}" LIMIT 0'
                        ).description
                    ]
                    sample_rows[tname] = [
                        dict(zip(columns, row)) for row in rows
                    ]
                except duckdb.Error:
                    sample_rows[tname] = []
        finally:
            conn.close()

        # Generate insights via Claude
        result = generate_insights(schema, sample_rows)

        cache_row.status = "ready"
        cache_row.insights_json = result["insights"]
        session.commit()

    except Exception:
        logger.exception(
            "Background insight generation failed for table %s",
            table_name,
        )
        session.rollback()
        # Try to mark as error
        try:
            cache_row = (
                session.query(InsightCache)
                .filter(
                    InsightCache.workspace_id == ws_uuid,
                    InsightCache.table_name == table_name,
                )
                .first()
            )
            if cache_row is not None:
                cache_row.status = "error"
                session.commit()
        except Exception:
            session.rollback()
    finally:
        session.close()


def text_to_sql(
    question: str,
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, str]:
    """Convert a natural language question to a SQL query using Claude.

    Parameters
    ----------
    question:
        The user's natural language question about their data.
    schema:
        List of table metadata dicts, each with ``table_name``, ``columns``
        (list of ``{name, type}``), and ``row_count``.
    sample_rows:
        Dict mapping table names to lists of sample row dicts (max 50 each).

    Returns
    -------
    dict with keys:
        ``sql`` — the generated SQL query string.
        ``explanation`` — a brief explanation of what the query does.

    Raises
    ------
    ValueError
        If the API key is missing or the API call fails.
    """
    client = _get_client()
    schema_context = _build_schema_context(schema, sample_rows)

    user_message = (
        f"Database schema:\n{schema_context}\n"
        f"Question: {question}\n\n"
        "Return only the SQL query."
    )

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=2048,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as exc:
        raise ValueError(f"Claude API error: {exc}") from exc

    sql = ""
    for block in response.content:
        if block.type == "text":
            sql = block.text.strip()
            break

    # Strip markdown code fences if model included them despite instructions
    if sql.startswith("```"):
        lines = sql.split("\n")
        # Remove first line (```sql or ```) and last line (```)
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        sql = "\n".join(lines).strip()

    # Generate explanation in a second lightweight call
    try:
        explain_response = client.messages.create(
            model=_get_model(),
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Briefly explain in one sentence what this SQL "
                        f"query does:\n{sql}"
                    ),
                },
            ],
        )
        explanation = ""
        for block in explain_response.content:
            if block.type == "text":
                explanation = block.text.strip()
                break
    except anthropic.APIError:
        explanation = ""

    return {"sql": sql, "explanation": explanation}


def _extract_json(text: str) -> str:
    """Strip markdown code fences from a JSON string if present."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [ln for ln in lines if not ln.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return text


def _validate_plot_spec(spec: Any) -> dict[str, Any]:
    """Validate and sanitize a Plot spec dict.

    Raises ValueError if the spec is fundamentally invalid.
    Removes marks with unsupported types.
    """
    if not isinstance(spec, dict):
        raise ValueError("Plot spec must be a JSON object")

    marks = spec.get("marks")
    if not isinstance(marks, list) or len(marks) == 0:
        raise ValueError("Plot spec must contain a non-empty 'marks' array")

    valid_marks: list[dict[str, Any]] = []
    for mark in marks:
        if not isinstance(mark, dict):
            continue
        mark_type = mark.get("type")
        if not isinstance(mark_type, str):
            continue
        if mark_type not in SUPPORTED_MARK_TYPES:
            continue
        valid_marks.append(mark)

    if len(valid_marks) == 0:
        raise ValueError(
            "Plot spec contains no marks with supported types. "
            f"Supported: {sorted(SUPPORTED_MARK_TYPES)}"
        )

    spec["marks"] = valid_marks
    return spec


def generate_plot_spec(
    question: str,
    query_result: dict[str, Any],
) -> dict[str, Any]:
    """Generate an Observable Plot spec from a query result using Claude.

    Parameters
    ----------
    question:
        The user's original natural language question.
    query_result:
        Dict with ``columns`` (list of column name strings) and ``rows``
        (list of row lists, where each inner list has values positionally
        matching the columns).

    Returns
    -------
    dict with keys:
        ``spec`` — the validated Observable Plot spec dict.
        ``explanation`` — a brief description of the generated chart.

    Raises
    ------
    ValueError
        If the API key is missing, the API call fails, or the response
        is not valid JSON / a valid Plot spec.
    """
    client = _get_client()

    columns: list[str] = query_result.get("columns", [])
    rows: list[list[Any]] = query_result.get("rows", [])

    # Convert columnar rows into list-of-dicts for Claude
    row_dicts = [dict(zip(columns, row)) for row in rows]

    # Build data context — show columns + first few sample rows
    sample = row_dicts[:10]
    data_context = (
        f"Columns: {columns}\n"
        f"Total rows: {len(row_dicts)}\n"
        f"Sample rows (first {len(sample)}):\n"
    )
    for row in sample:
        data_context += f"  {row}\n"

    user_message = (
        f"Question: {question}\n\n"
        f"Query result:\n{data_context}\n"
        f"Full data ({len(row_dicts)} rows) is available — embed all rows "
        f"in the mark's data array.\n\n"
        f"Generate the Observable Plot spec JSON."
    )

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=4096,
            system=PLOT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )
    except anthropic.APIError as exc:
        raise ValueError(f"Claude API error: {exc}") from exc

    raw = ""
    for block in response.content:
        if block.type == "text":
            raw = block.text.strip()
            break

    raw = _extract_json(raw)

    try:
        spec = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Claude returned invalid JSON: {exc}") from exc

    spec = _validate_plot_spec(spec)

    # Inject full row data into marks that don't already have it
    for mark in spec["marks"]:
        if not mark.get("data"):
            mark["data"] = row_dicts

    # Generate explanation in a second lightweight call
    try:
        explain_response = client.messages.create(
            model=_get_model(),
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Briefly explain in one sentence what this chart "
                        f"shows:\nQuestion: {question}\n"
                        f"Chart type: {spec['marks'][0]['type']}"
                    ),
                },
            ],
        )
        explanation = ""
        for block in explain_response.content:
            if block.type == "text":
                explanation = block.text.strip()
                break
    except anthropic.APIError:
        explanation = ""

    return {"spec": spec, "explanation": explanation}
