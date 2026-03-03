"""app/models/scan_result.py — Scanned Azure resource records"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ScanResult(Base):
    __tablename__ = "scan_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    resource_id: Mapped[str] = mapped_column(Text, nullable=False)
    resource_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    cloud_provider: Mapped[str] = mapped_column(String(10), default="azure")
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tags: Mapped[dict] = mapped_column(JSONB, default={})
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False)
    attribute_group: Mapped[str] = mapped_column(String(50), nullable=False)
    raw_response: Mapped[dict] = mapped_column(JSONB, default={})
    scan_timestamp: Mapped[str] = mapped_column(server_default=func.now())
