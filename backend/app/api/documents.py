"""app/api/documents.py — Document upload and prerequisites endpoints"""
from __future__ import annotations

import hashlib
import uuid

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.models.document import UploadedDocument
from app.models.job import Job
from app.models.prerequisite import Prerequisite

log = structlog.get_logger(__name__)

router = APIRouter()

ALLOWED_EXTENSIONS = {"pdf", "docx"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB


@router.post("/documents", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile,
    db: AsyncSession = Depends(get_session),
):
    """
    Upload a PDF or DOCX prerequisites document.
    Returns 202 with job_id to poll for progress.
    """
    # Validate file extension
    filename = file.filename or ""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Accepted: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and size-check
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size: 50 MB",
        )

    # Deduplicate by content hash
    content_hash = hashlib.sha256(file_bytes).hexdigest()

    existing = await db.execute(
        select(UploadedDocument).where(
            UploadedDocument.content_hash == content_hash
        )
    )
    existing_doc = existing.scalar_one_or_none()

    if existing_doc:
        log.info("document_deduplicated", document_id=str(existing_doc.id))
        return {
            "document_id": str(existing_doc.id),
            "message": "Document already processed (content hash match)",
            "status": "existing",
        }

    # Create UploadedDocument
    document_id = uuid.uuid4()
    doc = UploadedDocument(
        id=document_id,
        filename=filename,
        file_type=ext,
        file_bytes=file_bytes,
        content_hash=content_hash,
        file_size_bytes=len(file_bytes),
    )
    db.add(doc)

    # Create extraction Job
    job_id = uuid.uuid4()
    job = Job(
        id=job_id,
        job_type="extraction",
        status="pending",
        progress_pct=0,
        current_step="queued",
    )
    db.add(job)
    await db.commit()

    # Dispatch background extraction
    from app.background.extract_task import run_extraction

    background_tasks.add_task(run_extraction, str(document_id), str(job_id))

    log.info(
        "document_uploaded",
        document_id=str(document_id),
        job_id=str(job_id),
        filename=filename,
        size_bytes=len(file_bytes),
    )

    return {
        "job_id": str(job_id),
        "document_id": str(document_id),
        "message": "Extraction started",
    }


@router.get("/documents/{document_id}/prerequisites")
async def get_prerequisites(
    document_id: str,
    db: AsyncSession = Depends(get_session),
):
    """Return all prerequisites for a document grouped by review status."""
    result = await db.execute(
        select(Prerequisite).where(Prerequisite.document_id == document_id)
    )
    prereqs = result.scalars().all()

    if not prereqs:
        # Check if document exists
        doc = await db.get(UploadedDocument, document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

    approved = []
    pending_review = []

    for p in prereqs:
        data = {
            "id": p.id,
            "category": p.category,
            "resource_type": p.resource_type,
            "cloud_provider": p.cloud_provider,
            "intent": p.intent,
            "severity": p.severity,
            "conditions": p.conditions,
            "source_text": p.source_text,
            "confidence": p.confidence,
            "review_required": p.review_required,
            "review_reason": p.review_reason,
            "extracted_at": str(p.extracted_at),
        }
        if p.review_required:
            pending_review.append(data)
        else:
            approved.append(data)

    return {
        "document_id": document_id,
        "total": len(prereqs),
        "approved": approved,
        "pending_review": pending_review,
    }
