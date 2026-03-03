"""app/scanner/providers/quotas.py — Azure Compute quota scanner"""
from __future__ import annotations

import structlog

from app.core.types import (
    CloudProvider,
    ComputeQuotaAttributes,
    ResourceType,
    ScanResult,
)
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)

DEFAULT_REGION = "eastus"


class AzureQuotasProvider(BaseProvider):
    """Scans Azure Compute quota usage by region."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.compute import ComputeManagementClient

        self._compute_client = ComputeManagementClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        return self.get_compute_quotas(DEFAULT_REGION, name_filter=name_filter)

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        # quota IDs are not resolvable individually
        return None

    def get_compute_quotas(
        self, region: str, name_filter: str | None = None
    ) -> list[ScanResult]:
        results = []
        try:
            for usage in self._compute_client.usage.list(location=region):
                quota_name = (
                    usage.name.value if usage.name else None
                )
                if name_filter and quota_name and name_filter.lower() not in quota_name.lower():
                    continue

                total = usage.limit
                used = usage.current_value
                available: int | None = None
                if total is not None and used is not None:
                    available = total - used

                localized = (
                    usage.name.localized_value if usage.name else None
                )

                try:
                    results.append(
                        ScanResult(
                            resource_id=f"quota/compute/{region}/{quota_name}",
                            resource_name=localized or quota_name or "",
                            resource_type=ResourceType.COMPUTE_QUOTA,
                            cloud_provider=CloudProvider.AZURE,
                            region=region,
                            tags={},
                            compute_quota=ComputeQuotaAttributes(
                                quota_name=quota_name,
                                vcpu_quota_total=total,
                                vcpu_quota_used=used,
                                vcpu_quota_available=available,
                            ),
                            raw_response={
                                "name": quota_name,
                                "limit": usage.limit,
                                "currentValue": usage.current_value,
                            },
                        )
                    )
                except Exception as e:
                    log.warning("quota_adapt_failed", quota_name=quota_name, error=str(e))

        except Exception as e:
            log.error("quotas_get_failed", region=region, error=str(e))

        log.info("quotas_scanned", region=region, count=len(results))
        return results
