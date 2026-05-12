"""External database connection service for find.bi.

Provides functionality to test, query, and persist connections to external
databases (PostgreSQL, MySQL, SQLite). Passwords are stored encrypted using
Fernet symmetric encryption derived from the application's JWT_SECRET.
"""

from __future__ import annotations

import hashlib
import os
import sqlite3
import uuid
from base64 import urlsafe_b64encode

from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from models.connection import ExternalConnection


# ---------------------------------------------------------------------------
# Encryption helpers
# ---------------------------------------------------------------------------


def _get_fernet_key() -> bytes:
    """Return a Fernet-compatible 32-byte key.

    Prefers the FERNET_KEY environment variable (a URL-safe base64-encoded
    32-byte key).  Falls back to deriving a deterministic key from JWT_SECRET
    so that development environments work without extra configuration.
    """
    fernet_key_env = os.environ.get("FERNET_KEY")
    if fernet_key_env:
        return fernet_key_env.encode()

    jwt_secret = os.environ.get("JWT_SECRET", "dev-secret-change-in-production")
    digest = hashlib.sha256(jwt_secret.encode()).digest()  # 32 raw bytes
    return urlsafe_b64encode(digest)  # Fernet requires url-safe base64


def _encrypt(plaintext: str) -> str:
    """Encrypt *plaintext* and return a URL-safe base64 ciphertext string."""
    f = Fernet(_get_fernet_key())
    return f.encrypt(plaintext.encode()).decode()


def _decrypt(ciphertext: str) -> str:
    """Decrypt a Fernet ciphertext string and return the plaintext."""
    f = Fernet(_get_fernet_key())
    return f.decrypt(ciphertext.encode()).decode()


# ---------------------------------------------------------------------------
# Connection testing
# ---------------------------------------------------------------------------


def test_connection(
    conn_type: str,
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
) -> dict:
    """Test an external database connection.

    Parameters
    ----------
    conn_type:
        One of ``"postgresql"``, ``"mysql"``, or ``"sqlite"``.
    host:
        Hostname or IP address (not used for SQLite).
    port:
        TCP port (not used for SQLite).
    database:
        Database name (or file path for SQLite).
    username:
        Login username (not used for SQLite).
    password:
        Plaintext password (not used for SQLite).

    Returns
    -------
    dict with keys:
        success – bool
        error   – str | None
        tables  – list[str]

    Raises
    ------
    ValueError
        For an unknown *conn_type*.
    """
    if conn_type == "postgresql":
        return _test_postgresql(host, port, database, username, password)
    elif conn_type == "mysql":
        return _test_mysql(host, port, database, username, password)
    elif conn_type == "sqlite":
        return _test_sqlite(database)
    else:
        raise ValueError(f"Unsupported connection type: {conn_type!r}")


def _test_postgresql(
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
) -> dict:
    try:
        import psycopg2  # type: ignore[import-untyped]

        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=database,
            user=username,
            password=password,
            connect_timeout=5,
        )
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname='public'"
            )
            tables = [row[0] for row in cur.fetchall()]
            cur.close()
        finally:
            conn.close()
        return {"success": True, "error": None, "tables": tables}
    except Exception as exc:
        return {"success": False, "error": str(exc), "tables": []}


def _test_mysql(
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
) -> dict:
    try:
        import pymysql  # type: ignore[import-untyped]

        conn = pymysql.connect(
            host=host,
            port=port or 3306,
            database=database,
            user=username,
            password=password or "",
            connect_timeout=5,
        )
        try:
            cur = conn.cursor()
            cur.execute("SHOW TABLES")
            tables = [row[0] for row in cur.fetchall()]
            cur.close()
        finally:
            conn.close()
        return {"success": True, "error": None, "tables": tables}
    except Exception as exc:
        return {"success": False, "error": str(exc), "tables": []}


def _test_sqlite(database: str) -> dict:
    try:
        conn = sqlite3.connect(database)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
            tables = [row[0] for row in cur.fetchall()]
            cur.close()
        finally:
            conn.close()
        return {"success": True, "error": None, "tables": tables}
    except Exception as exc:
        return {"success": False, "error": str(exc), "tables": []}


# ---------------------------------------------------------------------------
# Table listing
# ---------------------------------------------------------------------------


