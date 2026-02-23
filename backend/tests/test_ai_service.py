"""Tests for AI service: text_to_sql with mocked Anthropic API."""

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

# Sample schema and data used across tests
SAMPLE_SCHEMA: list[dict[str, Any]] = [
    {
        "table_name": "sales",
        "columns": [
            {"name": "region", "type": "string"},
            {"name": "revenue", "type": "float"},
            {"name": "quantity", "type": "integer"},
        ],
        "row_count": 1000,
    },
    {
        "table_name": "products",
        "columns": [
            {"name": "id", "type": "integer"},
            {"name": "name", "type": "string"},
            {"name": "price", "type": "float"},
        ],
        "row_count": 50,
    },
]

SAMPLE_ROWS: dict[str, list[dict[str, Any]]] = {
    "sales": [
        {"region": "North", "revenue": 1500.0, "quantity": 10},
        {"region": "South", "revenue": 2300.0, "quantity": 15},
    ],
    "products": [
        {"id": 1, "name": "Widget", "price": 9.99},
        {"id": 2, "name": "Gadget", "price": 19.99},
    ],
}


def _mock_text_block(text: str) -> MagicMock:
    """Create a mock content block with type='text'."""
    block = MagicMock()
    block.type = "text"
    block.text = text
    return block


def _mock_response(text: str) -> MagicMock:
    """Create a mock Anthropic message response."""
    resp = MagicMock()
    resp.content = [_mock_text_block(text)]
    return resp


# ---------------------------------------------------------------------------
# text_to_sql tests
# ---------------------------------------------------------------------------


class TestTextToSql:
    """Tests for the text_to_sql function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_sql_and_explanation(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """text_to_sql returns dict with sql and explanation keys."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT region, SUM(revenue) FROM sales GROUP BY region"),
            _mock_response("Sums revenue by region from sales table."),
        ]

        result = text_to_sql(
            "What is total revenue by region?",
            SAMPLE_SCHEMA,
            SAMPLE_ROWS,
        )

        assert "sql" in result
        assert "explanation" in result
        assert "SELECT" in result["sql"]
        assert result["explanation"] != ""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences are stripped from the SQL output."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced_sql = "```sql\nSELECT * FROM sales\n```"
        mock_client.messages.create.side_effect = [
            _mock_response(fenced_sql),
            _mock_response("Selects all rows from sales."),
        ]

        result = text_to_sql("Show all sales", SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert "```" not in result["sql"]
        assert "SELECT * FROM sales" in result["sql"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_plain_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Plain ``` fences (without language tag) are stripped."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced_sql = "```\nSELECT COUNT(*) FROM products\n```"
        mock_client.messages.create.side_effect = [
            _mock_response(fenced_sql),
            _mock_response("Counts products."),
        ]

        result = text_to_sql("How many products?", SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert "```" not in result["sql"]
        assert "SELECT COUNT(*) FROM products" in result["sql"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when API key is not set."""
        from services.ai_service import text_to_sql

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            text_to_sql("any question", SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when the Claude API returns an error."""
        import anthropic as anthropic_mod

        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic_mod.APIError(
            message="rate limited",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            text_to_sql("any question", SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_calls_api_with_correct_model(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the API is called with the configured model."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args_list[0]
        assert call_args.kwargs["model"] is not None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_schema_in_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the schema context is included in the API call."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args_list[0]
        messages = call_args.kwargs["messages"]
        user_content = messages[0]["content"]
        assert "sales" in user_content
        assert "products" in user_content
        assert "revenue" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies a system prompt is sent with SQL-only instructions."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args_list[0]
        system = call_args.kwargs["system"]
        assert "SQL" in system
        assert "SELECT" in system

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_explanation_empty_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Explanation is empty string if the second API call fails."""
        import anthropic as anthropic_mod

        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            anthropic_mod.APIError(
                message="server error",
                request=MagicMock(),
                body=None,
            ),
        ]

        result = text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["sql"] == "SELECT 1"
        assert result["explanation"] == ""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_includes_sample_rows_in_context(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Sample rows are included in the schema context."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args_list[0]
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "North" in user_content
        assert "Widget" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_handles_empty_schema(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Works with empty schema (no tables)."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        result = text_to_sql("test", [], {})

        assert result["sql"] == "SELECT 1"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_max_tokens_set(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies max_tokens is set on the API call."""
        from services.ai_service import text_to_sql

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("SELECT 1"),
            _mock_response("Returns 1."),
        ]

        text_to_sql("test", SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args_list[0]
        assert call_args.kwargs["max_tokens"] > 0


# ---------------------------------------------------------------------------
# _build_schema_context tests
# ---------------------------------------------------------------------------


class TestBuildSchemaContext:
    """Tests for the schema context builder."""

    def test_includes_table_names(self) -> None:
        """Schema context includes all table names."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context(SAMPLE_SCHEMA, SAMPLE_ROWS)
        assert "sales" in ctx
        assert "products" in ctx

    def test_includes_column_info(self) -> None:
        """Schema context includes column names and types."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context(SAMPLE_SCHEMA, SAMPLE_ROWS)
        assert "region (string)" in ctx
        assert "revenue (float)" in ctx
        assert "price (float)" in ctx

    def test_includes_row_count(self) -> None:
        """Schema context includes row counts."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context(SAMPLE_SCHEMA, SAMPLE_ROWS)
        assert "1000 rows" in ctx
        assert "50 rows" in ctx

    def test_includes_sample_data(self) -> None:
        """Schema context includes sample row data."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context(SAMPLE_SCHEMA, SAMPLE_ROWS)
        assert "North" in ctx
        assert "Widget" in ctx

    def test_handles_empty_schema(self) -> None:
        """Returns empty string for empty schema."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context([], {})
        assert ctx == ""

    def test_handles_missing_sample_rows(self) -> None:
        """Works when sample_rows dict has no matching table."""
        from services.ai_service import _build_schema_context

        ctx = _build_schema_context(SAMPLE_SCHEMA, {})
        assert "sales" in ctx
        assert "Sample rows" not in ctx

    def test_truncates_large_sample(self) -> None:
        """Shows first 5 sample rows and a count for larger samples."""
        from services.ai_service import _build_schema_context

        many_rows = [{"region": f"R{i}", "revenue": i} for i in range(20)]
        ctx = _build_schema_context(
            SAMPLE_SCHEMA, {"sales": many_rows, "products": []},
        )
        assert "20 total sample rows" in ctx


# ---------------------------------------------------------------------------
# _get_client tests
# ---------------------------------------------------------------------------


class TestGetClient:
    """Tests for the client factory."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_key(self) -> None:
        """Raises ValueError when API key is empty."""
        from services.ai_service import _get_client

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            _get_client()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "sk-ant-test"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_creates_client_with_key(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Creates Anthropic client with the configured API key."""
        from services.ai_service import _get_client

        _get_client()
        mock_anthropic_cls.assert_called_once_with(api_key="sk-ant-test")
