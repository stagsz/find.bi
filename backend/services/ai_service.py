"""AI service: Claude API client for text-to-SQL and related AI features."""

import json
import logging
import os
from typing import Any, cast

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

# Geo column detection constants
VALID_GEO_COLUMN_TYPES: set[str] = {"lat-lon-pair", "country", "region"}
VALID_MAP_TYPES: set[str] = {
    "map-scatterplot", "map-hexagon", "map-heatmap", "map-arc", "map-geojson",
}

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

GEO_COLUMNS_SYSTEM_PROMPT = """\
You are a geographic data analysis assistant for a Business Intelligence
application. Given a database schema and sample data, identify columns that
contain geographic data.

Return ONLY valid JSON with this structure:
{
  "geo_columns": [
    {
      "type": "lat-lon-pair",
      "lat_column": "column_name",
      "lon_column": "column_name",
      "table": "table_name",
      "suggested_map_type": "map-scatterplot"
    },
    {
      "type": "country",
      "column": "column_name",
      "table": "table_name",
      "suggested_map_type": "map-geojson"
    },
    {
      "type": "region",
      "column": "column_name",
      "table": "table_name",
      "suggested_map_type": "map-geojson"
    }
  ]
}

Types:
- "lat-lon-pair": Two numeric columns that form a latitude/longitude pair.
  Include "lat_column" and "lon_column" fields.
  Suggested map type: "map-scatterplot" (or "map-hexagon"/"map-heatmap" for
  large datasets).
- "country": A string column containing country names or ISO country codes.
  Include "column" field.
  Suggested map type: "map-geojson".
- "region": A string column containing state/province names or region codes.
  Include "column" field.
  Suggested map type: "map-geojson".

Rules:
- Return ONLY valid JSON, no explanation, no markdown fences.
- Only identify columns that clearly contain geographic data based on column
  names AND sample values.
- For lat-lon pairs, verify: latitude values range [-90, 90], longitude values
  range [-180, 180].
- For country/region columns, verify sample values look like real place names
  or codes.
- If no geographic columns are found, return {"geo_columns": []}.
- Each entry must reference real table and column names from the provided
  schema.
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


CHAT_SYSTEM_PROMPT = """\
You are Ralph, a friendly data analysis assistant for a Business Intelligence
application called find.bi. You help users explore and understand their data
through conversation.

You have access to the user's database schema and sample data. You can:
1. Answer questions about the data in plain language.
2. Generate SQL queries when the user asks for specific data.
3. Suggest Observable Plot chart specifications when a visualisation would help.
4. Include inline data tables when showing small result sets directly.

Response format — return ONLY valid JSON with this structure:
{
  "text": "Your conversational response here.",
  "sql": null,
  "plot_spec": null,
  "data_table": null
}

Rules:
- "text" is ALWAYS required — your main conversational response.
  You may use basic markdown in text: `code`, **bold**, *italic*.
- Set "sql" to a DuckDB-compatible SELECT query string when the user asks
  a data question that needs a query. Otherwise set it to null.
- Set "plot_spec" to an Observable Plot specification object when a chart
  would help illustrate your answer. Otherwise set it to null.
- The plot_spec must follow this structure if provided:
  {"marks": [{"type": "<mark_type>", "data": [], "options": {...}}],
   "width": 640, "height": 400}
  Supported mark types: area, areaX, areaY, barX, barY, cell, cellX, cellY,
  dot, dotX, dotY, frame, line, lineX, lineY, link, rect, rectX, rectY,
  ruleX, ruleY, text, textX, textY, tickX, tickY, tip
- Set "data_table" to show tabular data inline. Structure:
  {"columns": ["col1", "col2"], "rows": [["val1", "val2"], ...]}
  Use data_table when showing a small result set (under 20 rows) directly
  in the conversation, e.g. a quick summary or comparison table.
