"""app/scanner/providers/storage.py — Azure Storage Account scanner"""
from __future__ import annotations

import structlog

from app.core.types import CloudProvider, ResourceType, ScanResult, StorageAttributes
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureStorageProvider(BaseProvider):
    """Scans Azure Storage Accounts."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.storage import StorageManagementClient

        self._client = StorageManagementClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.storage_accounts.list_by_resource_group(
                    resource_group
                )
            else:
                iterator = self._client.storage_accounts.list()

            results = []
            for account in iterator:
                if name_filter and name_filter.lower() not in (account.name or "").lower():
                    continue
                try:
                    results.append(self._adapt(account))
                except Exception as e:
                    log.warning("storage_adapt_failed", account=account.name, error=str(e))

            log.info("storage_get_all_complete", count=len(results))
            return results
        except Exception as e:
            log.error("storage_get_all_failed", error=str(e))
            return []

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            account = self._client.storage_accounts.get_properties(rg, name)
            return self._adapt(account)
        except Exception as e:
            log.error("storage_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def _adapt(self, raw_account) -> ScanResult:
        tier = getattr(raw_account, "access_tier", None)
        if tier is not None:
            tier = str(tier)

        redundancy: str | None = None
        if raw_account.sku and raw_account.sku.name:
            parts = str(raw_account.sku.name).split("_")
            redundancy = parts[1] if len(parts) == 2 else None

        public_access = "disabled"
        if getattr(raw_account, "allow_blob_public_access", False):
            public_access = "enabled"

        return ScanResult(
            resource_id=raw_account.id or "",
            resource_name=raw_account.name or "",
            resource_type=ResourceType.OBJECT_STORAGE,
            cloud_provider=CloudProvider.AZURE,
            region=raw_account.location or "",
            tags=dict(raw_account.tags or {}),
            storage=StorageAttributes(
                storage_tier=tier,
                redundancy=redundancy,
                encryption_enabled=True,  # Azure storage always encrypted at rest
                public_access=public_access,
            ),
            raw_response=raw_account.as_dict() if hasattr(raw_account, "as_dict") else {},
        )
