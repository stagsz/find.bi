"""Tests for InsightCache model, cached insights endpoint, and auto-generation."""

import os
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
from models.insight_cache import InsightCache

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


VALID_INSIGHTS: list[dict[str, Any]] = [
    {
        "type": "trend",
        "title": "Revenue is increasing",
        "description": "Revenue shows an upward trend.",
        "severity": "info",
        "table": "sales",
        "columns": ["revenue"],
    },
]


# --- GET /api/ai/insights/cached ---


class TestCachedInsightsEndpoint:
    """Tests for GET /api/ai/insights/cached."""

    def test_requires_authentication(self, client: TestClient) -> None:
        resp = client.get("/api/ai/insights/cached?workspace_id=x")
        assert resp.status_code == 422

    def test_invalid_auth_token(self, client: TestClient) -> None:
        resp = client.get(
            "/api/ai/insights/cached?workspace_id=x",
            headers={"Authorization": "Bearer invalid-token"},
        )
        assert resp.status_code == 401

    def test_workspace_not_found(self, client: TestClient) -> None:
        token = _register_and_login(client)
        resp = client.get(
            "/api/ai/insights/cached?workspace_id="
            "00000000-0000-0000-0000-000000000000",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_workspace_invalid_uuid(self, client: TestClient) -> None:
        token = _register_and_login(client)
        resp = client.get(
            "/api/ai/insights/cached?workspace_id=not-a-uuid",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 404

    def test_returns_empty_when_no_cache(self, client: TestClient) -> None:
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        resp = client.get(
            f"/api/ai/insights/cached?workspace_id={workspace_id}",
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data["entries"] == []

    def test_returns_cached_insights(self, client: TestClient) -> None:
        """Returns ready insights from cache."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        # Insert a cache row directly
        import uuid as _uuid

        session = TestSession()
        cache = InsightCache(
            workspace_id=_uuid.UUID(workspace_id),
            table_name="sales",
            status="ready",
            insights_json=VALID_INSIGHTS,
        )
        session.add(cache)
        session.commit()
        session.close()

        resp = client.get(
            f"/api/ai/insights/cached?workspace_id={workspace_id}",
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["entries"]) == 1
        entry = data["entries"][0]
        assert entry["table_name"] == "sales"
        assert entry["status"] == "ready"
        assert len(entry["insights"]) == 1
        assert entry["insights"][0]["title"] == "Revenue is increasing"

    def test_returns_pending_status(self, client: TestClient) -> None:
        """Returns pending cache entries (no insights yet)."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        import uuid as _uuid

        session = TestSession()
        cache = InsightCache(
            workspace_id=_uuid.UUID(workspace_id),
            table_name="orders",
            status="pending",
            insights_json=[],
        )
        session.add(cache)
        session.commit()
        session.close()

        resp = client.get(
            f"/api/ai/insights/cached?workspace_id={workspace_id}",
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert len(data["entries"]) == 1
        assert data["entries"][0]["status"] == "pending"
        assert data["entries"][0]["insights"] == []

    def test_other_user_cannot_access_cache(
        self, client: TestClient,
    ) -> None:
        """Another user cannot read cached insights for someone else's workspace."""
        token_a = _register_and_login(client, "cacheA@test.com")
        token_b = _register_and_login(client, "cacheB@test.com")

        workspace_id_a = _get_workspace_id(client, token_a)

        resp = client.get(
            f"/api/ai/insights/cached?workspace_id={workspace_id_a}",
            headers=_auth_headers(token_b),
        )

        assert resp.status_code == 404
        assert "Workspace not found" in resp.json()["detail"]

    def test_response_schema(self, client: TestClient) -> None:
        """Response has entries field with correct structure."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        import uuid as _uuid

        session = TestSession()
        cache = InsightCache(
            workspace_id=_uuid.UUID(workspace_id),
            table_name="t",
            status="ready",
            insights_json=VALID_INSIGHTS,
        )
        session.add(cache)
        session.commit()
        session.close()

        resp = client.get(
            f"/api/ai/insights/cached?workspace_id={workspace_id}",
            headers=_auth_headers(token),
        )

        assert resp.status_code == 200
        data = resp.json()
        assert set(data.keys()) == {"entries"}
        entry = data["entries"][0]
        assert "table_name" in entry
        assert "status" in entry
        assert "insights" in entry
        insight = entry["insights"][0]
        assert "type" in insight
        assert "title" in insight
        assert "description" in insight
        assert "severity" in insight


# --- Background generation integration ---


class TestInsightBackgroundGeneration:
    """Tests that ingest triggers background insight generation."""

    @patch("api.data.generate_and_cache_insights")
    def test_ingest_triggers_background_insights(
        self,
        mock_generate: MagicMock,
        client: TestClient,
        tmp_path: Any,
    ) -> None:
        """POST /api/data/ingest calls generate_and_cache_insights in background."""
        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        # Get workspace db_path
        ws_resp = client.get(
            "/api/workspaces/", headers=_auth_headers(token),
        )
        db_path = ws_resp.json()[0]["duckdb_path"]

        # Create a CSV file in the right upload dir
        user_resp = client.get(
            "/api/auth/me", headers=_auth_headers(token),
        )
        user_id = user_resp.json()["id"]
        upload_dir = os.path.join(
            os.environ.get("DUCKDB_PATH", "/data/workspaces"),
            user_id,
            workspace_id,
            "uploads",
        )
        os.makedirs(upload_dir, exist_ok=True)
        csv_path = os.path.join(upload_dir, "test.csv")
        with open(csv_path, "w") as f:
            f.write("a,b\n1,2\n3,4\n")

        resp = client.post(
            "/api/data/ingest",
            json={
                "file_path": csv_path,
                "workspace_id": workspace_id,
                "table_name": "test_table",
            },
            headers=_auth_headers(token),
        )

        assert resp.status_code == 201

        # Background task is called with correct args
        mock_generate.assert_called_once_with(
            workspace_id,
            "test_table",
            db_path,
        )


# --- generate_and_cache_insights unit test ---


class TestGenerateAndCacheInsights:
    """Tests for the background task function."""

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": "test-key"})
    @patch("services.ai_service.generate_insights")
    def test_creates_cache_entry_on_success(
        self,
        mock_generate: MagicMock,
        client: TestClient,
        tmp_path: Any,
    ) -> None:
        """Background task creates a cache row with ready status."""
        mock_generate.return_value = {"insights": VALID_INSIGHTS}

        from services.ai_service import generate_and_cache_insights

        # Create a DuckDB file
        db_path = str(tmp_path / "test.db")
        conn = duckdb.connect(db_path)
        conn.execute("CREATE TABLE sales (a INTEGER)")
        conn.execute("INSERT INTO sales VALUES (1)")
        conn.close()

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        with patch("db.SessionLocal", TestSession):
            generate_and_cache_insights(workspace_id, "sales", db_path)

        session = TestSession()
        import uuid as _uuid

        cache = (
            session.query(InsightCache)
            .filter(
                InsightCache.workspace_id == _uuid.UUID(workspace_id),
                InsightCache.table_name == "sales",
            )
            .first()
        )
        assert cache is not None
        assert cache.status == "ready"
        assert len(cache.insights_json) == 1
        assert cache.insights_json[0]["title"] == "Revenue is increasing"
        session.close()

    @patch.dict("os.environ", {"ANTHROPIC_API_KEY": ""})
    def test_marks_error_on_failure(
        self, client: TestClient, tmp_path: Any,
    ) -> None:
        """Background task marks cache as error when generation fails."""
        from services.ai_service import generate_and_cache_insights

        db_path = str(tmp_path / "test.db")
        conn = duckdb.connect(db_path)
        conn.execute("CREATE TABLE orders (id INTEGER)")
        conn.execute("INSERT INTO orders VALUES (1)")
        conn.close()

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        with patch("db.SessionLocal", TestSession):
            generate_and_cache_insights(workspace_id, "orders", db_path)

        session = TestSession()
        import uuid as _uuid

        cache = (
            session.query(InsightCache)
            .filter(
                InsightCache.workspace_id == _uuid.UUID(workspace_id),
                InsightCache.table_name == "orders",
            )
            .first()
        )
        assert cache is not None
        assert cache.status == "error"
        session.close()

    def test_marks_error_when_db_missing(
        self, client: TestClient,
    ) -> None:
        """Background task marks error when DuckDB file doesn't exist."""
        from services.ai_service import generate_and_cache_insights

        token = _register_and_login(client)
        workspace_id = _get_workspace_id(client, token)

        with patch("db.SessionLocal", TestSession):
            generate_and_cache_insights(
                workspace_id, "tbl", "/nonexistent/path.db",
            )

        session = TestSession()
        import uuid as _uuid

        cache = (
            session.query(InsightCache)
            .filter(
                InsightCache.workspace_id == _uuid.UUID(workspace_id),
                InsightCache.table_name == "tbl",
            )
            .first()
        )
        assert cache is not None
        assert cache.status == "error"
        session.close()