- Do NOT include markdown fences or extra text — return ONLY the JSON object.
- Use DuckDB SQL syntax for queries. Only SELECT queries are allowed.
- Reference only tables and columns that exist in the provided schema.
- Be helpful, concise, and slightly quirky — you're Ralph, after all.
"""


def chat(
    message: str,
    history: list[dict[str, str]],
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    """Conduct a conversational chat turn about the user's data using Claude.

    Parameters
    ----------
    message:
        The user's current message.
    history:
        Previous conversation turns as ``[{"role": "user"|"assistant",
        "content": "..."}]``.
    schema:
        List of table metadata dicts, each with ``table_name``, ``columns``
        (list of ``{name, type}``), and ``row_count``.
    sample_rows:
        Dict mapping table names to lists of sample row dicts (max 50 each).

    Returns
    -------
    dict with keys:
        ``text`` — the main conversational response.
        ``sql`` — an optional SQL query string (or None).
        ``plot_spec`` — an optional Observable Plot spec dict (or None).

    Raises
    ------
    ValueError
        If the API key is missing, the API call fails, or the response
        is not valid JSON.
    """
    client = _get_client()
    schema_context = _build_schema_context(schema, sample_rows)

    # Build the messages array: system context in first user message + history
    context_prefix = (
        f"Database schema and sample data:\n{schema_context}\n"
        "Use this schema to answer my questions about the data.\n\n"
    )

    messages: list[dict[str, Any]] = []
    for i, turn in enumerate(history):
        role = turn.get("role", "user")
        content = turn.get("content", "")
        if i == 0 and role == "user":
            # Prepend schema context to the first user message in history
            content = context_prefix + content
        messages.append({"role": role, "content": content})

    # Add the current message
    current_content = message
    if not messages:
        # No history — prepend schema context to the current message
        current_content = context_prefix + message
    messages.append({"role": "user", "content": current_content})

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=4096,
            system=CHAT_SYSTEM_PROMPT,
            messages=cast(Any, messages),
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

    if not isinstance(parsed, dict):
        raise ValueError("Chat response must be a JSON object")

    text_value = parsed.get("text")
    if not isinstance(text_value, str) or not text_value.strip():
        raise ValueError("Chat response must contain a non-empty 'text' field")

    sql_value = parsed.get("sql")
    if sql_value is not None and not isinstance(sql_value, str):
        sql_value = None

    plot_spec = parsed.get("plot_spec")
    if plot_spec is not None:
        if not isinstance(plot_spec, dict):
            plot_spec = None
        else:
            try:
                plot_spec = _validate_plot_spec(plot_spec)
            except ValueError:
                plot_spec = None

    data_table = parsed.get("data_table")
    if data_table is not None:
        if not isinstance(data_table, dict):
            data_table = None
        else:
            columns = data_table.get("columns")
            rows = data_table.get("rows")
            if (
                not isinstance(columns, list)
                or not isinstance(rows, list)
                or len(columns) == 0
            ):
                data_table = None

    return {
        "text": text_value.strip(),
        "sql": sql_value,
        "plot_spec": plot_spec,
        "data_table": data_table,
    }


DECK_SYSTEM_PROMPT = """\
You are Ralph, a data analyst for a Business Intelligence application called
find.bi. Given a database schema and sample data, produce a multi-slide
analysis deck as a JSON object.

Response format — return ONLY valid JSON with this structure:
{
  "deck_title": "Short title for the entire deck",
  "summary": "One-paragraph executive summary of the analysis.",
  "slides": [
    {
      "title": "Slide title",
      "narrative": "One to three paragraph analysis for this slide.",
      "plot_spec": null
    }
  ]
}

Slide guidelines:
- Generate between 3 and 8 slides depending on data complexity.
- The first slide should be an executive summary (plot_spec: null).
- Middle slides should each focus on one finding, trend, or insight.
- Include an Observable Plot chart for data-driven slides where a visual
  would help. Set plot_spec to null for narrative-only slides.
- The last slide should contain recommendations or next steps.