def list_external_tables(
    conn_type: str,
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
) -> list[str]:
    """Return table names from the specified external connection.

    Raises
    ------
    ValueError
        If the connection fails or conn_type is unknown.
    """
    result = test_connection(conn_type, host, port, database, username, password)
    if not result["success"]:
        raise ValueError(result["error"])
    return result["tables"]


# ---------------------------------------------------------------------------
# Query execution
# ---------------------------------------------------------------------------


def execute_external_query(
    conn_type: str,
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
    sql: str,
    limit: int = 1000,
) -> dict:
    """Execute a read-only SELECT on an external database.

    Parameters
    ----------
    sql:
        A SELECT statement to execute.
    limit:
        Maximum number of rows to fetch.

    Returns
    -------
    dict with keys:
        columns – list[str]
        rows    – list[list]

    Raises
    ------
    ValueError
        If *sql* is not a SELECT statement, conn_type is unknown, or the
        query fails.
    """
    if not sql.strip().upper().startswith("SELECT"):
        raise ValueError("Only SELECT statements are allowed")

    if conn_type == "postgresql":
        return _execute_postgresql(host, port, database, username, password, sql, limit)
    elif conn_type == "mysql":
        return _execute_mysql(host, port, database, username, password, sql, limit)
    elif conn_type == "sqlite":
        return _execute_sqlite(database, sql, limit)
    else:
        raise ValueError(f"Unsupported connection type: {conn_type!r}")


def _execute_postgresql(
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
    sql: str,
    limit: int,
) -> dict:
    import psycopg2  # type: ignore[import-untyped]

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=database,
        user=username,
        password=password,
        connect_timeout=5,
    )
    try:
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = [list(row) for row in cur.fetchmany(limit)]
        cur.close()
    finally:
        conn.close()
    return {"columns": columns, "rows": rows}


def _execute_mysql(
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
    sql: str,
    limit: int,
) -> dict:
    import pymysql  # type: ignore[import-untyped]

    conn = pymysql.connect(
        host=host,
        port=port or 3306,
        database=database,
        user=username,
        password=password or "",
        connect_timeout=5,
    )
    try:
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = [list(row) for row in cur.fetchmany(limit)]
        cur.close()
    finally:
        conn.close()
    return {"columns": columns, "rows": rows}


def _execute_sqlite(database: str, sql: str, limit: int) -> dict:
    conn = sqlite3.connect(database)
    try:
        cur = conn.cursor()
        cur.execute(sql)
        columns = [desc[0] for desc in cur.description] if cur.description else []
        rows = [list(row) for row in cur.fetchmany(limit)]
        cur.close()
    finally:
        conn.close()
    return {"columns": columns, "rows": rows}


# ---------------------------------------------------------------------------
# CRUD helpers (metadata DB)
# ---------------------------------------------------------------------------


def save_connection(
    db_session: Session,
    workspace_id: str,
    name: str,
    conn_type: str,
    host: str | None,
    port: int | None,
    database: str,
    username: str | None,
    password: str | None,
) -> ExternalConnection:
    """Persist a connection configuration to the metadata database.

    The password is Fernet-encrypted before storage.

    Returns
    -------
    The newly created :class:`ExternalConnection` instance.
    """
    encrypted_password: str | None = None
    if password:
        encrypted_password = _encrypt(password)

    conn = ExternalConnection(
        id=uuid.uuid4(),
        workspace_id=uuid.UUID(workspace_id),
        name=name,
        conn_type=conn_type,
        host=host,
        port=port,
        database=database,
        username=username,
        password_encrypted=encrypted_password,
    )
    db_session.add(conn)
    db_session.commit()
    db_session.refresh(conn)
    return conn


def get_connections(
    db_session: Session,
    workspace_id: str,
) -> list[ExternalConnection]:
    """List all external connections for the given workspace."""
    return (
        db_session.query(ExternalConnection)
        .filter(ExternalConnection.workspace_id == uuid.UUID(workspace_id))
        .all()
    )


def delete_connection(
    db_session: Session,
    workspace_id: str,
    connection_id: str,
) -> bool:
    """Delete a connection by id scoped to workspace.

    Returns
    -------
    True if the record was deleted, False if it was not found.
    """
    record = (
        db_session.query(ExternalConnection)
        .filter(
            ExternalConnection.workspace_id == uuid.UUID(workspace_id),
            ExternalConnection.id == uuid.UUID(connection_id),
        )
        .first()
    )
    if record is None:
        return False
    db_session.delete(record)
    db_session.commit()
    return True
