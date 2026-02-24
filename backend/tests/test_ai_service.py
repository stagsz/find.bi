"""Tests for AI service: text_to_sql, generate_plot_spec, and generate_insights."""

import json
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


# ---------------------------------------------------------------------------
# Query result fixtures for generate_plot_spec tests
# ---------------------------------------------------------------------------

QUERY_RESULT: dict[str, Any] = {
    "columns": ["region", "revenue"],
    "rows": [
        ["North", 1500.0],
        ["South", 2300.0],
        ["East", 1800.0],
    ],
}

VALID_PLOT_SPEC_JSON = json.dumps({
    "marks": [
        {
            "type": "barY",
            "data": [
                {"region": "North", "revenue": 1500.0},
                {"region": "South", "revenue": 2300.0},
                {"region": "East", "revenue": 1800.0},
            ],
            "options": {"x": "region", "y": "revenue"},
        },
    ],
    "width": 640,
    "height": 400,
    "x": {"label": "Region"},
    "y": {"label": "Revenue"},
})


# ---------------------------------------------------------------------------
# generate_plot_spec tests
# ---------------------------------------------------------------------------


class TestGeneratePlotSpec:
    """Tests for the generate_plot_spec function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_spec_and_explanation(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """generate_plot_spec returns dict with spec and explanation."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response(VALID_PLOT_SPEC_JSON),
            _mock_response("Bar chart showing revenue by region."),
        ]

        result = generate_plot_spec(
            "What is revenue by region?", QUERY_RESULT,
        )

        assert "spec" in result
        assert "explanation" in result
        assert result["spec"]["marks"][0]["type"] == "barY"
        assert result["explanation"] != ""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences_from_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences around JSON are stripped."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced = f"```json\n{VALID_PLOT_SPEC_JSON}\n```"
        mock_client.messages.create.side_effect = [
            _mock_response(fenced),
            _mock_response("A bar chart."),
        ]

        result = generate_plot_spec("revenue by region", QUERY_RESULT)

        assert result["spec"]["marks"][0]["type"] == "barY"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_unsupported_mark_types(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Marks with unsupported types are removed from the spec."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        spec_with_bad_mark = json.dumps({
            "marks": [
                {
                    "type": "barY", "data": [],
                    "options": {"x": "region", "y": "revenue"},
                },
                {"type": "invalidMark", "data": [], "options": {}},
            ],
        })
        mock_client.messages.create.side_effect = [
            _mock_response(spec_with_bad_mark),
            _mock_response("A bar chart."),
        ]

        result = generate_plot_spec("test", QUERY_RESULT)

        assert len(result["spec"]["marks"]) == 1
        assert result["spec"]["marks"][0]["type"] == "barY"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_when_all_marks_unsupported(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when no marks have supported types."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        spec_all_bad = json.dumps({
            "marks": [{"type": "unknownType", "data": [], "options": {}}],
        })
        mock_client.messages.create.side_effect = [
            _mock_response(spec_all_bad),
        ]

        with pytest.raises(ValueError, match="no marks with supported types"):
            generate_plot_spec("test", QUERY_RESULT)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_invalid_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns non-JSON."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response("This is not valid JSON at all"),
        ]

        with pytest.raises(ValueError, match="invalid JSON"):
            generate_plot_spec("test", QUERY_RESULT)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_when_marks_missing(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when spec has no marks array."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response(json.dumps({"width": 640})),
        ]

        with pytest.raises(ValueError, match="non-empty 'marks' array"):
            generate_plot_spec("test", QUERY_RESULT)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when API key is not set."""
        from services.ai_service import generate_plot_spec

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            generate_plot_spec("any question", QUERY_RESULT)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude API returns an error."""
        import anthropic as anthropic_mod

        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic_mod.APIError(
            message="rate limited",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            generate_plot_spec("any question", QUERY_RESULT)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_plot_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the Plot system prompt is sent."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response(VALID_PLOT_SPEC_JSON),
            _mock_response("A chart."),
        ]

        generate_plot_spec("revenue by region", QUERY_RESULT)

        call_args = mock_client.messages.create.call_args_list[0]
        system = call_args.kwargs["system"]
        assert "Observable Plot" in system
        assert "mark" in system.lower()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_includes_query_data_in_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies column names and sample data appear in the prompt."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response(VALID_PLOT_SPEC_JSON),
            _mock_response("A chart."),
        ]

        generate_plot_spec("revenue by region", QUERY_RESULT)

        call_args = mock_client.messages.create.call_args_list[0]
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "region" in user_content
        assert "revenue" in user_content
        assert "North" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_injects_data_into_empty_marks(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Marks without data get the full query result injected."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        spec_no_data = json.dumps({
            "marks": [
                {"type": "barY", "options": {"x": "region", "y": "revenue"}},
            ],
        })
        mock_client.messages.create.side_effect = [
            _mock_response(spec_no_data),
            _mock_response("A chart."),
        ]

        result = generate_plot_spec("revenue by region", QUERY_RESULT)

        mark_data = result["spec"]["marks"][0]["data"]
        assert len(mark_data) == 3
        assert mark_data[0]["region"] == "North"
        assert mark_data[1]["revenue"] == 2300.0

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_explanation_empty_on_second_call_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Explanation is empty if the second API call fails."""
        import anthropic as anthropic_mod

        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = [
            _mock_response(VALID_PLOT_SPEC_JSON),
            anthropic_mod.APIError(
                message="server error",
                request=MagicMock(),
                body=None,
            ),
        ]

        result = generate_plot_spec("revenue by region", QUERY_RESULT)

        assert result["spec"]["marks"][0]["type"] == "barY"
        assert result["explanation"] == ""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_handles_empty_query_result(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Works with an empty query result (no rows)."""
        from services.ai_service import generate_plot_spec

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        empty_spec = json.dumps({
            "marks": [{"type": "barY", "data": [], "options": {"x": "a", "y": "b"}}],
        })
        mock_client.messages.create.side_effect = [
            _mock_response(empty_spec),
            _mock_response("Empty chart."),
        ]

        result = generate_plot_spec("test", {"columns": [], "rows": []})

        assert result["spec"]["marks"][0]["type"] == "barY"


