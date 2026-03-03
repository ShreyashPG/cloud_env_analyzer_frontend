"""app/extraction/nodes/validate.py — Maps raw LLM output to typed Prerequisite objects"""
from __future__ import annotations

import structlog

from app.core.types import (
    ATTRIBUTE_TO_GROUP,
    RESOURCE_TYPE_TO_CATEGORY,
    VALID_ATTRIBUTE_NAMES,
    VALID_OPERATORS,
    VALID_RESOURCE_TYPES,
    CloudProvider,
    Condition,
    Operator,
    Prerequisite,
    ResourceCategory,
    ResourceIntent,
    ResourceType,
    Severity,
)
from app.extraction.state import ExtractionState

log = structlog.get_logger(__name__)


def _map_to_prerequisite(req: dict) -> Prerequisite | None:
    """
    Converts a raw requirement dict (with review_required flag) to a Prerequisite.
    Returns None if fundamentally invalid (wrong resource_type, all conditions invalid).
    Returns Prerequisite with review_required=True if any condition attribute is invalid.
    """
    # Validate resource_type
    resource_type_str = req.get("resource_type", "")
    if resource_type_str not in VALID_RESOURCE_TYPES:
        log.warning("invalid_resource_type", value=resource_type_str)
        return None

    resource_type = ResourceType(resource_type_str)
    category = RESOURCE_TYPE_TO_CATEGORY.get(
        resource_type_str, ResourceCategory.RESOURCES
    )

    # Validate and convert conditions
    valid_conditions = []
    invalid_attrs = []

    for cond in req.get("conditions", []):
        attr = cond.get("attribute", "")
        op_str = cond.get("operator", "")

        if attr not in VALID_ATTRIBUTE_NAMES:
            invalid_attrs.append(attr)
            continue

        if op_str not in VALID_OPERATORS:
            invalid_attrs.append(f"bad_operator:{op_str}")
            continue

        valid_conditions.append(
            Condition(
                attribute=attr,
                operator=Operator(op_str),
                expected_value=cond.get("value"),
                unit=cond.get("unit"),
            )
        )

    if not valid_conditions:
        log.warning(
            "no_valid_conditions",
            resource_type=resource_type_str,
            invalid_attrs=invalid_attrs,
        )
        return None

    # Map severity and intent with safe fallbacks
    severity_map = {
        "critical": Severity.CRITICAL,
        "high": Severity.HIGH,
        "medium": Severity.MEDIUM,
        "low": Severity.LOW,
    }
    intent_map = {
        "must_exist_before": ResourceIntent.MUST_EXIST_BEFORE,
        "will_be_created": ResourceIntent.WILL_BE_CREATED,
        "must_not_exist": ResourceIntent.MUST_NOT_EXIST,
        "optional": ResourceIntent.OPTIONAL,
    }

    severity = severity_map.get(req.get("severity", "high"), Severity.HIGH)
    intent = intent_map.get(
        req.get("intent", "must_exist_before"), ResourceIntent.MUST_EXIST_BEFORE
    )

    review_required = req.get("review_required", False)
    review_reason = req.get("review_reason")

    if invalid_attrs:
        review_required = True
        review_reason = (
            (review_reason + " " if review_reason else "")
            + f"Invalid attributes removed: {invalid_attrs}"
        )

    return Prerequisite(
        category=category,
        resource_type=resource_type,
        cloud_provider=CloudProvider.AZURE,
        intent=intent,
        conditions=valid_conditions,
        severity=severity,
        source_text=req.get("source_text", ""),
        confidence=float(req.get("confidence", 0.5)),
        review_required=review_required,
        review_reason=review_reason,
    )


async def validate_node(state: ExtractionState) -> dict:
    """
    Maps raw requirements to Prerequisite objects.
    Splits into prerequisites (valid) and invalid_requirements (failed mapping).
    """
    prerequisites = []
    invalid_requirements = []

    for req in state.get("requirements_with_flags", []):
        try:
            prereq = _map_to_prerequisite(req)
            if prereq is None:
                invalid_requirements.append({**req, "failure_reason": "mapping_failed"})
            else:
                prerequisites.append(prereq.model_dump(mode="json"))
        except Exception as e:
            log.error("validate_node_item_failed", error=str(e))
            invalid_requirements.append({**req, "failure_reason": str(e)})

    log.info(
        "validate_node_complete",
        valid=len(prerequisites),
        invalid=len(invalid_requirements),
    )

    return {
        "prerequisites": prerequisites,
        "invalid_requirements": invalid_requirements,
        "completed": True,
    }