When providing a plot_spec, use this exact Observable Plot structure:
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
- Embed data directly in each mark's "data" array.
- Reference only tables and columns from the provided schema.
- Be insightful and actionable — focus on what matters most.
- If the user provides a goal, focus the analysis on that goal.
"""


def _validate_deck(parsed: Any) -> dict[str, Any]:
    """Validate and sanitize a deck response from Claude.

    Raises ValueError if the structure is fundamentally invalid.
    Filters out slides with missing required fields.
    """
    if not isinstance(parsed, dict):
        raise ValueError("Deck response must be a JSON object")

    deck_title = parsed.get("deck_title")
    if not isinstance(deck_title, str) or not deck_title.strip():
        raise ValueError("Deck must have a non-empty 'deck_title'")

    summary = parsed.get("summary")
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("Deck must have a non-empty 'summary'")

    slides = parsed.get("slides")
    if not isinstance(slides, list) or len(slides) == 0:
        raise ValueError("Deck must contain a non-empty 'slides' array")

    valid_slides: list[dict[str, Any]] = []
    for slide in slides:
        if not isinstance(slide, dict):
            continue
        title = slide.get("title")
        if not isinstance(title, str) or not title.strip():
            continue
        narrative = slide.get("narrative")
        if not isinstance(narrative, str) or not narrative.strip():
            continue

        # Validate plot_spec if present
        plot_spec = slide.get("plot_spec")
        if plot_spec is not None:
            if not isinstance(plot_spec, dict):
                slide["plot_spec"] = None
            else:
                try:
                    slide["plot_spec"] = _validate_plot_spec(plot_spec)
                except ValueError:
                    slide["plot_spec"] = None

        valid_slides.append(slide)

    if len(valid_slides) == 0:
        raise ValueError(
            "No valid slides found. Each slide must have "
            "a non-empty 'title' and 'narrative'."
        )

    return {
        "deck_title": deck_title.strip(),
        "summary": summary.strip(),
        "slides": valid_slides,
    }


def generate_deck(
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
    user_goal: str = "",
) -> dict[str, Any]:
    """Generate a multi-slide analysis deck from schema and sample data.

    Parameters
    ----------
    schema:
        List of table metadata dicts, each with ``table_name``, ``columns``
        (list of ``{name, type}``), and ``row_count``.
    sample_rows:
        Dict mapping table names to lists of sample row dicts (max 50 each).
    user_goal:
        Optional focus prompt from the user (e.g. "Analyze revenue trends").

    Returns
    -------
    dict with keys:
        ``deck_title`` — title for the entire deck.
        ``summary`` — one-paragraph executive summary.
        ``slides`` — list of validated slide dicts.

    Raises
    ------
    ValueError
        If the API key is missing, the API call fails, or the response
        is not valid JSON / contains no valid slides.
    """
    client = _get_client()
    schema_context = _build_schema_context(schema, sample_rows)

    goal_clause = ""
    if user_goal.strip():
        goal_clause = f"\nUser's analysis goal: {user_goal.strip()}\n"

    user_message = (
        f"Database schema and sample data:\n{schema_context}\n"
        f"{goal_clause}"
        "Generate a complete analysis deck. Return only the JSON object."
    )

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=4096,
            system=DECK_SYSTEM_PROMPT,
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

    return _validate_deck(parsed)


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


def _validate_geo_columns(parsed: Any) -> list[dict[str, Any]]:
    """Validate and sanitize geo column detection results.

    Returns a list of valid geo column dicts. Returns an empty list if
    no valid entries are found (this is not an error — a dataset may have
    no geographic columns).
    """
    if not isinstance(parsed, dict):
        raise ValueError("Geo column response must be a JSON object")

    geo_columns = parsed.get("geo_columns")
    if not isinstance(geo_columns, list):
        raise ValueError("Response must contain a 'geo_columns' array")

    valid: list[dict[str, Any]] = []
    for item in geo_columns:
        if not isinstance(item, dict):
            continue
        col_type = item.get("type")
        if not isinstance(col_type, str) or col_type not in VALID_GEO_COLUMN_TYPES:
            continue
        table = item.get("table")
        if not isinstance(table, str) or not table.strip():
            continue
        suggested = item.get("suggested_map_type")
        if not isinstance(suggested, str) or suggested not in VALID_MAP_TYPES:
            continue

        if col_type == "lat-lon-pair":
            lat_col = item.get("lat_column")
            lon_col = item.get("lon_column")
            if not isinstance(lat_col, str) or not lat_col.strip():
                continue
            if not isinstance(lon_col, str) or not lon_col.strip():
                continue
        else:
            column = item.get("column")
            if not isinstance(column, str) or not column.strip():
                continue

        valid.append(item)

    return valid


VALID_VOICE_INTENTS: set[str] = {"query", "filter", "export", "narrate", "navigate"}

INTENT_SYSTEM_PROMPT = """\
You are an intent classifier for a voice assistant in a Business Intelligence
application called find.bi. Given a transcribed voice command, classify it into
exactly one intent category.

