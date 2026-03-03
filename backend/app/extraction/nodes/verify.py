"""app/extraction/nodes/verify.py — Confidence flagging node (no LLM calls)"""
from __future__ import annotations

import structlog

from app.extraction.state import ExtractionState

log = structlog.get_logger(__name__)


async def verify_node(state: ExtractionState) -> dict:
    """
    Checks confidence of each requirement and sets review_required flag.
    Does NOT call the LLM again — confidence flagging only.

    Flagging rules:
    - intent == "will_be_created"  → always review_required=True
    - confidence < threshold       → review_required=True
    - else                         → review_required=False
    """
    from app.config import get_settings

    settings = get_settings()
    flag_threshold = settings.extraction_confidence_threshold

    flagged = []
    for req in state.get("raw_requirements", []):
        r = dict(req)
        confidence = float(r.get("confidence", 0.0))
        intent = r.get("intent", "must_exist_before")

        if intent == "will_be_created":
            r["review_required"] = True
            r["review_reason"] = (
                "intent is will_be_created — verify Terraform/IaC handles this"
            )
        elif confidence < flag_threshold:
            r["review_required"] = True
            r["review_reason"] = (
                f"confidence {confidence:.2f} below threshold {flag_threshold}"
            )
        else:
            r["review_required"] = False
            r["review_reason"] = None

        flagged.append(r)

    log.info(
        "verify_node_complete",
        total=len(flagged),
        for_review=sum(1 for r in flagged if r["review_required"]),
    )

    return {"requirements_with_flags": flagged}
