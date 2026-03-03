"""app/api/scans.py — Scan initiation endpoint"""
from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.models.job import Job
from app.models.prerequisite import Prerequisite

log = structlog.get_logger(__name__)

router = APIRouter()


class ScanRequest(BaseModel):
    document_id: str
    resource_group: str | None = None
    region: str = "eastus"


@router.post("/scans", status_code=202)
async def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
):
    """
    Start an Azure scan for the given document's approved prerequisites.
    Returns 202 with job_id to poll.
    """
    # Check for approved prerequisites
    result = await db.execute(
        select(Prerequisite).where(
            Prerequisite.document_id == request.document_id,
            Prerequisite.review_required == False,  # noqa: E712
        )
    )
    approved = result.scalars().all()

    if not approved:
        raise HTTPException(
            status_code=400,
            detail="No approved prerequisites found. "
            "Complete document extraction and review first.",
        )

    # Create scan Job
    job_id = uuid.uuid4()
    job = Job(
        id=job_id,
        job_type="scan",
        status="pending",
        progress_pct=0,
        current_step="queued",
    )
    db.add(job)
    await db.commit()

    from app.background.scan_task import run_scan

    background_tasks.add_task(
        run_scan,
        str(job_id),
        request.document_id,
        request.resource_group,
        request.region,
    )

    log.info(
        "scan_started",
        job_id=str(job_id),
        document_id=request.document_id,
        approved_count=len(approved),
        region=request.region,
    )

    return {
        "job_id": str(job_id),
        "document_id": request.document_id,
        "message": "Scan started",
        "approved_prerequisites": len(approved),
    }
