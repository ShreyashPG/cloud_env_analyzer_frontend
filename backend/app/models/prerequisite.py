"""app/models/prerequisite.py — Extracted infrastructure prerequisites"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Prerequisite(Base):
    __tablename__ = "prerequisites"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # pre_{uuid12}
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    extraction_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cloud_provider: Mapped[str] = mapped_column(String(10), default="azure")
    intent: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    conditions: Mapped[list] = mapped_column(JSONB, nullable=False)
    source_text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)
    review_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_at: Mapped[str] = mapped_column(server_default=func.now())
