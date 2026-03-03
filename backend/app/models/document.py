"""app/models/document.py — Uploaded documents and parsed text/tables"""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)  # pdf | docx
    file_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[str] = mapped_column(server_default=func.now())

    parsed: Mapped[list["ParsedDocument"]] = relationship(
        "ParsedDocument", back_populates="document", cascade="all, delete-orphan"
    )


class ParsedDocument(Base):
    __tablename__ = "parsed_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("uploaded_documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    sections: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    tables: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    parser_used: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parse_errors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[str] = mapped_column(server_default=func.now())

    document: Mapped["UploadedDocument"] = relationship(
        "UploadedDocument", back_populates="parsed"
    )
