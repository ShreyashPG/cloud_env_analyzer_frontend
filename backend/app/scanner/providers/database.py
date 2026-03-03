"""app/scanner/providers/database.py — Azure PostgreSQL Flexible Server scanner"""
from __future__ import annotations

import structlog

from app.core.types import CloudProvider, DatabaseAttributes, ResourceType, ScanResult
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureDatabaseProvider(BaseProvider):
    """Scans Azure PostgreSQL Flexible Servers."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.rdbms.postgresql_flexibleservers import (
            PostgreSQLManagementClient,
        )

        self._client = PostgreSQLManagementClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.servers.list_by_resource_group(resource_group)
            else:
                iterator = self._client.servers.list()

            results = []
            for server in iterator:
                if name_filter and name_filter.lower() not in (server.name or "").lower():
                    continue
                try:
                    results.append(self._adapt(server))
                except Exception as e:
                    log.warning("db_adapt_failed", server=server.name, error=str(e))

            log.info("database_get_all_complete", count=len(results))
            return results
        except Exception as e:
            log.error("database_get_all_failed", error=str(e))
            return []

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            server = self._client.servers.get(rg, name)
            return self._adapt(server)
        except Exception as e:
            log.error("database_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def _adapt(self, raw_server) -> ScanResult:
        ha_enabled = False
        if raw_server.high_availability:
            ha_enabled = raw_server.high_availability.mode not in (None, "Disabled")

        backup_days: int | None = None
        if raw_server.backup:
            backup_days = raw_server.backup.backup_retention_days

        public_access = "disabled"
        if raw_server.network and getattr(
            raw_server.network, "public_network_access", None
        ) == "Enabled":
            public_access = "enabled"

        db_tier: str | None = None
        min_vcores: int | None = None
        if raw_server.sku:
            db_tier = raw_server.sku.tier
            if hasattr(raw_server.sku, "capacity") and raw_server.sku.capacity:
                try:
                    min_vcores = int(raw_server.sku.capacity)
                except (ValueError, TypeError):
                    pass

        min_storage: int | None = None
        if raw_server.storage:
            min_storage = raw_server.storage.storage_size_gb

        return ScanResult(
            resource_id=raw_server.id or "",
            resource_name=raw_server.name or "",
            resource_type=ResourceType.RELATIONAL_DATABASE,
            cloud_provider=CloudProvider.AZURE,
            region=raw_server.location or "",
            tags=dict(raw_server.tags or {}),
            database=DatabaseAttributes(
                db_engine="postgresql",
                db_version=raw_server.version,
                db_tier=db_tier,
                min_vcores=min_vcores,
                min_storage_gb=min_storage,
                ha_enabled=ha_enabled,
                backup_retention_days=backup_days,
                public_access=public_access,
                ssl_required=True,
            ),
            raw_response=raw_server.as_dict() if hasattr(raw_server, "as_dict") else {},
        )
