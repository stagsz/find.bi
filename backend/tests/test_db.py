from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

import db as db_module


def test_get_db_yields_session() -> None:
    """get_db dependency yields a working session and closes it."""
    test_engine = create_engine("sqlite:///:memory:")
    test_session_factory = sessionmaker(bind=test_engine)

    with patch.object(db_module, "SessionLocal", test_session_factory):
        gen = db_module.get_db()
        session = next(gen)

        assert isinstance(session, Session)
        result = session.execute(text("SELECT 1"))
        assert result.scalar() == 1

        # Exhaust the generator to trigger cleanup
        try:
            next(gen)
        except StopIteration:
            pass


def test_get_db_closes_session_on_exception() -> None:
    """get_db calls close() on the session even when an exception occurs."""
    mock_session = MagicMock(spec=Session)
    mock_factory = MagicMock(return_value=mock_session)

    with patch.object(db_module, "SessionLocal", mock_factory):
        gen = db_module.get_db()
        session = next(gen)

        assert session is mock_session

        # Simulate an exception — close() should still be called
        try:
            gen.throw(RuntimeError("simulated error"))
        except RuntimeError:
            pass

        mock_session.close.assert_called_once()


def test_session_local_is_configured() -> None:
    """SessionLocal is a sessionmaker bound to an engine."""
    assert db_module.SessionLocal is not None
    assert db_module.engine is not None


def test_database_url_default() -> None:
    """DATABASE_URL falls back to local PostgreSQL."""
    assert "ralph" in db_module.DATABASE_URL
    assert "postgresql" in db_module.DATABASE_URL
