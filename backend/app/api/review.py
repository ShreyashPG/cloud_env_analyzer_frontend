"""app/api/review.py — Human review queue endpoints"""
from __future__ import annotations

from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session
from app.models.prerequisite import Prerequisite
from app.models.review import ReviewQueueItem

log = structlog.get_logger(__name__)

router = APIRouter()


class ResolveRequest(BaseModel):
    resolution: str  # approved | rejected | modified
    note: str | None = None
    modified_conditions: list | None = None


@router.get("/review")
async def list_review_items(
    document_id: str | None = None,
    db: AsyncSession = Depends(get_session),
):
    """
    List unresolved review items with their prerequisite details.
    Optionally filter by document_id.
    """
    query = select(ReviewQueueItem).where(ReviewQueueItem.resolved == False)  # noqa: E712

    if document_id:
        # Join through prerequisites to filter by document
        query = (
            select(ReviewQueueItem)
            .join(
                Prerequisite,
                ReviewQueueItem.prerequisite_id == Prerequisite.id,
            )
            .where(
                ReviewQueueItem.resolved == False,  # noqa: E712
                Prerequisite.document_id == document_id,
            )
        )

    result = await db.execute(query)
    items = result.scalars().all()

    # Enrich with prerequisite details
    output = []
    for item in items:
        prereq = await db.get(Prerequisite, item.prerequisite_id)
        output.append(
            {
                "id": str(item.id),
                "prerequisite_id": item.prerequisite_id,
                "reason": item.reason,
                "resolved": item.resolved,
                "resolution": item.resolution,
                "reviewer_note": item.reviewer_note,
                "created_at": str(item.created_at),
                "prerequisite": {
                    "id": prereq.id,
                    "resource_type": prereq.resource_type,
                    "category": prereq.category,
                    "severity": prereq.severity,
                    "intent": prereq.intent,
                    "conditions": prereq.conditions,
                    "source_text": prereq.source_text,
                    "confidence": prereq.confidence,
                    "review_reason": prereq.review_reason,
                }
                if prereq
                else None,
            }
        )

    return {"items": output, "total": len(output)}


@router.post("/review/{item_id}/resolve")
async def resolve_review_item(
    item_id: str,
    request: ResolveRequest,
    db: AsyncSession = Depends(get_session),
):
    """
    Resolve a review item.
    - approved: mark prerequisite as approved (review_required=False)
    - rejected: mark item resolved but prerequisite stays flagged
    - modified: update conditions, mark approved
    """
    item = await db.get(ReviewQueueItem, item_id)
    if not item:
        raise HTTPException(status_code=404, detail=f"Review item {item_id} not found")

    if item.resolved:
        raise HTTPException(status_code=409, detail="Item already resolved")

    allowed = {"approved", "rejected", "modified"}
    if request.resolution not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid resolution. Must be one of: {', '.join(allowed)}",
        )

    prereq = await db.get(Prerequisite, item.prerequisite_id)
    if not prereq:
        raise HTTPException(
            status_code=404,
            detail=f"Prerequisite {item.prerequisite_id} not found",
        )

    now = str(datetime.now(timezone.utc))

    if request.resolution == "approved":
        prereq.review_required = False
        item.resolved = True
        item.resolution = "approved"
        item.reviewer_note = request.note
        item.resolved_at = now

    elif request.resolution == "rejected":
        # Prerequisite stays review_required=True — won't be scanned
        item.resolved = True
        item.resolution = "rejected"
        item.reviewer_note = request.note
        item.resolved_at = now

    elif request.resolution == "modified":
        if request.modified_conditions:
            prereq.conditions = request.modified_conditions
        prereq.review_required = False
        item.resolved = True
        item.resolution = "modified"
        item.reviewer_note = request.note
        item.resolved_at = now

    await db.commit()

    log.info(
        "review_resolved",
        item_id=item_id,
        prerequisite_id=item.prerequisite_id,
        resolution=request.resolution,
    )

    return {
        "id": str(item.id),
        "prerequisite_id": item.prerequisite_id,
        "resolution": item.resolution,
        "prerequisite": {
            "id": prereq.id,
            "review_required": prereq.review_required,
            "conditions": prereq.conditions,
        },
    }
