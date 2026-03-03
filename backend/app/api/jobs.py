"""app/api/jobs.py — Job polling endpoint"""
from __future__ import annotations
import uuid
import structlog
from fastapi import APIRouter, HTTPException
from fastapi.params import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.models.job import Job

log = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_session),
):
    """Poll job progress by ID."""
    try:
        uuid.UUID(job_id)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid job ID format: {job_id}")

    job = await db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    return {
        "id": str(job.id),
        "job_type": job.job_type,
        "status": job.status,
        "progress_pct": job.progress_pct,
        "current_step": job.current_step,
        "error_message": job.error_message,
        "result_id": job.result_id,
        "created_at": str(job.created_at),
        "updated_at": str(job.updated_at),
    }
