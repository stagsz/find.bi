"""Tests for AI API routes: POST /api/ai/text-to-sql, POST /api/ai/insights."""

import os
import tempfile
from collections.abc import Generator
from typing import Any
from unittest.mock import MagicMock, patch

import duckdb
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from db import get_db
from main import app
from models.base import Base

engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def _override_db() -> Generator[None, None, None]:
    """Override get_db with in-memory SQLite; reset tables each test."""
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    def override() -> Generator[Session, None, None]:
        session = TestSession()
        try:
            yield session
        finally:
            session.rollback()
            session.close()

    app.dependency_overrides[get_db] = override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# --- Helpers ---


def _register_and_login(
    client: TestClient, email: str = "ralph@springfield.edu",
) -> str:
    """Register a user and return JWT token."""
    client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "display_name": "Ralph Wiggum",
        },
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "password123"},
    )
    token: str = resp.json()["access_token"]
    return token


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _get_workspace_id(client: TestClient, token: str) -> str:
    """Get the default workspace ID for the authenticated user."""
    resp = client.get("/api/workspaces/", headers=_auth_headers(token))
    workspaces: list[dict[str, Any]] = resp.json()
    return str(workspaces[0]["id"])


def _create_duckdb_with_table(db_path: str) -> None:
    """Create a DuckDB file with a test table."""
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = duckdb.connect(db_path)
    conn.execute(
        "CREATE TABLE sales ("
        "  region VARCHAR, revenue DOUBLE, quantity INTEGER"
        ")"
    )
    conn.execute(
        "INSERT INTO sales VALUES "
        "('North', 1500.0, 10), "
        "('South', 2300.0, 15), "
        "('East', 1800.0, 12)"
    )
    conn.close()


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


# --- POST /api/ai/text-to-sql ---