# ---------------------------------------------------------------------------
# _validate_plot_spec tests
# ---------------------------------------------------------------------------


class TestValidatePlotSpec:
    """Tests for the Plot spec validator."""

    def test_valid_spec_passes(self) -> None:
        """A valid spec passes validation unchanged."""
        from services.ai_service import _validate_plot_spec

        spec = {"marks": [{"type": "barY", "data": [], "options": {}}]}
        result = _validate_plot_spec(spec)
        assert len(result["marks"]) == 1

    def test_rejects_non_dict(self) -> None:
        """Raises ValueError for non-dict spec."""
        from services.ai_service import _validate_plot_spec

        with pytest.raises(ValueError, match="JSON object"):
            _validate_plot_spec("not a dict")

    def test_rejects_missing_marks(self) -> None:
        """Raises ValueError when marks key is missing."""
        from services.ai_service import _validate_plot_spec

        with pytest.raises(ValueError, match="non-empty 'marks' array"):
            _validate_plot_spec({"width": 640})

    def test_rejects_empty_marks(self) -> None:
        """Raises ValueError when marks array is empty."""
        from services.ai_service import _validate_plot_spec

        with pytest.raises(ValueError, match="non-empty 'marks' array"):
            _validate_plot_spec({"marks": []})

    def test_filters_unsupported_types(self) -> None:
        """Unsupported mark types are removed."""
        from services.ai_service import _validate_plot_spec

        spec = {
            "marks": [
                {"type": "dot", "data": []},
                {"type": "fakeType", "data": []},
            ],
        }
        result = _validate_plot_spec(spec)
        assert len(result["marks"]) == 1
        assert result["marks"][0]["type"] == "dot"

    def test_rejects_all_unsupported(self) -> None:
        """Raises ValueError when all mark types are unsupported."""
        from services.ai_service import _validate_plot_spec

        with pytest.raises(ValueError, match="no marks with supported types"):
            _validate_plot_spec({"marks": [{"type": "bad"}]})

    def test_skips_non_dict_marks(self) -> None:
        """Non-dict entries in marks array are skipped."""
        from services.ai_service import _validate_plot_spec

        spec = {"marks": ["not a dict", {"type": "line", "data": []}]}
        result = _validate_plot_spec(spec)
        assert len(result["marks"]) == 1
        assert result["marks"][0]["type"] == "line"


# ---------------------------------------------------------------------------
# _extract_json tests
# ---------------------------------------------------------------------------


class TestExtractJson:
    """Tests for the JSON extraction helper."""

    def test_plain_json_unchanged(self) -> None:
        """Plain JSON string is returned unchanged."""
        from services.ai_service import _extract_json

        raw = '{"marks": []}'
        assert _extract_json(raw) == raw

    def test_strips_json_fences(self) -> None:
        """```json fences are stripped."""
        from services.ai_service import _extract_json

        raw = '```json\n{"marks": []}\n```'
        assert _extract_json(raw) == '{"marks": []}'

    def test_strips_plain_fences(self) -> None:
        """Plain ``` fences are stripped."""
        from services.ai_service import _extract_json

        raw = '```\n{"marks": []}\n```'
        assert _extract_json(raw) == '{"marks": []}'


# ---------------------------------------------------------------------------
# Insight fixtures
# ---------------------------------------------------------------------------


VALID_INSIGHTS_JSON = json.dumps([
    {
        "type": "anomaly",
        "title": "Revenue Spike in North Region",
        "description": "North region revenue is significantly lower than South.",
        "severity": "info",
        "table": "sales",
        "columns": ["region", "revenue"],
        "metrics": {"north_revenue": 1500.0, "south_revenue": 2300.0},
    },
    {
        "type": "trend",
        "title": "Product Pricing Gap",
        "description": "Gadget is priced 2x higher than Widget.",
        "severity": "warning",
        "table": "products",
        "columns": ["name", "price"],
        "metrics": {"price_ratio": 2.0},
    },
    {
        "type": "correlation",
        "title": "Quantity-Revenue Relationship",
        "description": "Higher quantity correlates with higher revenue across regions.",
        "severity": "info",
        "table": "sales",
        "columns": ["quantity", "revenue"],
        "metrics": {"correlation": 0.95},
    },
])


# ---------------------------------------------------------------------------
# generate_insights tests
# ---------------------------------------------------------------------------


