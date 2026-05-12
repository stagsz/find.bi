"""SQLAlchemy model for webhook configuration."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class WebhookConfig(Base):
    """Webhook configuration associating an API key hash with a workspace table."""

    __tablename__ = "webhook_configs"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    api_key_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    table_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
