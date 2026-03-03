"""app/background/scan_task.py — Background task for scan + validation pipeline"""
from __future__ import annotations

import asyncio

import structlog
from sqlalchemy import select

log = structlog.get_logger(__name__)


async def run_scan(
    scan_job_id: str,
    document_id: str,
    resource_group: str | None,
    region: str,
) -> None:
    """
    Background task: scan Azure resources and validate against prerequisites.
    1. Load approved prerequisites from DB.
    2. Run ScanOrchestrator (in thread executor).
    3. Save ScanResults.
    4. Run ValidationEngine.
    5. Save ValidationReport + Findings.
    """
    from app.background.runner import update_job
    from app.config import get_settings
    from app.database import AsyncSessionLocal
    from app.models.prerequisite import Prerequisite as PModel
    from app.models.report import Finding as FModel
    from app.models.report import ValidationReport as VRModel
    from app.models.scan_result import ScanResult as SRModel
    from app.scanner.orchestrator import ScanOrchestrator
    from app.validation.engine import ValidationEngine

    settings = get_settings()

    async with AsyncSessionLocal() as db:
        try:
            await update_job(db, scan_job_id, "running", 10, "loading_prerequisites")

            # Load approved prerequisites for this document
            result = await db.execute(
                select(PModel).where(
                    PModel.document_id == document_id,
                    PModel.review_required == False,  # noqa: E712
                )
            )
            prereq_rows = result.scalars().all()

            if not prereq_rows:
                await update_job(
                    db,
                    scan_job_id,
                    "failed",
                    0,
                    "",
                    error="No approved prerequisites found for this document",
                )
                return

            prereq_dicts = [
                {
                    "id": r.id,
                    "category": r.category,
                    "resource_type": r.resource_type,
                    "cloud_provider": r.cloud_provider,
                    "intent": r.intent,
                    "severity": r.severity,
                    "conditions": r.conditions,
                    "source_text": r.source_text,
                    "confidence": r.confidence,
                    "review_required": r.review_required,
                    "review_reason": r.review_reason,
                }
                for r in prereq_rows
            ]

            await update_job(db, scan_job_id, "running", 20, "scanning_azure")

            orchestrator = ScanOrchestrator(
                subscription_id=settings.azure_subscription_id,
                tenant_id=settings.azure_tenant_id,
                client_id=settings.azure_client_id,
                client_secret=settings.azure_client_secret,
            )

            loop = asyncio.get_event_loop()
            scan_results = await loop.run_in_executor(
                None,
                lambda: orchestrator.run(
                    prereq_dicts,
                    resource_group=resource_group,
                    region=region,
                ),
            )

            await update_job(db, scan_job_id, "running", 70, "saving_scan_results")

            # Determine attribute group and save each scan result
            attribute_groups = [
                "compute", "kubernetes", "storage", "database", "virtual_network",
                "subnet", "nsg", "rbac", "service_principal", "enabled_service",
                "encryption", "certificate", "firewall_rule", "compute_quota",
            ]

            scan_result_dicts = []
            for sr in scan_results:
                sr_dict = sr.model_dump(mode="json")

                group_name = "unknown"
                attrs_dict: dict = {}
                for group in attribute_groups:
                    val = sr_dict.get(group)
                    if val is not None:
                        group_name = group
                        attrs_dict = val
                        break

                row = SRModel(
                    scan_job_id=scan_job_id,
                    resource_id=sr.resource_id,
                    resource_name=sr.resource_name,
                    resource_type=sr.resource_type.value,
                    cloud_provider=sr.cloud_provider.value,
                    region=sr.region,
                    tags=sr.tags,
                    attributes=attrs_dict,
                    attribute_group=group_name,
                    raw_response=sr_dict.get("raw_response", {}),
                )
                db.add(row)
                scan_result_dicts.append(sr_dict)

            await db.commit()
            await update_job(db, scan_job_id, "running", 85, "validating")

            # Run validation engine
            engine = ValidationEngine()
            report = engine.run(
                prerequisites=prereq_dicts,
                scan_results=scan_result_dicts,
                scan_job_id=str(scan_job_id),
                region=region,
            )

            # Save ValidationReport
            vr_row = VRModel(
                id=report.report_id,
                scan_job_id=scan_job_id,
                cloud_provider=report.cloud_provider.value,
                region=report.region,
                total=report.total,
                passed=report.passed,
                failed=report.failed,
                errors=report.errors,
                skipped=report.skipped,
                critical_failures=report.critical_failures,
                high_failures=report.high_failures,
                deployment_ready=report.deployment_ready,
            )
            db.add(vr_row)

            # Save individual Findings
            for finding in report.findings:
                f_row = FModel(
                    report_id=report.report_id,
                    prerequisite_id=finding.prerequisite_id,
                    resource_id=finding.resource_id,
                    resource_name=finding.resource_name,
                    condition=finding.condition.model_dump(mode="json"),
                    status=finding.status.value,
                    severity=finding.severity.value,
                    actual_value=finding.actual_value,
                    expected_value=finding.expected_value,
                    reason=finding.reason,
                )
                db.add(f_row)

            await db.commit()

            await update_job(
                db,
                scan_job_id,
                "completed",
                100,
                "done",
                result_id=report.report_id,
            )

            log.info(
                "scan_complete",
                report_id=report.report_id,
                deployment_ready=report.deployment_ready,
                passed=report.passed,
                failed=report.failed,
                critical_failures=report.critical_failures,
            )

        except Exception as e:
            log.error("scan_task_failed", scan_job_id=scan_job_id, error=str(e))
            await update_job(db, scan_job_id, "failed", 0, "", error=str(e))
