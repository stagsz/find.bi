"""Alert model: threshold-based alerts evaluated against workspace DuckDB queries."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Alert(Base):
    """An alert that fires when a SQL query result crosses a threshold."""

    __tablename__ = "alerts"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sql_query: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        doc="SELECT query that must return a single numeric value.",
    )
    condition: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        doc="Comparison operator: gt, lt, eq, gte, lte.",
    )
    threshold: Mapped[float] = mapped_column(Float, nullable=False)
    channel: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        doc="Delivery channel: browser, email, webhook.",
    )
    webhook_url: Mapped[str | None] = mapped_column(
        String(2048), nullable=True, default=None,
    )
    email: Mapped[str | None] = mapped_column(
        String(255), nullable=True, default=None,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True,
    )
    last_triggered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None,
    )
    last_value: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=None,
    )
