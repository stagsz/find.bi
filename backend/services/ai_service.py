"""AI service: Claude API client for text-to-SQL and related AI features."""

import os
from typing import Any

import anthropic


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
