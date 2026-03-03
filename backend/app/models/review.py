"""app/models/review.py — Human review queue for low-confidence prerequisites"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ReviewQueueItem(Base):
    __tablename__ = "review_queue_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    prerequisite_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("prerequisites.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # approved | rejected | modified
    reviewer_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(server_default=func.now())
    resolved_at: Mapped[str | None] = mapped_column(nullable=True)
