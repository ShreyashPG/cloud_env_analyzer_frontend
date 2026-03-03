"""app/models/report.py — Validation reports and individual findings"""
from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class ValidationReport(Base):
    __tablename__ = "validation_reports"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # rpt_{uuid12}
    scan_job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    cloud_provider: Mapped[str] = mapped_column(String(10), default="azure")
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    total: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)
    critical_failures: Mapped[int] = mapped_column(Integer, default=0)
    high_failures: Mapped[int] = mapped_column(Integer, default=0)
    deployment_ready: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[str] = mapped_column(server_default=func.now())

    findings: Mapped[list["Finding"]] = relationship(
        "Finding", back_populates="report", cascade="all, delete-orphan"
    )


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    report_id: Mapped[str] = mapped_column(
        String(20),
        ForeignKey("validation_reports.id", ondelete="CASCADE"),
        nullable=False,
    )
    prerequisite_id: Mapped[str] = mapped_column(String(20), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    resource_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    condition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    actual_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    expected_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped["ValidationReport"] = relationship(
        "ValidationReport", back_populates="findings"
    )
