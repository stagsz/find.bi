"""Tests for connection_service: test_connection, execute_external_query, encrypt/decrypt."""

from __future__ import annotations

import sqlite3
from unittest.mock import MagicMock, patch

import pytest

import services.connection_service as svc


# ---------------------------------------------------------------------------
# Encrypt / decrypt roundtrip
# ---------------------------------------------------------------------------


class TestEncryptDecrypt:
    def test_roundtrip(self) -> None:
        """Encrypt then decrypt returns the original string."""
        plaintext = "super-secret-password"
        ciphertext = svc._encrypt(plaintext)
        assert ciphertext != plaintext
        assert svc._decrypt(ciphertext) == plaintext

    def test_different_ciphertexts_each_call(self) -> None:
        """Fernet produces different ciphertext on every call (IV randomisation)."""
        ct1 = svc._encrypt("hello")
        ct2 = svc._encrypt("hello")
        assert ct1 != ct2  # each call uses a fresh IV

    def test_decrypt_wrong_key_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Decrypting with a different key raises an exception."""
        from cryptography.fernet import Fernet, InvalidToken

        ct = svc._encrypt("secret")

        # Force a new random Fernet key to simulate key mismatch
        new_key = Fernet.generate_key()
        monkeypatch.setenv("FERNET_KEY", new_key.decode())
        # Clear cached key by forcing re-read
        with pytest.raises(InvalidToken):
            svc._decrypt(ct)


# ---------------------------------------------------------------------------
# test_connection — PostgreSQL
# ---------------------------------------------------------------------------


class TestTestConnectionPostgreSQL:
    def test_postgresql_success(self) -> None:
        """Returns success with table list on valid connection."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = [("orders",), ("customers",)]
        mock_conn.cursor.return_value = mock_cur

        with patch("psycopg2.connect", return_value=mock_conn):
            result = svc.test_connection(
                "postgresql", "localhost", 5432, "mydb", "user", "pass"
            )

        assert result["success"] is True
        assert result["error"] is None
        assert set(result["tables"]) == {"orders", "customers"}

    def test_postgresql_failure(self) -> None:
        """Returns failure dict when psycopg2 raises."""
        with patch("psycopg2.connect", side_effect=Exception("refused")):
            result = svc.test_connection(
                "postgresql", "badhost", 5432, "mydb", "user", "pass"
            )

        assert result["success"] is False
        assert "refused" in result["error"]
        assert result["tables"] == []


# ---------------------------------------------------------------------------
# test_connection — MySQL
# ---------------------------------------------------------------------------


