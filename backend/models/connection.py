"""SQLAlchemy model for external database connections."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class ExternalConnection(Base):
    """Stores configuration for an external database connection (PostgreSQL, MySQL, SQLite)."""

    __tablename__ = "external_connections"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    conn_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    host: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    port: Mapped[int | None] = mapped_column(
        Integer(),
        nullable=True,
    )
    database: Mapped[str] = mapped_column(
        String(1024),
        nullable=False,
    )
    username: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    password_encrypted: Mapped[str | None] = mapped_column(
        String(2048),
        nullable=True,
    )
