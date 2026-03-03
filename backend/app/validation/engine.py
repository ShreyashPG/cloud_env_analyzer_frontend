"""app/validation/engine.py — Validation Engine: prerequisites vs scan results"""
from __future__ import annotations

from typing import Any

import structlog

from app.core.types import (
    ATTRIBUTE_TO_GROUP,
    Condition,
    Finding,
    FindingStatus,
    Prerequisite,
    ResourceIntent,
    ScanResult,
    Severity,
    ValidationReport,
    CloudProvider,
)
from app.validation.evaluators import EVALUATOR_MAP

log = structlog.get_logger(__name__)


class ValidationEngine:
    """
    ENGINE 3 — Compares prerequisites against scan results.
    Input:  list[Prerequisite dicts] + list[ScanResult dicts] (plain JSON from DB)
    Output: ValidationReport (typed, with auto-computed rollup)
    """

    def run(
        self,
        prerequisites: list[dict],
        scan_results: list[dict],
        scan_job_id: str,
        region: str = "eastus",
    ) -> ValidationReport:
        # Convert dicts to typed objects
        typed_prereqs = [Prerequisite.model_validate(p) for p in prerequisites]
        typed_results = [ScanResult.model_validate(r) for r in scan_results]

        # Index by resource_type for O(1) lookup
        results_by_type: dict[str, list[ScanResult]] = {}
        for result in typed_results:
            key = result.resource_type.value
            results_by_type.setdefault(key, []).append(result)

        findings: list[Finding] = []

        for prereq in typed_prereqs:
            prereq_findings = self._evaluate_prerequisite(prereq, results_by_type)
            findings.extend(prereq_findings)

        report = ValidationReport(
            scan_job_id=scan_job_id,
            cloud_provider=CloudProvider.AZURE,
            region=region,
            findings=findings,
        )

        log.info(
            "validation_complete",
            total=report.total,
            passed=report.passed,
            failed=report.failed,
            errors=report.errors,
            skipped=report.skipped,
            deployment_ready=report.deployment_ready,
        )

        return report

    def _evaluate_prerequisite(
        self,
        prereq: Prerequisite,
        results_by_type: dict[str, list[ScanResult]],
    ) -> list[Finding]:
        findings: list[Finding] = []

        # WILL_BE_CREATED — skip, mark as SKIPPED
        if prereq.intent == ResourceIntent.WILL_BE_CREATED:
            for condition in prereq.conditions:
                findings.append(
                    Finding(
                        prerequisite_id=prereq.id,
                        condition=condition,
                        status=FindingStatus.SKIPPED,
                        severity=prereq.severity,
                        reason="intent is WILL_BE_CREATED — not scanned",
                    )
                )
            return findings

        matched = results_by_type.get(prereq.resource_type.value, [])

        # MUST_NOT_EXIST — fail if any resource exists
        if prereq.intent == ResourceIntent.MUST_NOT_EXIST:
            for condition in prereq.conditions:
                if matched:
                    findings.append(
                        Finding(
                            prerequisite_id=prereq.id,
                            condition=condition,
                            status=FindingStatus.FAIL,
                            severity=prereq.severity,
                            reason=f"Resource of type {prereq.resource_type.value} exists but must not",
                            actual_value=len(matched),
                        )
                    )
                else:
                    findings.append(
                        Finding(
                            prerequisite_id=prereq.id,
                            condition=condition,
                            status=FindingStatus.PASS,
                            severity=prereq.severity,
                            reason="No resources of this type found (correct)",
                        )
                    )
            return findings

        # MUST_EXIST_BEFORE / OPTIONAL — check if resources exist
        if not matched:
            for condition in prereq.conditions:
                status = (
                    FindingStatus.FAIL
                    if prereq.intent == ResourceIntent.MUST_EXIST_BEFORE
                    else FindingStatus.ERROR
                )
                findings.append(
                    Finding(
                        prerequisite_id=prereq.id,
                        condition=condition,
                        status=status,
                        severity=prereq.severity,
                        reason=f"No {prereq.resource_type.value} resources found in subscription",
                    )
                )
            return findings

        # Evaluate each condition against all matched resources
        for condition in prereq.conditions:
            finding = _evaluate_condition(condition, matched, prereq)
            findings.append(finding)

        return findings


def _evaluate_condition(
    condition: Condition,
    scan_results: list[ScanResult],
    prereq: Prerequisite,
) -> Finding:
    """
    Try condition against every matching ScanResult.
    PASS if any resource satisfies it.
    FAIL if no resource satisfies it.
    ERROR if the attribute could not be read from any resource.
    """
    group_name = ATTRIBUTE_TO_GROUP.get(condition.attribute)

    if not group_name:
        return Finding(
            prerequisite_id=prereq.id,
            condition=condition,
            status=FindingStatus.ERROR,
            severity=prereq.severity,
            reason=f"Attribute '{condition.attribute}' not in ATTRIBUTE_TO_GROUP",
        )

    evaluator = EVALUATOR_MAP.get(condition.operator.value)

    if not evaluator:
        return Finding(
            prerequisite_id=prereq.id,
            condition=condition,
            status=FindingStatus.ERROR,
            severity=prereq.severity,
            reason=f"No evaluator for operator '{condition.operator.value}'",
        )

    best_actual: Any = None
    best_resource_id: str | None = None
    best_resource_name: str | None = None

    for result in scan_results:
        group = getattr(result, group_name, None)
        if group is None:
            continue

        actual = getattr(group, condition.attribute, None)
        best_actual = actual
        best_resource_id = result.resource_id
        best_resource_name = result.resource_name

        if actual is None:
            continue

        try:
            passed = evaluator(actual, condition.expected_value)
            if passed:
                return Finding(
                    prerequisite_id=prereq.id,
                    resource_id=result.resource_id,
                    resource_name=result.resource_name,
                    condition=condition,
                    status=FindingStatus.PASS,
                    severity=prereq.severity,
                    actual_value=actual,
                    expected_value=condition.expected_value,
                    reason=f"Condition met on {result.resource_name}",
                )
        except Exception as e:
            log.warning(
                "evaluator_error",
                attribute=condition.attribute,
                operator=condition.operator.value,
                error=str(e),
            )

    # Nothing passed
    if best_actual is None:
        return Finding(
            prerequisite_id=prereq.id,
            resource_id=best_resource_id,
            resource_name=best_resource_name,
            condition=condition,
            status=FindingStatus.ERROR,
            severity=prereq.severity,
            reason=f"Attribute '{condition.attribute}' was None on all {len(scan_results)} resources",
        )

    return Finding(
        prerequisite_id=prereq.id,
        resource_id=best_resource_id,
        resource_name=best_resource_name,
        condition=condition,
        status=FindingStatus.FAIL,
        severity=prereq.severity,
        actual_value=best_actual,
        expected_value=condition.expected_value,
        reason=f"No resource met condition: {condition.attribute} {condition.operator.value} {condition.expected_value}",
    )