class TestTestConnectionMySQL:
    def test_mysql_success(self) -> None:
        """Returns success with table list on valid MySQL connection."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.fetchall.return_value = [("products",), ("sales",)]
        mock_conn.cursor.return_value = mock_cur

        with patch("pymysql.connect", return_value=mock_conn):
            result = svc.test_connection(
                "mysql", "localhost", 3306, "shopdb", "root", "toor"
            )

        assert result["success"] is True
        assert set(result["tables"]) == {"products", "sales"}

    def test_mysql_failure(self) -> None:
        """Returns failure dict when pymysql raises."""
        with patch("pymysql.connect", side_effect=Exception("Access denied")):
            result = svc.test_connection(
                "mysql", "localhost", 3306, "db", "user", "wrong"
            )

        assert result["success"] is False
        assert "Access denied" in result["error"]
        assert result["tables"] == []


# ---------------------------------------------------------------------------
# test_connection — SQLite
# ---------------------------------------------------------------------------


class TestTestConnectionSQLite:
    def test_sqlite_success(self, tmp_path: object) -> None:
        """Returns success and lists tables from a real SQLite file."""
        db_file = str(tmp_path) + "/test.db"  # type: ignore[operator]
        conn = sqlite3.connect(db_file)
        conn.execute("CREATE TABLE alpha (id INTEGER)")
        conn.execute("CREATE TABLE beta (name TEXT)")
        conn.commit()
        conn.close()

        result = svc.test_connection("sqlite", None, None, db_file, None, None)

        assert result["success"] is True
        assert set(result["tables"]) == {"alpha", "beta"}

    def test_sqlite_failure(self) -> None:
        """Returns failure for a bad SQLite path (directory, not file)."""
        with patch("sqlite3.connect", side_effect=Exception("no such file")):
            result = svc.test_connection("sqlite", None, None, "/bad/path.db", None, None)

        assert result["success"] is False
        assert result["tables"] == []

    def test_unknown_conn_type_raises(self) -> None:
        """ValueError for an unrecognised connection type."""
        with pytest.raises(ValueError, match="Unsupported connection type"):
            svc.test_connection("oracle", None, None, "db", None, None)


# ---------------------------------------------------------------------------
# execute_external_query
# ---------------------------------------------------------------------------


class TestExecuteExternalQuery:
    def test_non_select_rejected(self) -> None:
        """Non-SELECT sql raises ValueError."""
        with pytest.raises(ValueError, match="Only SELECT"):
            svc.execute_external_query(
                "sqlite", None, None, ":memory:", None, None,
                "DROP TABLE foo",
            )

    def test_insert_rejected(self) -> None:
        """INSERT is not allowed."""
        with pytest.raises(ValueError, match="Only SELECT"):
            svc.execute_external_query(
                "sqlite", None, None, ":memory:", None, None,
                "INSERT INTO t VALUES (1)",
            )

    def test_sqlite_query_success(self, tmp_path: object) -> None:
        """Runs a real SELECT on SQLite, returns columns and rows."""
        db_file = str(tmp_path) + "/q.db"  # type: ignore[operator]
        conn = sqlite3.connect(db_file)
        conn.execute("CREATE TABLE nums (n INTEGER)")
        conn.executemany("INSERT INTO nums VALUES (?)", [(i,) for i in range(5)])
        conn.commit()
        conn.close()

        result = svc.execute_external_query(
            "sqlite", None, None, db_file, None, None,
            "SELECT n FROM nums ORDER BY n",
        )

        assert result["columns"] == ["n"]
        assert result["rows"] == [[0], [1], [2], [3], [4]]

    def test_sqlite_limit_respected(self, tmp_path: object) -> None:
        """limit parameter caps the number of rows returned."""
        db_file = str(tmp_path) + "/big.db"  # type: ignore[operator]
        conn = sqlite3.connect(db_file)
        conn.execute("CREATE TABLE t (x INTEGER)")
        conn.executemany("INSERT INTO t VALUES (?)", [(i,) for i in range(100)])
        conn.commit()
        conn.close()

        result = svc.execute_external_query(
            "sqlite", None, None, db_file, None, None,
            "SELECT x FROM t",
            limit=10,
        )
        assert len(result["rows"]) == 10

    def test_postgresql_query_success(self) -> None:
        """execute_external_query works for postgresql via mock."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.description = [("id", None), ("name", None)]
        mock_cur.fetchmany.return_value = [(1, "Alice"), (2, "Bob")]
        mock_conn.cursor.return_value = mock_cur

        with patch("psycopg2.connect", return_value=mock_conn):
            result = svc.execute_external_query(
                "postgresql", "localhost", 5432, "mydb", "user", "pass",
                "SELECT id, name FROM users",
            )

        assert result["columns"] == ["id", "name"]
        assert result["rows"] == [[1, "Alice"], [2, "Bob"]]

    def test_mysql_query_success(self) -> None:
        """execute_external_query works for mysql via mock."""
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_cur.description = [("score", None)]
        mock_cur.fetchmany.return_value = [(99,), (88,)]
        mock_conn.cursor.return_value = mock_cur

        with patch("pymysql.connect", return_value=mock_conn):
            result = svc.execute_external_query(
                "mysql", "localhost", 3306, "db", "user", "pass",
                "SELECT score FROM results",
            )

        assert result["columns"] == ["score"]
        assert result["rows"] == [[99], [88]]

    def test_unknown_type_raises(self) -> None:
        """ValueError for unknown conn_type in execute_external_query."""
        with pytest.raises(ValueError, match="Unsupported connection type"):
            svc.execute_external_query(
                "mssql", None, None, "db", None, None, "SELECT 1",
            )