class TestGenerateInsights:
    """Tests for the generate_insights function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_insights_list(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """generate_insights returns dict with insights key containing a list."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert "insights" in result
        assert isinstance(result["insights"], list)
        assert len(result["insights"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_insight_structure(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Each insight has required fields: type, title, description, severity."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        for insight in result["insights"]:
            assert "type" in insight
            assert "title" in insight
            assert "description" in insight
            assert "severity" in insight

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences around JSON are stripped."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced = f"```json\n{VALID_INSIGHTS_JSON}\n```"
        mock_client.messages.create.return_value = _mock_response(fenced)

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert len(result["insights"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_invalid_insight_types(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Insights with invalid types are filtered out."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mixed = json.dumps([
            {
                "type": "trend",
                "title": "Valid",
                "description": "A valid insight.",
                "severity": "info",
                "table": "sales",
                "columns": ["revenue"],
            },
            {
                "type": "invalid_type",
                "title": "Bad",
                "description": "Should be filtered.",
                "severity": "info",
                "table": "sales",
                "columns": ["revenue"],
            },
        ])
        mock_client.messages.create.return_value = _mock_response(mixed)

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert len(result["insights"]) == 1
        assert result["insights"][0]["type"] == "trend"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_invalid_severity(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Insights with invalid severity are filtered out."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        bad_severity = json.dumps([
            {
                "type": "anomaly",
                "title": "Good",
                "description": "Valid insight.",
                "severity": "info",
                "table": "sales",
                "columns": ["revenue"],
            },
            {
                "type": "anomaly",
                "title": "Bad",
                "description": "Bad severity.",
                "severity": "critical",
                "table": "sales",
                "columns": ["revenue"],
            },
        ])
        mock_client.messages.create.return_value = _mock_response(bad_severity)

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert len(result["insights"]) == 1

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_invalid_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns non-JSON."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            "This is not JSON at all",
        )

        with pytest.raises(ValueError, match="invalid JSON"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_when_not_array(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns an object instead of array."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({"insights": []}),
        )

        with pytest.raises(ValueError, match="JSON array"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_when_empty_array(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns an empty array."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response("[]")

        with pytest.raises(ValueError, match="must not be empty"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_when_all_insights_invalid(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when all insights fail validation."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        all_bad = json.dumps([
            {"type": "bad", "title": "", "description": "", "severity": "bad"},
        ])
        mock_client.messages.create.return_value = _mock_response(all_bad)

        with pytest.raises(ValueError, match="No valid insights found"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when API key is not set."""
        from services.ai_service import generate_insights

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude API returns an error."""
        import anthropic as anthropic_mod

        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic_mod.APIError(
            message="rate limited",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_insights_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the insights system prompt is sent."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        system = call_args.kwargs["system"]
        assert "insight" in system.lower()
        assert "trend" in system.lower()
        assert "anomaly" in system.lower()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_schema_in_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the schema context is included in the API call."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "sales" in user_content
        assert "products" in user_content
        assert "revenue" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_preserves_optional_fields(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Optional fields like table, columns, metrics are preserved."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        result = generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        first = result["insights"][0]
        assert first["table"] == "sales"
        assert "revenue" in first["columns"]
        assert "metrics" in first

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_single_api_call(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """generate_insights makes exactly one API call (no explanation call)."""
        from services.ai_service import generate_insights

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_INSIGHTS_JSON,
        )

        generate_insights(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert mock_client.messages.create.call_count == 1


# ---------------------------------------------------------------------------
# _validate_insights tests
# ---------------------------------------------------------------------------


class TestValidateInsights:
    """Tests for the insight validator."""

    def test_valid_insights_pass(self) -> None:
        """Valid insights pass validation."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": "trend",
                "title": "A trend",
                "description": "Description.",
                "severity": "info",
            },
        ]
        result = _validate_insights(insights)
        assert len(result) == 1

    def test_rejects_non_list(self) -> None:
        """Raises ValueError for non-list input."""
        from services.ai_service import _validate_insights

        with pytest.raises(ValueError, match="JSON array"):
            _validate_insights({"not": "a list"})

    def test_rejects_empty_list(self) -> None:
        """Raises ValueError for empty list."""
        from services.ai_service import _validate_insights

        with pytest.raises(ValueError, match="must not be empty"):
            _validate_insights([])

    def test_filters_missing_title(self) -> None:
        """Insights without title are filtered out."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": "trend",
                "title": "Valid",
                "description": "Desc.",
                "severity": "info",
            },
            {
                "type": "trend",
                "description": "No title.",
                "severity": "info",
            },
        ]
        result = _validate_insights(insights)
        assert len(result) == 1

    def test_filters_empty_title(self) -> None:
        """Insights with empty string title are filtered out."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": "trend",
                "title": "",
                "description": "Desc.",
                "severity": "info",
            },
            {
                "type": "trend",
                "title": "Valid",
                "description": "Desc.",
                "severity": "info",
            },
        ]
        result = _validate_insights(insights)
        assert len(result) == 1
        assert result[0]["title"] == "Valid"

    def test_filters_empty_description(self) -> None:
        """Insights with empty description are filtered out."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": "anomaly",
                "title": "Title",
                "description": "",
                "severity": "warning",
            },
            {
                "type": "anomaly",
                "title": "Good",
                "description": "Has description.",
                "severity": "warning",
            },
        ]
        result = _validate_insights(insights)
        assert len(result) == 1

    def test_filters_non_dict_items(self) -> None:
        """Non-dict items in the array are skipped."""
        from services.ai_service import _validate_insights

        insights = [
            "not a dict",
            {
                "type": "outlier",
                "title": "Valid",
                "description": "Desc.",
                "severity": "important",
            },
        ]
        result = _validate_insights(insights)
        assert len(result) == 1
        assert result[0]["type"] == "outlier"

    def test_raises_when_all_invalid(self) -> None:
        """Raises ValueError when no insights pass validation."""
        from services.ai_service import _validate_insights

        with pytest.raises(ValueError, match="No valid insights found"):
            _validate_insights([{"type": "bad", "title": "", "severity": "x"}])

    def test_all_valid_types_accepted(self) -> None:
        """All four insight types are accepted."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": t,
                "title": f"Title {t}",
                "description": f"Desc {t}.",
                "severity": "info",
            }
            for t in ("trend", "anomaly", "correlation", "outlier")
        ]
        result = _validate_insights(insights)
        assert len(result) == 4

    def test_all_severity_levels_accepted(self) -> None:
        """All three severity levels are accepted."""
        from services.ai_service import _validate_insights

        insights = [
            {
                "type": "trend",
                "title": f"Title {s}",
                "description": f"Desc {s}.",
                "severity": s,
            }
            for s in ("info", "warning", "important")
        ]
        result = _validate_insights(insights)
        assert len(result) == 3


# ---------------------------------------------------------------------------
# chat tests
# ---------------------------------------------------------------------------

VALID_CHAT_JSON = json.dumps({
    "text": "The total revenue across all regions is $5,600.",
    "sql": "SELECT SUM(revenue) FROM sales",
    "plot_spec": None,
})

VALID_CHAT_WITH_PLOT_JSON = json.dumps({
    "text": "Here's a bar chart of revenue by region.",
    "sql": "SELECT region, revenue FROM sales",
    "plot_spec": {
        "marks": [
            {
                "type": "barY",
                "data": [
                    {"region": "North", "revenue": 1500},
                    {"region": "South", "revenue": 2300},
                ],
                "options": {"x": "region", "y": "revenue"},
            }
        ],
        "width": 640,
        "height": 400,
    },
})

VALID_CHAT_TEXT_ONLY_JSON = json.dumps({
    "text": "I can help you explore your sales data. What would you like to know?",
    "sql": None,
    "plot_spec": None,
})

VALID_CHAT_WITH_TABLE_JSON = json.dumps({
    "text": "Here are the top products by price.",
    "sql": "SELECT name, price FROM products ORDER BY price DESC",
    "plot_spec": None,
    "data_table": {
        "columns": ["name", "price"],
        "rows": [
            ["Gadget", 19.99],
            ["Widget", 9.99],
        ],
    },
})


class TestChat:
    """Tests for the chat() service function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_text_and_sql(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Returns text and SQL when Claude provides both."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_JSON,
        )

        result = chat("What is total revenue?", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["text"] == "The total revenue across all regions is $5,600."
        assert result["sql"] == "SELECT SUM(revenue) FROM sales"
        assert result["plot_spec"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_text_only(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Returns text only when no SQL or plot is needed."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_TEXT_ONLY_JSON,
        )

        result = chat("Hi Ralph!", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert "explore" in result["text"].lower()
        assert result["sql"] is None
        assert result["plot_spec"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_plot_spec(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Returns validated plot spec when Claude provides one."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_WITH_PLOT_JSON,
        )

        result = chat(
            "Show me a chart of revenue by region",
            [],
            SAMPLE_SCHEMA,
            SAMPLE_ROWS,
        )

        assert result["plot_spec"] is not None
        assert result["plot_spec"]["marks"][0]["type"] == "barY"
        assert result["sql"] == "SELECT region, revenue FROM sales"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_passes_history_to_claude(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Conversation history is sent as messages to Claude."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_TEXT_ONLY_JSON,
        )

        history = [
            {"role": "user", "content": "What tables do I have?"},
            {"role": "assistant", "content": "You have a sales table."},
        ]

        chat("Tell me more about it", history, SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]
        # History (2 turns) + current message = 3 messages
        assert len(messages) == 3
        assert messages[0]["role"] == "user"
        assert messages[1]["role"] == "assistant"
        assert messages[2]["role"] == "user"
        assert messages[2]["content"] == "Tell me more about it"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_schema_context_in_first_message(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Schema context is prepended to the first user message."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_TEXT_ONLY_JSON,
        )

        chat("What is total revenue?", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]
        first_content = messages[0]["content"]
        assert "sales" in first_content
        assert "revenue" in first_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_schema_context_in_history_first_message(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Schema context is prepended to the first history user message."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_TEXT_ONLY_JSON,
        )

        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi!"},
        ]

        chat("Show data", history, SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        messages = call_args.kwargs["messages"]
        # Schema should be in first message (history[0])
        assert "sales" in messages[0]["content"]
        # Current message should NOT have schema prepended
        assert messages[2]["content"] == "Show data"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_uses_chat_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the chat-specific system prompt is sent."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_TEXT_ONLY_JSON,
        )

        chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        system = call_args.kwargs["system"]
        assert "Ralph" in system
        assert "find.bi" in system

    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when ANTHROPIC_API_KEY is not set."""
        from services.ai_service import chat

        with patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""}):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_invalid_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns non-JSON."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            "This is not JSON at all",
        )

        with pytest.raises(ValueError, match="invalid JSON"):
            chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_missing_text(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when response has no text field."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({"sql": "SELECT 1"}),
        )

        with pytest.raises(ValueError, match="text"):
            chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_non_object_response(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when response is a JSON array instead of object."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps([{"text": "hi"}]),
        )

        with pytest.raises(ValueError, match="JSON object"):
            chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_invalid_plot_spec_becomes_none(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Invalid plot_spec is silently set to None instead of raising."""
        from services.ai_service import chat

        response_json = json.dumps({
            "text": "Here's a chart.",
            "sql": None,
            "plot_spec": {"marks": []},  # invalid — empty marks
        })

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(response_json)

        result = chat("Show chart", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["text"] == "Here's a chart."
        assert result["plot_spec"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_non_string_sql_becomes_none(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Non-string sql value is silently set to None."""
        from services.ai_service import chat

        response_json = json.dumps({
            "text": "Response.",
            "sql": 123,
            "plot_spec": None,
        })

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(response_json)

        result = chat("Query", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["sql"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_single_api_call(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """chat makes exactly one API call."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_JSON,
        )

        chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert mock_client.messages.create.call_count == 1

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Handles Claude wrapping JSON in markdown code fences."""
        from services.ai_service import chat

        fenced = "```json\n" + VALID_CHAT_JSON + "\n```"

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(fenced)

        result = chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["text"] == "The total revenue across all regions is $5,600."

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_data_table(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Returns data_table when Claude provides one."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_WITH_TABLE_JSON,
        )

        result = chat("Show products", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["data_table"] is not None
        assert result["data_table"]["columns"] == ["name", "price"]
        assert len(result["data_table"]["rows"]) == 2
        assert result["data_table"]["rows"][0] == ["Gadget", 19.99]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_data_table_none_when_not_provided(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """data_table is None when Claude does not provide it."""
        from services.ai_service import chat

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_CHAT_JSON,
        )

        result = chat("Hello", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["data_table"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_invalid_data_table_becomes_none(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Invalid data_table (non-dict) is silently set to None."""
        from services.ai_service import chat

        response_json = json.dumps({
            "text": "Here's a table.",
            "sql": None,
            "plot_spec": None,
            "data_table": "not a dict",
        })

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(response_json)

        result = chat("Show data", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["data_table"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_data_table_empty_columns_becomes_none(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """data_table with empty columns array is set to None."""
        from services.ai_service import chat

        response_json = json.dumps({
            "text": "Here's a table.",
            "sql": None,
            "plot_spec": None,
            "data_table": {"columns": [], "rows": []},
        })

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(response_json)

        result = chat("Show data", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["data_table"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_data_table_missing_columns_becomes_none(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """data_table without columns key is set to None."""
        from services.ai_service import chat

        response_json = json.dumps({
            "text": "Here's a table.",
            "sql": None,
            "plot_spec": None,
            "data_table": {"rows": [[1, 2]]},
        })

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(response_json)

        result = chat("Show data", [], SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["data_table"] is None


# ---------------------------------------------------------------------------
# Deck fixtures
# ---------------------------------------------------------------------------


VALID_DECK_JSON = json.dumps({
    "deck_title": "Sales Analysis",
    "summary": "An overview of sales performance across regions.",
    "slides": [
        {
            "title": "Executive Summary",
            "narrative": "Overall sales are strong with regional variation.",
            "plot_spec": None,
        },
        {
            "title": "Revenue by Region",
            "narrative": "North region leads in revenue.",
            "plot_spec": {
                "marks": [
                    {
                        "type": "barY",
                        "data": [
                            {"region": "North", "revenue": 1500},
                            {"region": "South", "revenue": 2300},
                        ],
                        "options": {"x": "region", "y": "revenue"},
                    }
                ],
                "width": 640,
                "height": 400,
            },
        },
        {
            "title": "Recommendations",
            "narrative": "Invest more in the North region to boost revenue.",
            "plot_spec": None,
        },
    ],
})


# ---------------------------------------------------------------------------
# _validate_deck tests
# ---------------------------------------------------------------------------


class TestValidateDeck:
    """Tests for the deck validator."""

    def test_valid_deck_passes(self) -> None:
        """A valid deck passes validation."""
        from services.ai_service import _validate_deck

        parsed = json.loads(VALID_DECK_JSON)
        result = _validate_deck(parsed)
        assert result["deck_title"] == "Sales Analysis"
        assert len(result["slides"]) == 3

    def test_rejects_non_dict(self) -> None:
        """Raises ValueError for non-dict input."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="JSON object"):
            _validate_deck("not a dict")

    def test_rejects_missing_deck_title(self) -> None:
        """Raises ValueError when deck_title is missing."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="deck_title"):
            _validate_deck({
                "summary": "Summary.",
                "slides": [{"title": "T", "narrative": "N"}],
            })

    def test_rejects_empty_deck_title(self) -> None:
        """Raises ValueError when deck_title is empty."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="deck_title"):
            _validate_deck({
                "deck_title": "   ",
                "summary": "Summary.",
                "slides": [{"title": "T", "narrative": "N"}],
            })

    def test_rejects_missing_summary(self) -> None:
        """Raises ValueError when summary is missing."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="summary"):
            _validate_deck({
                "deck_title": "Title",
                "slides": [{"title": "T", "narrative": "N"}],
            })

    def test_rejects_empty_slides(self) -> None:
        """Raises ValueError when slides array is empty."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="slides"):
            _validate_deck({
                "deck_title": "Title",
                "summary": "Summary.",
                "slides": [],
            })

    def test_filters_slides_without_title(self) -> None:
        """Slides without title are filtered out."""
        from services.ai_service import _validate_deck

        parsed = {
            "deck_title": "Title",
            "summary": "Summary.",
            "slides": [
                {"title": "Valid", "narrative": "Has narrative."},
                {"narrative": "Missing title."},
            ],
        }
        result = _validate_deck(parsed)
        assert len(result["slides"]) == 1
        assert result["slides"][0]["title"] == "Valid"

    def test_filters_slides_without_narrative(self) -> None:
        """Slides without narrative are filtered out."""
        from services.ai_service import _validate_deck

        parsed = {
            "deck_title": "Title",
            "summary": "Summary.",
            "slides": [
                {"title": "Valid", "narrative": "Has narrative."},
                {"title": "No Narrative"},
            ],
        }
        result = _validate_deck(parsed)
        assert len(result["slides"]) == 1

    def test_raises_when_all_slides_invalid(self) -> None:
        """Raises ValueError when all slides fail validation."""
        from services.ai_service import _validate_deck

        with pytest.raises(ValueError, match="No valid slides"):
            _validate_deck({
                "deck_title": "Title",
                "summary": "Summary.",
                "slides": [{"title": "", "narrative": ""}],
            })

    def test_invalid_plot_spec_becomes_none(self) -> None:
        """Invalid plot_spec in a slide is set to None."""
        from services.ai_service import _validate_deck

        parsed = {
            "deck_title": "Title",
            "summary": "Summary.",
            "slides": [
                {
                    "title": "Slide",
                    "narrative": "Text.",
                    "plot_spec": {"marks": []},  # invalid — empty marks
                },
            ],
        }
        result = _validate_deck(parsed)
        assert result["slides"][0]["plot_spec"] is None

    def test_non_dict_plot_spec_becomes_none(self) -> None:
        """Non-dict plot_spec in a slide is set to None."""
        from services.ai_service import _validate_deck

        parsed = {
            "deck_title": "Title",
            "summary": "Summary.",
            "slides": [
                {
                    "title": "Slide",
                    "narrative": "Text.",
                    "plot_spec": "not a dict",
                },
            ],
        }
        result = _validate_deck(parsed)
        assert result["slides"][0]["plot_spec"] is None

    def test_valid_plot_spec_preserved(self) -> None:
        """Valid plot_spec in a slide is preserved."""
        from services.ai_service import _validate_deck

        parsed = json.loads(VALID_DECK_JSON)
        result = _validate_deck(parsed)
        chart_slide = result["slides"][1]
        assert chart_slide["plot_spec"] is not None
        assert chart_slide["plot_spec"]["marks"][0]["type"] == "barY"

    def test_filters_non_dict_slides(self) -> None:
        """Non-dict items in slides array are skipped."""
        from services.ai_service import _validate_deck

        parsed = {
            "deck_title": "Title",
            "summary": "Summary.",
            "slides": [
                "not a dict",
                {"title": "Valid", "narrative": "Text."},
            ],
        }
        result = _validate_deck(parsed)
        assert len(result["slides"]) == 1


# ---------------------------------------------------------------------------
# generate_deck tests
# ---------------------------------------------------------------------------


class TestGenerateDeck:
    """Tests for the generate_deck function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_deck_structure(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """generate_deck returns dict with deck_title, summary, and slides."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        result = generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["deck_title"] == "Sales Analysis"
        assert "overview" in result["summary"].lower()
        assert isinstance(result["slides"], list)
        assert len(result["slides"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_slide_structure(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Each slide has title, narrative, and optional plot_spec."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        result = generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        for slide in result["slides"]:
            assert "title" in slide
            assert "narrative" in slide

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences around JSON are stripped."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced = f"```json\n{VALID_DECK_JSON}\n```"
        mock_client.messages.create.return_value = _mock_response(fenced)

        result = generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert len(result["slides"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_invalid_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns non-JSON."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            "This is not JSON at all",
        )

        with pytest.raises(ValueError, match="invalid JSON"):
            generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when API key is not set."""
        from services.ai_service import generate_deck

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude API returns an error."""
        import anthropic as anthropic_mod

        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic_mod.APIError(
            message="rate limited",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_deck_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the deck system prompt is sent."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        system = call_args.kwargs["system"]
        assert "deck" in system.lower()
        assert "slide" in system.lower()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_schema_in_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the schema context is included in the API call."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        call_args = mock_client.messages.create.call_args
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "sales" in user_content
        assert "products" in user_content
        assert "revenue" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_includes_user_goal(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """User goal is included in the prompt when provided."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        generate_deck(
            SAMPLE_SCHEMA, SAMPLE_ROWS, user_goal="Analyze revenue trends",
        )

        call_args = mock_client.messages.create.call_args
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "Analyze revenue trends" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_empty_user_goal_excluded(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Empty user goal does not add goal clause to prompt."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS, user_goal="")

        call_args = mock_client.messages.create.call_args
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "analysis goal" not in user_content.lower()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_single_api_call(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """generate_deck makes exactly one API call."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert mock_client.messages.create.call_count == 1

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_preserves_valid_plot_spec(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Valid plot_spec in slides is preserved."""
        from services.ai_service import generate_deck

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_DECK_JSON,
        )

        result = generate_deck(SAMPLE_SCHEMA, SAMPLE_ROWS)

        chart_slide = result["slides"][1]
        assert chart_slide["plot_spec"] is not None
        assert chart_slide["plot_spec"]["marks"][0]["type"] == "barY"


# ---------------------------------------------------------------------------
# detect_geo_columns tests
# ---------------------------------------------------------------------------

GEO_SCHEMA: list[dict[str, Any]] = [
    {
        "table_name": "locations",
        "columns": [
            {"name": "city", "type": "string"},
            {"name": "latitude", "type": "float"},
            {"name": "longitude", "type": "float"},
            {"name": "country", "type": "string"},
            {"name": "population", "type": "integer"},
        ],
        "row_count": 500,
    },
]

GEO_ROWS: dict[str, list[dict[str, Any]]] = {
    "locations": [
        {
            "city": "Stockholm",
            "latitude": 59.3293,
            "longitude": 18.0686,
            "country": "Sweden",
            "population": 975000,
        },
        {
            "city": "Oslo",
            "latitude": 59.9139,
            "longitude": 10.7522,
            "country": "Norway",
            "population": 694000,
        },
    ],
}

VALID_GEO_COLUMNS_JSON = json.dumps({
    "geo_columns": [
        {
            "type": "lat-lon-pair",
            "lat_column": "latitude",
            "lon_column": "longitude",
            "table": "locations",
            "suggested_map_type": "map-scatterplot",
        },
        {
            "type": "country",
            "column": "country",
            "table": "locations",
            "suggested_map_type": "map-geojson",
        },
    ],
})


class TestDetectGeoColumns:
    """Tests for the detect_geo_columns function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_lat_lon_and_country(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """detect_geo_columns returns lat-lon pairs and country columns."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_GEO_COLUMNS_JSON,
        )

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert "geo_columns" in result
        assert len(result["geo_columns"]) == 2
        assert result["geo_columns"][0]["type"] == "lat-lon-pair"
        assert result["geo_columns"][0]["lat_column"] == "latitude"
        assert result["geo_columns"][0]["lon_column"] == "longitude"
        assert result["geo_columns"][1]["type"] == "country"
        assert result["geo_columns"][1]["column"] == "country"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_returns_empty_when_no_geo_columns(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Returns empty list when no geographic columns detected."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({"geo_columns": []}),
        )

        result = detect_geo_columns(SAMPLE_SCHEMA, SAMPLE_ROWS)

        assert result["geo_columns"] == []

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences around JSON are stripped."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        fenced = f"```json\n{VALID_GEO_COLUMNS_JSON}\n```"
        mock_client.messages.create.return_value = _mock_response(fenced)

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert len(result["geo_columns"]) == 2

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_invalid_types(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Geo columns with invalid types are filtered out."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mixed = json.dumps({
            "geo_columns": [
                {
                    "type": "lat-lon-pair",
                    "lat_column": "latitude",
                    "lon_column": "longitude",
                    "table": "locations",
                    "suggested_map_type": "map-scatterplot",
                },
                {
                    "type": "zipcode",
                    "column": "zip",
                    "table": "locations",
                    "suggested_map_type": "map-geojson",
                },
            ],
        })
        mock_client.messages.create.return_value = _mock_response(mixed)

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert len(result["geo_columns"]) == 1
        assert result["geo_columns"][0]["type"] == "lat-lon-pair"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_invalid_map_types(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Geo columns with invalid suggested_map_type are filtered out."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        bad_map = json.dumps({
            "geo_columns": [
                {
                    "type": "country",
                    "column": "country",
                    "table": "locations",
                    "suggested_map_type": "bar-chart",
                },
            ],
        })
        mock_client.messages.create.return_value = _mock_response(bad_map)

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert len(result["geo_columns"]) == 0

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_lat_lon_missing_columns(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """lat-lon-pair entries missing lat_column or lon_column are filtered."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        missing_lon = json.dumps({
            "geo_columns": [
                {
                    "type": "lat-lon-pair",
                    "lat_column": "latitude",
                    "table": "locations",
                    "suggested_map_type": "map-scatterplot",
                },
            ],
        })
        mock_client.messages.create.return_value = _mock_response(missing_lon)

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert len(result["geo_columns"]) == 0

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_filters_country_missing_column(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """country/region entries missing column field are filtered."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        missing_col = json.dumps({
            "geo_columns": [
                {
                    "type": "country",
                    "table": "locations",
                    "suggested_map_type": "map-geojson",
                },
            ],
        })
        mock_client.messages.create.return_value = _mock_response(missing_col)

        result = detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert len(result["geo_columns"]) == 0

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_invalid_json(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude returns non-JSON."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            "This is not JSON",
        )

        with pytest.raises(ValueError, match="invalid JSON"):
            detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_raises_without_api_key(self) -> None:
        """Raises ValueError when API key is not set."""
        from services.ai_service import detect_geo_columns

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_raises_on_api_error(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Raises ValueError when Claude API returns an error."""
        import anthropic as anthropic_mod

        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = anthropic_mod.APIError(
            message="rate limited",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_geo_system_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the geo column system prompt is sent."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_GEO_COLUMNS_JSON,
        )

        detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        call_args = mock_client.messages.create.call_args
        system = call_args.kwargs["system"]
        assert "geographic" in system.lower()
        assert "lat-lon-pair" in system

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_sends_schema_in_prompt(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Verifies the schema context is included in the API call."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_GEO_COLUMNS_JSON,
        )

        detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        call_args = mock_client.messages.create.call_args
        user_content = call_args.kwargs["messages"][0]["content"]
        assert "locations" in user_content
        assert "latitude" in user_content

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_single_api_call(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """detect_geo_columns makes exactly one API call."""
        from services.ai_service import detect_geo_columns

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            VALID_GEO_COLUMNS_JSON,
        )

        detect_geo_columns(GEO_SCHEMA, GEO_ROWS)

        assert mock_client.messages.create.call_count == 1


# ---------------------------------------------------------------------------
# _validate_geo_columns tests
# ---------------------------------------------------------------------------


class TestValidateGeoColumns:
    """Tests for the geo column validator."""

    def test_valid_lat_lon_pair(self) -> None:
        """Valid lat-lon-pair passes validation."""
        from services.ai_service import _validate_geo_columns

        parsed = {
            "geo_columns": [
                {
                    "type": "lat-lon-pair",
                    "lat_column": "lat",
                    "lon_column": "lon",
                    "table": "t",
                    "suggested_map_type": "map-scatterplot",
                },
            ],
        }
        result = _validate_geo_columns(parsed)
        assert len(result) == 1

    def test_valid_country(self) -> None:
        """Valid country column passes validation."""
        from services.ai_service import _validate_geo_columns

        parsed = {
            "geo_columns": [
                {
                    "type": "country",
                    "column": "country_name",
                    "table": "t",
                    "suggested_map_type": "map-geojson",
                },
            ],
        }
        result = _validate_geo_columns(parsed)
        assert len(result) == 1

    def test_valid_region(self) -> None:
        """Valid region column passes validation."""
        from services.ai_service import _validate_geo_columns

        parsed = {
            "geo_columns": [
                {
                    "type": "region",
                    "column": "state",
                    "table": "t",
                    "suggested_map_type": "map-geojson",
                },
            ],
        }
        result = _validate_geo_columns(parsed)
        assert len(result) == 1

    def test_rejects_non_dict(self) -> None:
        """Raises ValueError for non-dict input."""
        from services.ai_service import _validate_geo_columns

        with pytest.raises(ValueError, match="JSON object"):
            _validate_geo_columns("not a dict")

    def test_rejects_missing_geo_columns_key(self) -> None:
        """Raises ValueError when geo_columns key is missing."""
        from services.ai_service import _validate_geo_columns

        with pytest.raises(ValueError, match="geo_columns"):
            _validate_geo_columns({"other": []})

    def test_empty_geo_columns_is_valid(self) -> None:
        """Empty geo_columns list is valid (dataset may have no geo data)."""
        from services.ai_service import _validate_geo_columns

        result = _validate_geo_columns({"geo_columns": []})
        assert result == []

    def test_filters_non_dict_items(self) -> None:
        """Non-dict items in the array are skipped."""
        from services.ai_service import _validate_geo_columns

        parsed = {
            "geo_columns": [
                "not a dict",
                {
                    "type": "country",
                    "column": "country",
                    "table": "t",
                    "suggested_map_type": "map-geojson",
                },
            ],
        }
        result = _validate_geo_columns(parsed)
        assert len(result) == 1

    def test_filters_missing_table(self) -> None:
        """Entries without table field are filtered out."""
        from services.ai_service import _validate_geo_columns

        parsed = {
            "geo_columns": [
                {
                    "type": "country",
                    "column": "country",
                    "suggested_map_type": "map-geojson",
                },
            ],
        }
        result = _validate_geo_columns(parsed)
        assert len(result) == 0


# ---------------------------------------------------------------------------
# classify_voice_intent tests
# ---------------------------------------------------------------------------


class TestClassifyVoiceIntent:
    """Tests for the classify_voice_intent function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_classifies_query_intent(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Classifies a data question as 'query' intent."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "query",
                "confidence": 0.95,
                "entities": {},
            })
        )

        result = classify_voice_intent("What is total revenue by region?")

        assert result["intent"] == "query"
        assert result["confidence"] == 0.95
        assert result["entities"] == {}

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_classifies_filter_intent(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Classifies a filter command as 'filter' intent."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "filter",
                "confidence": 0.9,
                "entities": {"column": "region", "value": "North"},
            })
        )

        result = classify_voice_intent("Show only North region")

        assert result["intent"] == "filter"
        assert result["confidence"] == 0.9
        assert result["entities"] == {"column": "region", "value": "North"}

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_classifies_export_intent(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Classifies an export request as 'export' intent."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "export",
                "confidence": 0.88,
                "entities": {"format": "csv"},
            })
        )

        result = classify_voice_intent("Export this as CSV")

        assert result["intent"] == "export"
        assert result["confidence"] == 0.88
        assert result["entities"]["format"] == "csv"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_classifies_narrate_intent(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Classifies a narration request as 'narrate' intent."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "narrate",
                "confidence": 0.92,
                "entities": {},
            })
        )

        result = classify_voice_intent("Read me this dashboard")

        assert result["intent"] == "narrate"
        assert result["confidence"] == 0.92

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_classifies_navigate_intent(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Classifies a navigation command as 'navigate' intent."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "navigate",
                "confidence": 0.97,
                "entities": {"page": "sql-editor"},
            })
        )

        result = classify_voice_intent("Go to the SQL editor")

        assert result["intent"] == "navigate"
        assert result["confidence"] == 0.97
        assert result["entities"]["page"] == "sql-editor"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_strips_markdown_fences(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Markdown code fences are stripped from the JSON response."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            '```json\n{"intent": "query", "confidence": 0.9, "entities": {}}\n```'
        )

        result = classify_voice_intent("What are the top products?")

        assert result["intent"] == "query"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_defaults_confidence_when_missing(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Missing confidence defaults to 0.5."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({"intent": "query", "entities": {}})
        )

        result = classify_voice_intent("Show me sales data")

        assert result["confidence"] == 0.5

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_defaults_entities_when_missing(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Missing entities defaults to empty dict."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({"intent": "query", "confidence": 0.8})
        )

        result = classify_voice_intent("Show me sales data")

        assert result["entities"] == {}

    def test_empty_transcript_raises(self) -> None:
        """Empty transcript raises ValueError."""
        from services.ai_service import classify_voice_intent

        with pytest.raises(ValueError, match="Transcript must not be empty"):
            classify_voice_intent("")

    def test_whitespace_transcript_raises(self) -> None:
        """Whitespace-only transcript raises ValueError."""
        from services.ai_service import classify_voice_intent

        with pytest.raises(ValueError, match="Transcript must not be empty"):
            classify_voice_intent("   ")

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_missing_api_key_raises(self) -> None:
        """Missing API key raises ValueError."""
        from services.ai_service import classify_voice_intent

        with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
            classify_voice_intent("What is revenue?")

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_invalid_json_raises(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Invalid JSON response raises ValueError."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            "not valid json"
        )

        with pytest.raises(ValueError, match="invalid JSON"):
            classify_voice_intent("What is revenue?")

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_invalid_intent_category_raises(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Invalid intent category raises ValueError."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "unknown_intent",
                "confidence": 0.9,
                "entities": {},
            })
        )

        with pytest.raises(ValueError, match="Intent must be one of"):
            classify_voice_intent("Do something weird")

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_api_error_raises(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Claude API error is converted to ValueError."""
        import anthropic as _anthropic

        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.side_effect = _anthropic.APIError(
            message="Service unavailable",
            request=MagicMock(),
            body=None,
        )

        with pytest.raises(ValueError, match="Claude API error"):
            classify_voice_intent("What is revenue?")

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("services.ai_service.anthropic.Anthropic")
    def test_integer_confidence_converted_to_float(
        self, mock_anthropic_cls: MagicMock,
    ) -> None:
        """Integer confidence (e.g. 1) is converted to float."""
        from services.ai_service import classify_voice_intent

        mock_client = MagicMock()
        mock_anthropic_cls.return_value = mock_client
        mock_client.messages.create.return_value = _mock_response(
            json.dumps({
                "intent": "query",
                "confidence": 1,
                "entities": {},
            })
        )

        result = classify_voice_intent("What is total revenue?")

        assert result["confidence"] == 1.0
        assert isinstance(result["confidence"], float)


# ---------------------------------------------------------------------------
# _validate_intent_result tests
# ---------------------------------------------------------------------------


class TestValidateIntentResult:
    """Tests for the _validate_intent_result validation function."""

    def test_valid_result(self) -> None:
        """Valid result passes validation."""
        from services.ai_service import _validate_intent_result

        result = _validate_intent_result({
            "intent": "query",
            "confidence": 0.95,
            "entities": {},
        })
        assert result["intent"] == "query"
        assert result["confidence"] == 0.95
        assert result["entities"] == {}

    def test_non_dict_raises(self) -> None:
        """Non-dict input raises ValueError."""
        from services.ai_service import _validate_intent_result

        with pytest.raises(ValueError, match="JSON object"):
            _validate_intent_result("not a dict")

    def test_invalid_intent_raises(self) -> None:
        """Invalid intent string raises ValueError."""
        from services.ai_service import _validate_intent_result

        with pytest.raises(ValueError, match="Intent must be one of"):
            _validate_intent_result({
                "intent": "bogus",
                "confidence": 0.5,
                "entities": {},
            })

    def test_missing_intent_raises(self) -> None:
        """Missing intent key raises ValueError."""
        from services.ai_service import _validate_intent_result

        with pytest.raises(ValueError, match="Intent must be one of"):
            _validate_intent_result({
                "confidence": 0.5,
                "entities": {},
            })

    def test_out_of_range_confidence_defaults(self) -> None:
        """Out-of-range confidence defaults to 0.5."""
        from services.ai_service import _validate_intent_result

        result = _validate_intent_result({
            "intent": "filter",
            "confidence": 1.5,
            "entities": {},
        })
        assert result["confidence"] == 0.5

    def test_non_numeric_confidence_defaults(self) -> None:
        """Non-numeric confidence defaults to 0.5."""
        from services.ai_service import _validate_intent_result

        result = _validate_intent_result({
            "intent": "filter",
            "confidence": "high",
            "entities": {},
        })
        assert result["confidence"] == 0.5

    def test_non_dict_entities_defaults(self) -> None:
        """Non-dict entities defaults to empty dict."""
        from services.ai_service import _validate_intent_result

        result = _validate_intent_result({
            "intent": "export",
            "confidence": 0.8,
            "entities": "not a dict",
        })
        assert result["entities"] == {}

    def test_all_five_intents_valid(self) -> None:
        """All five intent categories pass validation."""
        from services.ai_service import _validate_intent_result

        for intent in ["query", "filter", "export", "narrate", "navigate"]:
            result = _validate_intent_result({
                "intent": intent,
                "confidence": 0.9,
                "entities": {},
            })
            assert result["intent"] == intent
