"""app/api/reports.py — Validation report retrieval endpoint"""
from __future__ import annotations

import structlog
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_session
from app.models.report import Finding, ValidationReport

log = structlog.get_logger(__name__)

router = APIRouter()

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}
STATUS_ORDER = {"fail": 0, "error": 1, "pass": 2, "skipped": 3}


@router.get("/reports/{report_id}")
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_session),
):
    """
    Get full validation report with all findings.
    Findings are sorted by severity (critical first), then status (fail first).
    """
    result = await db.execute(
        select(ValidationReport)
        .where(ValidationReport.id == report_id)
        .options(selectinload(ValidationReport.findings))
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")

    # Sort findings
    sorted_findings = sorted(
        report.findings,
        key=lambda f: (
            SEVERITY_ORDER.get(f.severity, 99),
            STATUS_ORDER.get(f.status, 99),
        ),
    )

    # Group by status
    by_status: dict[str, list] = {
        "pass": [],
        "fail": [],
        "error": [],
        "skipped": [],
    }
    for f in sorted_findings:
        by_status.setdefault(f.status, []).append(_finding_to_dict(f))

    return {
        "report_id": report.id,
        "scan_job_id": str(report.scan_job_id),
        "cloud_provider": report.cloud_provider,
        "region": report.region,
        "generated_at": str(report.generated_at),
        "summary": {
            "deployment_ready": report.deployment_ready,
            "total": report.total,
            "passed": report.passed,
            "failed": report.failed,
            "errors": report.errors,
            "skipped": report.skipped,
            "critical_failures": report.critical_failures,
            "high_failures": report.high_failures,
        },
        "findings": [_finding_to_dict(f) for f in sorted_findings],
        "findings_by_status": by_status,
    }


def _finding_to_dict(f: Finding) -> dict:
    return {
        "id": str(f.id),
        "prerequisite_id": f.prerequisite_id,
        "resource_id": f.resource_id,
        "resource_name": f.resource_name,
        "condition": f.condition,
        "status": f.status,
        "severity": f.severity,
        "actual_value": f.actual_value,
        "expected_value": f.expected_value,
        "reason": f.reason,
    }
