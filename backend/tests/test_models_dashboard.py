import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from models.base import Base
from models.dashboard import Dashboard
from models.user import User
from models.workspace import Workspace

engine = create_engine("sqlite:///:memory:")
Base.metadata.create_all(engine)
TestSession = sessionmaker(bind=engine)


def _make_user(
    session: Session,
    email: str = "ralph@springfield.edu",
) -> User:
    user = User(
        email=email,
        password_hash="$2b$12$fakehashvalue",
        display_name="Ralph Wiggum",
    )
    session.add(user)
    session.flush()
    return user


def _make_workspace(
    session: Session,
    owner_id: uuid.UUID,
    name: str = "Default Workspace",
) -> Workspace:
    ws = Workspace(
        name=name,
        owner_id=owner_id,
        duckdb_path="/data/workspaces/test/default.db",
    )
    session.add(ws)
    session.flush()
    return ws


def _make_dashboard(
    session: Session,
    workspace_id: uuid.UUID,
    name: str = "Sales Dashboard",
    layout_json: dict | None = None,
    cards_json: dict | None = None,
    filters_json: dict | None = None,
) -> Dashboard:
    dash = Dashboard(
        workspace_id=workspace_id,
        name=name,
        layout_json=layout_json if layout_json is not None else {},
        cards_json=cards_json if cards_json is not None else {},
        filters_json=filters_json if filters_json is not None else {},
    )
    session.add(dash)
    session.flush()
    return dash


# --- Table metadata ---


def test_dashboard_table_exists() -> None:
    """The dashboards table is registered in Base metadata."""
    assert "dashboards" in Base.metadata.tables


def test_dashboard_has_expected_columns() -> None:
    """The dashboards table has all required columns."""
    col_names = {c.name for c in Base.metadata.tables["dashboards"].columns}
    assert "id" in col_names
    assert "workspace_id" in col_names
    assert "name" in col_names
    assert "layout_json" in col_names
    assert "cards_json" in col_names
    assert "filters_json" in col_names
    assert "created_at" in col_names
    assert "updated_at" in col_names


def test_dashboard_inherits_base_columns() -> None:
    """Dashboard inherits id, created_at, updated_at from Base."""
    table = Base.metadata.tables["dashboards"]
    col_names = {c.name for c in table.columns}
    assert "id" in col_names
    assert "created_at" in col_names
    assert "updated_at" in col_names


# --- Instance creation ---


def test_dashboard_id_is_uuid() -> None:
    """A new dashboard gets an auto-generated UUID id."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id)
        assert isinstance(dash.id, uuid.UUID)
    finally:
        session.rollback()
        session.close()


def test_dashboard_stores_name() -> None:
    """Dashboard name is stored and retrievable."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id, name="Revenue Report")
        assert dash.name == "Revenue Report"
    finally:
        session.rollback()
        session.close()


def test_dashboard_stores_workspace_id() -> None:
    """Dashboard workspace_id references the workspace."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id)
        assert dash.workspace_id == ws.id
    finally:
        session.rollback()
        session.close()


def test_dashboard_stores_layout_json() -> None:
    """Dashboard stores layout configuration as JSON."""
    layout = {"items": [{"i": "c1", "x": 0, "y": 0, "w": 4, "h": 3}]}
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id, layout_json=layout)
        assert dash.layout_json == layout
    finally:
        session.rollback()
        session.close()


def test_dashboard_stores_cards_json() -> None:
    """Dashboard stores card configurations as JSON."""
    cards = {
        "cards": [
            {
                "id": "c1",
                "type": "bar",
                "title": "Revenue",
                "query": "SELECT region, revenue FROM sales",
            }
        ]
    }
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id, cards_json=cards)
        assert dash.cards_json == cards
    finally:
        session.rollback()
        session.close()


def test_dashboard_stores_filters_json() -> None:
    """Dashboard stores filter configurations as JSON."""
    filters = {
        "filters": [
            {"id": "f1", "type": "search", "label": "Name", "column": "name"}
        ],
        "values": {"f1": "test"},
    }
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id, filters_json=filters)
        assert dash.filters_json == filters
    finally:
        session.rollback()
        session.close()


def test_dashboard_defaults_json_to_empty_dict() -> None:
    """JSON columns default to empty dict when not provided."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        dash = _make_dashboard(session, workspace_id=ws.id)
        assert dash.layout_json == {}
        assert dash.cards_json == {}
        assert dash.filters_json == {}
    finally:
        session.rollback()
        session.close()


def test_two_dashboards_have_distinct_ids() -> None:
    """Each dashboard receives a unique UUID."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        a = _make_dashboard(session, workspace_id=ws.id, name="Dashboard A")
        b = _make_dashboard(session, workspace_id=ws.id, name="Dashboard B")
        assert a.id != b.id
    finally:
        session.rollback()
        session.close()


def test_workspace_can_have_multiple_dashboards() -> None:
    """A single workspace can contain multiple dashboards."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws = _make_workspace(session, owner_id=user.id)
        d1 = _make_dashboard(session, workspace_id=ws.id, name="Sales")
        d2 = _make_dashboard(session, workspace_id=ws.id, name="Marketing")
        results = (
            session.query(Dashboard)
            .filter(Dashboard.workspace_id == ws.id)
            .all()
        )
        assert len(results) == 2
        ids = {d.id for d in results}
        assert d1.id in ids
        assert d2.id in ids
    finally:
        session.rollback()
        session.close()


def test_dashboard_queryable_by_workspace_id() -> None:
    """Dashboards can be queried by workspace_id (indexed column)."""
    session: Session = TestSession()
    try:
        user = _make_user(session)
        ws1 = _make_workspace(session, owner_id=user.id, name="WS 1")
        ws2 = _make_workspace(session, owner_id=user.id, name="WS 2")
        _make_dashboard(session, workspace_id=ws1.id, name="WS1 Dash")
        _make_dashboard(session, workspace_id=ws2.id, name="WS2 Dash A")
        _make_dashboard(session, workspace_id=ws2.id, name="WS2 Dash B")

        ws1_results = (
            session.query(Dashboard)
            .filter(Dashboard.workspace_id == ws1.id)
            .all()
        )
        ws2_results = (
            session.query(Dashboard)
            .filter(Dashboard.workspace_id == ws2.id)
            .all()
        )
        assert len(ws1_results) == 1
        assert len(ws2_results) == 2
    finally:
        session.rollback()
        session.close()