Intent categories:
- "query": The user is asking a data question or requesting analysis.
  Examples: "What is total revenue by region?", "Show me sales trends",
  "How many orders last quarter?", "Compare profit margins"
- "filter": The user wants to change a dashboard filter or scope.
  Examples: "Show only Q4 data", "Filter by North region",
  "Change date range to last month", "Remove the product filter"
- "export": The user wants to download or export data.
  Examples: "Export as CSV", "Download this chart", "Save as PDF",
  "Email me this report"
- "narrate": The user wants the dashboard read aloud or summarised vocally.
  Examples: "Narrate this dashboard", "Read me the charts",
  "Summarise what I'm looking at", "Tell me about these numbers"
- "navigate": The user wants to go to a different page or view.
  Examples: "Go to the sales dashboard", "Open the SQL editor",
  "Take me to upload page", "Switch to the home page"

Return ONLY valid JSON with this structure:
{
  "intent": "<category>",
  "confidence": <0.0 to 1.0>,
  "entities": {}
}

Rules:
- "intent" must be exactly one of: query, filter, export, narrate, navigate.
- "confidence" is your certainty from 0.0 (uncertain) to 1.0 (certain).
- "entities" is an optional dict of extracted parameters. Examples:
  - For filter: {"column": "region", "value": "North"}
  - For navigate: {"page": "sql-editor"}
  - For export: {"format": "csv"}
  - For query/narrate: {} (empty is fine)
- Return ONLY the JSON object, no markdown fences, no extra text.
- If the transcript is ambiguous, pick the most likely intent and lower
  confidence accordingly.
"""


def _validate_intent_result(parsed: Any) -> dict[str, Any]:
    """Validate and sanitize an intent classification result.

    Raises ValueError if the result is fundamentally invalid.
    """
    if not isinstance(parsed, dict):
        raise ValueError("Intent result must be a JSON object")

    intent = parsed.get("intent")
    if not isinstance(intent, str) or intent not in VALID_VOICE_INTENTS:
        raise ValueError(
            f"Intent must be one of {sorted(VALID_VOICE_INTENTS)}, "
            f"got: {intent!r}"
        )

    confidence = parsed.get("confidence")
    if isinstance(confidence, int):
        confidence = float(confidence)
    if not isinstance(confidence, float) or not (0.0 <= confidence <= 1.0):
        # Default to 0.5 if confidence is missing or out of range
        confidence = 0.5

    entities = parsed.get("entities")
    if not isinstance(entities, dict):
        entities = {}

    return {
        "intent": intent,
        "confidence": confidence,
        "entities": entities,
    }


def classify_voice_intent(transcript: str) -> dict[str, Any]:
    """Classify a voice transcript into one of five intent categories.

    Parameters
    ----------
    transcript:
        The transcribed text from the user's voice command.

    Returns
    -------
    dict with keys:
        ``intent`` — one of: query, filter, export, narrate, navigate.
        ``confidence`` — float from 0.0 to 1.0.
        ``entities`` — optional dict of extracted parameters.

    Raises
    ------
    ValueError
        If the transcript is empty, the API key is missing, the API call
        fails, or the response is not valid JSON with a valid intent.
    """
    if not transcript.strip():
        raise ValueError("Transcript must not be empty")

    client = _get_client()

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=256,
            system=INTENT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": transcript.strip()}],
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

    return _validate_intent_result(parsed)


def detect_geo_columns(
    schema: list[dict[str, Any]],
    sample_rows: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    """Detect geographic columns in the dataset using Claude.

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
        ``geo_columns`` — list of validated geo column dicts. Each dict has
        ``type``, ``table``, ``suggested_map_type``, and either
        ``lat_column``/``lon_column`` (for lat-lon pairs) or ``column``
        (for country/region).

    Raises
    ------
    ValueError
        If the API key is missing, the API call fails, or the response
        is not valid JSON.
    """
    client = _get_client()
    schema_context = _build_schema_context(schema, sample_rows)

    user_message = (
        f"Database schema and sample data:\n{schema_context}\n"
        "Identify any geographic columns in this data. "
        "Return only the JSON object."
    )

    try:
        response = client.messages.create(
            model=_get_model(),
            max_tokens=2048,
            system=GEO_COLUMNS_SYSTEM_PROMPT,
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

    geo_columns = _validate_geo_columns(parsed)

    return {"geo_columns": geo_columns}