class TestTextToSqlEndpoint:
    """Tests for POST /api/ai/text-to-sql."""

    def test_requires_authentication(self, client: TestClient) -> None:
        """Returns 422 without auth header (missing required header)."""
        resp = client.post(
            "/api/ai/text-to-sql",
            json={"question": "What is total revenue?", "workspace_id": "x"},
        )
        assert resp.status_code == 422

    def test_invalid_auth_token(self, client: TestClient) -> None:
        """Returns 401 with an invalid token."""
        resp = client.post(
            "/api/ai/text-to-sql",
            json={"question": "What is total revenue?", "workspace_id": "x"},
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401

    def test_workspace_not_found(self, client: TestClient) -> None:
        """Returns 404 for non-existent workspace."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_workspace_invalid_uuid(self, client: TestClient) -> None:
        """Returns 404 for invalid workspace UUID."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": "not-a-uuid",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_empty_question(self, client: TestClient) -> None:
        """Returns 400 when question is empty or whitespace."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={"question": "   ", "workspace_id": workspace_id},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400
        assert "Question is required" in resp.json()["detail"]

    def test_no_tables_in_workspace(self, client: TestClient) -> None:
        """Returns 400 when workspace has no data tables."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400
        assert "No data tables" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_returns_sql_and_explanation(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns generated SQL and explanation on success."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT region, SUM(revenue) FROM sales GROUP BY region",
            "explanation": "Sums revenue by region.",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        # Create DuckDB with table at workspace path
        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue by region?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["sql"] == (
            "SELECT region, SUM(revenue) FROM sales GROUP BY region"
        )
        assert data["explanation"] == "Sums revenue by region."

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_passes_schema_to_ai_service(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Verifies schema and sample rows are passed to text_to_sql."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT 1",
            "explanation": "",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "Show me sales data",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        mock_text_to_sql.assert_called_once()
        call_args = mock_text_to_sql.call_args
        question_arg = call_args[0][0]
        schema_arg = call_args[0][1]
        sample_rows_arg = call_args[0][2]

        assert question_arg == "Show me sales data"
        assert len(schema_arg) == 1
        assert schema_arg[0]["table_name"] == "sales"
        assert "sales" in sample_rows_arg
        assert len(sample_rows_arg["sales"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_schema_includes_columns_and_row_count(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Schema passed to AI includes column info and row count."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT 1",
            "explanation": "",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "Count rows",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        schema_arg = mock_text_to_sql.call_args[0][1]
        table = schema_arg[0]
        assert table["row_count"] == 3
        col_names = [c["name"] for c in table["columns"]]
        assert "region" in col_names
        assert "revenue" in col_names
        assert "quantity" in col_names

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_ai_service_error_returns_502(
        self, client: TestClient,
    ) -> None:
        """Returns 502 when AI service raises ValueError (missing key)."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 502
        assert "ANTHROPIC_API_KEY" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_ai_service_api_error_returns_502(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns 502 when the AI service raises a ValueError."""
        mock_text_to_sql.side_effect = ValueError("Claude API error: rate limited")

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 502
        assert "Claude API error" in resp.json()["detail"]

    def test_other_user_cannot_access_workspace(
        self, client: TestClient,
    ) -> None:
        """Returns 404 when trying to use another user's workspace."""
        token_a = _register_and_login(client, "userA@test.com")
        token_b = _register_and_login(client, "userB@test.com")

        workspace_id_a = _get_workspace_id(client, token_a)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "What is total revenue?",
                "workspace_id": workspace_id_a,
            },
            headers=_auth_headers(token_b),
        )

        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_sample_rows_limited_to_50(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Sample rows sent to AI are limited to 50 per table."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT 1",
            "explanation": "",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]

        # Create table with 100 rows
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        conn = duckdb.connect(db_path)
        conn.execute(
            "CREATE TABLE big_table (id INTEGER, val DOUBLE)"
        )
        for i in range(100):
            conn.execute(
                f"INSERT INTO big_table VALUES ({i}, {i * 1.5})"
            )
        conn.close()

        client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "Show me data",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        sample_rows_arg = mock_text_to_sql.call_args[0][2]
        assert len(sample_rows_arg["big_table"]) == 50

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_response_schema(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Response has exactly sql and explanation fields."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT COUNT(*) FROM sales",
            "explanation": "Counts all sales rows.",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "How many sales?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert set(data.keys()) == {"sql", "explanation"}

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.text_to_sql")
    def test_empty_explanation_allowed(
        self,
        mock_text_to_sql: MagicMock,
        client: TestClient,
    ) -> None:
        """Empty explanation is valid (second API call may fail)."""
        mock_text_to_sql.return_value = {
            "sql": "SELECT 1",
            "explanation": "",
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/text-to-sql",
            json={
                "question": "test",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        assert resp.json()["explanation"] == ""

    def test_missing_question_field(self, client: TestClient) -> None:
        """Returns 422 when question field is missing."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={"workspace_id": "some-id"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422

    def test_missing_workspace_id_field(self, client: TestClient) -> None:
        """Returns 422 when workspace_id field is missing."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/text-to-sql",
            json={"question": "What is revenue?"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422


# --- _fetch_sample_rows unit tests ---


class TestFetchSampleRows:
    """Tests for the _fetch_sample_rows helper."""

    def test_returns_sample_rows(self) -> None:
        """Fetches sample rows from a DuckDB table."""
        from api.ai import _fetch_sample_rows

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            _create_duckdb_with_table(db_path)

            result = _fetch_sample_rows(db_path, ["sales"])

            assert "sales" in result
            assert len(result["sales"]) == 3
            assert result["sales"][0]["region"] == "North"

    def test_returns_empty_for_missing_db(self) -> None:
        """Returns empty dict when DB file doesn't exist."""
        from api.ai import _fetch_sample_rows

        result = _fetch_sample_rows("/nonexistent/path.db", ["sales"])
        assert result == {}

    def test_limits_rows(self) -> None:
        """Respects max_rows parameter."""
        from api.ai import _fetch_sample_rows

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            _create_duckdb_with_table(db_path)

            result = _fetch_sample_rows(db_path, ["sales"], max_rows=2)

            assert len(result["sales"]) == 2

    def test_handles_nonexistent_table(self) -> None:
        """Returns empty list for a table that doesn't exist."""
        from api.ai import _fetch_sample_rows

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            _create_duckdb_with_table(db_path)

            result = _fetch_sample_rows(db_path, ["nonexistent"])

            assert result["nonexistent"] == []

    def test_multiple_tables(self) -> None:
        """Fetches rows from multiple tables."""
        from api.ai import _fetch_sample_rows

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "test.db")
            conn = duckdb.connect(db_path)
            conn.execute("CREATE TABLE t1 (a INTEGER)")
            conn.execute("INSERT INTO t1 VALUES (1), (2)")
            conn.execute("CREATE TABLE t2 (b VARCHAR)")
            conn.execute("INSERT INTO t2 VALUES ('x'), ('y'), ('z')")
            conn.close()

            result = _fetch_sample_rows(db_path, ["t1", "t2"])

            assert len(result["t1"]) == 2
            assert len(result["t2"]) == 3


# --- POST /api/ai/insights ---


VALID_INSIGHTS_RESPONSE: list[dict[str, Any]] = [
    {
        "type": "trend",
        "title": "Revenue is increasing",
        "description": "Revenue shows an upward trend across regions.",
        "severity": "info",
        "table": "sales",
        "columns": ["revenue"],
        "metrics": {"growth_rate": 0.15},
    },
    {
        "type": "anomaly",
        "title": "North region outlier",
        "description": "North has significantly lower revenue than others.",
        "severity": "warning",
        "table": "sales",
        "columns": ["region", "revenue"],
    },
    {
        "type": "correlation",
        "title": "Revenue-quantity correlation",
        "description": "Revenue and quantity are strongly correlated.",
        "severity": "info",
        "table": "sales",
        "columns": ["revenue", "quantity"],
        "metrics": {"correlation": 0.95},
    },
]


class TestInsightsEndpoint:
    """Tests for POST /api/ai/insights."""

    def test_requires_authentication(self, client: TestClient) -> None:
        """Returns 422 without auth header."""
        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": "x"},
        )
        assert resp.status_code == 422

    def test_invalid_auth_token(self, client: TestClient) -> None:
        """Returns 401 with an invalid token."""
        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": "x"},
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401

    def test_workspace_not_found(self, client: TestClient) -> None:
        """Returns 404 for non-existent workspace."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/insights",
            json={
                "workspace_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_no_tables_in_workspace(self, client: TestClient) -> None:
        """Returns 400 when workspace has no data tables."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)
        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400
        assert "No data tables" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.generate_insights")
    def test_returns_insights(
        self,
        mock_generate: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns generated insights on success."""
        mock_generate.return_value = {
            "insights": VALID_INSIGHTS_RESPONSE,
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert "insights" in data
        assert len(data["insights"]) == 3
        assert data["insights"][0]["type"] == "trend"
        assert data["insights"][0]["title"] == "Revenue is increasing"
        assert data["insights"][1]["severity"] == "warning"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.generate_insights")
    def test_passes_schema_to_ai_service(
        self,
        mock_generate: MagicMock,
        client: TestClient,
    ) -> None:
        """Verifies schema and sample rows are passed to generate_insights."""
        mock_generate.return_value = {
            "insights": VALID_INSIGHTS_RESPONSE,
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )

        mock_generate.assert_called_once()
        call_args = mock_generate.call_args
        schema_arg = call_args[0][0]
        sample_rows_arg = call_args[0][1]

        assert len(schema_arg) == 1
        assert schema_arg[0]["table_name"] == "sales"
        assert "sales" in sample_rows_arg
        assert len(sample_rows_arg["sales"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_ai_service_error_returns_502(
        self, client: TestClient,
    ) -> None:
        """Returns 502 when AI service raises ValueError (missing key)."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 502
        assert "ANTHROPIC_API_KEY" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.generate_insights")
    def test_response_schema(
        self,
        mock_generate: MagicMock,
        client: TestClient,
    ) -> None:
        """Response has exactly insights field with correct item structure."""
        mock_generate.return_value = {
            "insights": VALID_INSIGHTS_RESPONSE,
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert set(data.keys()) == {"insights"}

        item = data["insights"][0]
        assert "type" in item
        assert "title" in item
        assert "description" in item
        assert "severity" in item

    def test_other_user_cannot_access_workspace(
        self, client: TestClient,
    ) -> None:
        """Returns 404 when trying to use another user's workspace."""
        token_a = _register_and_login(client, "insA@test.com")
        token_b = _register_and_login(client, "insB@test.com")

        workspace_id_a = _get_workspace_id(client, token_a)

        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id_a},
            headers=_auth_headers(token_b),
        )

        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_missing_workspace_id_field(self, client: TestClient) -> None:
        """Returns 422 when workspace_id field is missing."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/insights",
            json={},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.generate_insights")
    def test_optional_fields_nullable(
        self,
        mock_generate: MagicMock,
        client: TestClient,
    ) -> None:
        """Insights without optional fields (table, columns, metrics) are valid."""
        mock_generate.return_value = {
            "insights": [
                {
                    "type": "trend",
                    "title": "General trend",
                    "description": "Something is trending.",
                    "severity": "info",
                },
            ],
        }

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/insights",
            json={"workspace_id": workspace_id},
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        item = resp.json()["insights"][0]
        assert item["table"] is None
        assert item["columns"] is None
        assert item["metrics"] is None


# --- POST /api/ai/chat ---

VALID_CHAT_RESPONSE: dict[str, Any] = {
    "text": "The total revenue is $5,600.",
    "sql": "SELECT SUM(revenue) FROM sales",
    "plot_spec": None,
}

VALID_CHAT_WITH_PLOT: dict[str, Any] = {
    "text": "Here's revenue by region.",
    "sql": "SELECT region, revenue FROM sales",
    "plot_spec": {
        "marks": [
            {
                "type": "barY",
                "data": [{"region": "North", "revenue": 1500}],
                "options": {"x": "region", "y": "revenue"},
            }
        ],
        "width": 640,
        "height": 400,
    },
}

VALID_CHAT_WITH_TABLE: dict[str, Any] = {
    "text": "Here are the top products.",
    "sql": None,
    "plot_spec": None,
    "data_table": {
        "columns": ["name", "price"],
        "rows": [["Widget", 9.99], ["Gadget", 19.99]],
    },
}


class TestChatEndpoint:
    """Tests for POST /api/ai/chat."""

    def test_requires_authentication(self, client: TestClient) -> None:
        """Returns 422 without auth header."""
        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello Ralph",
                "workspace_id": "x",
            },
        )
        assert resp.status_code == 422

    def test_invalid_auth_token(self, client: TestClient) -> None:
        """Returns 401 with an invalid token."""
        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello Ralph",
                "workspace_id": "x",
            },
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401

    def test_workspace_not_found(self, client: TestClient) -> None:
        """Returns 404 for non-existent workspace."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_workspace_invalid_uuid(self, client: TestClient) -> None:
        """Returns 404 for invalid workspace UUID."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": "not-a-uuid",
            },
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_empty_message(self, client: TestClient) -> None:
        """Returns 400 when message is empty or whitespace."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)
        resp = client.post(
            "/api/ai/chat",
            json={"message": "   ", "workspace_id": workspace_id},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400
        assert "Message is required" in resp.json()["detail"]

    def test_no_tables_in_workspace(self, client: TestClient) -> None:
        """Returns 400 when workspace has no data tables."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)
        resp = client.post(
            "/api/ai/chat",
            json={"message": "Hello", "workspace_id": workspace_id},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 400
        assert "No data tables" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_returns_text_and_sql(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns text and SQL on success."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "What is total revenue?",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["text"] == "The total revenue is $5,600."
        assert data["sql"] == "SELECT SUM(revenue) FROM sales"
        assert data["plot_spec"] is None

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_returns_plot_spec(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns plot spec when provided by AI service."""
        mock_chat.return_value = VALID_CHAT_WITH_PLOT

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Show revenue by region",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["plot_spec"] is not None
        assert data["plot_spec"]["marks"][0]["type"] == "barY"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_passes_history_to_service(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Conversation history is forwarded to the AI service."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        history = [
            {"role": "user", "content": "What tables do I have?"},
            {"role": "assistant", "content": "You have a sales table."},
        ]

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Tell me more",
                "workspace_id": workspace_id,
                "history": history,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        mock_chat.assert_called_once()
        call_args = mock_chat.call_args
        assert call_args[0][0] == "Tell me more"
        assert len(call_args[0][1]) == 2
        assert call_args[0][1][0]["role"] == "user"

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_passes_schema_to_service(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Schema and sample rows are passed to the AI service."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        client.post(
            "/api/ai/chat",
            json={
                "message": "Show me data",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        mock_chat.assert_called_once()
        call_args = mock_chat.call_args
        schema_arg = call_args[0][2]
        sample_rows_arg = call_args[0][3]

        assert len(schema_arg) == 1
        assert schema_arg[0]["table_name"] == "sales"
        assert "sales" in sample_rows_arg
        assert len(sample_rows_arg["sales"]) == 3

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_ai_service_error_returns_502(
        self, client: TestClient,
    ) -> None:
        """Returns 502 when AI service raises ValueError (missing key)."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 502
        assert "ANTHROPIC_API_KEY" in resp.json()["detail"]

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_ai_service_api_error_returns_502(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns 502 when the AI service raises a ValueError."""
        mock_chat.side_effect = ValueError("Claude API error: rate limited")

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 502
        assert "Claude API error" in resp.json()["detail"]

    def test_other_user_cannot_access_workspace(
        self, client: TestClient,
    ) -> None:
        """Returns 404 when trying to use another user's workspace."""
        token_a = _register_and_login(client, "chatA@test.com")
        token_b = _register_and_login(client, "chatB@test.com")

        workspace_id_a = _get_workspace_id(client, token_a)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id_a,
            },
            headers=_auth_headers(token_b),
        )

        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_missing_message_field(self, client: TestClient) -> None:
        """Returns 422 when message field is missing."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/chat",
            json={"workspace_id": "some-id"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422

    def test_missing_workspace_id_field(self, client: TestClient) -> None:
        """Returns 422 when workspace_id field is missing."""
        token = _register_and_login(client)
        resp = client.post(
            "/api/ai/chat",
            json={"message": "Hello"},
            headers=_auth_headers(token),
        )
        assert resp.status_code == 422

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_empty_history_defaults(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Request without history field uses empty list as default."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        mock_chat.assert_called_once()
        history_arg = mock_chat.call_args[0][1]
        assert history_arg == []

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_response_schema(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Response has exactly text, sql, and plot_spec fields."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        assert set(resp.json().keys()) == {"text", "sql", "plot_spec", "data_table"}

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_returns_data_table(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """Returns data_table when provided by AI service."""
        mock_chat.return_value = VALID_CHAT_WITH_TABLE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Show products",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["data_table"] is not None
        assert data["data_table"]["columns"] == ["name", "price"]
        assert len(data["data_table"]["rows"]) == 2

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key-123"})
    @patch("api.ai.ai_chat")
    def test_data_table_null_when_not_provided(
        self,
        mock_chat: MagicMock,
        client: TestClient,
    ) -> None:
        """data_table is null when AI service does not provide it."""
        mock_chat.return_value = VALID_CHAT_RESPONSE

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]
        _create_duckdb_with_table(db_path)

        resp = client.post(
            "/api/ai/chat",
            json={
                "message": "Hello",
                "workspace_id": workspace_id,
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        assert resp.json()["data_table"] is None
