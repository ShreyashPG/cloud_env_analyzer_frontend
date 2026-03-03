"""app/background/runner.py — Utility to update job progress in DB"""
from __future__ import annotations

import structlog
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

log = structlog.get_logger(__name__)


async def update_job(
    db: AsyncSession,
    job_id: str,
    status: str,
    progress: int,
    step: str,
    error: str | None = None,
    result_id: str | None = None,
) -> None:
    """Update job row — called throughout background tasks for progress tracking."""
    from app.models.job import Job

    try:
        values: dict = {
            "status": status,
            "progress_pct": progress,
            "current_step": step,
        }
        if error is not None:
            values["error_message"] = error
        if result_id is not None:
            values["result_id"] = result_id

        await db.execute(update(Job).where(Job.id == job_id).values(**values))
        await db.commit()
    except Exception as e:
        log.error("update_job_failed", job_id=job_id, error=str(e))
