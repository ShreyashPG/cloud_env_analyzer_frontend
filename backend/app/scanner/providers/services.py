"""app/scanner/providers/services.py — Azure resource provider registration scanner"""
from __future__ import annotations

import structlog

from app.core.types import (
    CloudProvider,
    EnabledServiceAttributes,
    ResourceType,
    ScanResult,
)
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureServicesProvider(BaseProvider):
    """Scans Azure resource provider registrations (enabled services)."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.resource import ResourceManagementClient

        self._resource_client = ResourceManagementClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        return self.get_all_enabled_services(name_filter=name_filter)

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            provider = self._resource_client.providers.get(resource_id)
            return self._adapt_provider(provider)
        except Exception as e:
            log.error("services_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def get_all_enabled_services(
        self, name_filter: str | None = None
    ) -> list[ScanResult]:
        results = []
        try:
            for provider in self._resource_client.providers.list():
                if name_filter and name_filter.lower() not in (
                    provider.namespace or ""
                ).lower():
                    continue
                try:
                    results.append(self._adapt_provider(provider))
                except Exception as e:
                    log.warning(
                        "service_adapt_failed",
                        namespace=provider.namespace,
                        error=str(e),
                    )
        except Exception as e:
            log.error("services_get_all_failed", error=str(e))

        log.info("services_get_all_complete", count=len(results))
        return results

    def is_service_enabled(self, service_name: str) -> bool:
        try:
            provider = self._resource_client.providers.get(service_name)
            return provider.registration_state == "Registered"
        except Exception as e:
            log.warning("is_service_enabled_failed", service=service_name, error=str(e))
            return False

    def _adapt_provider(self, provider) -> ScanResult:
        is_enabled = provider.registration_state == "Registered"
        namespace = provider.namespace or ""

        return ScanResult(
            resource_id=namespace,
            resource_name=namespace,
            resource_type=ResourceType.ENABLED_SERVICE,
            cloud_provider=CloudProvider.AZURE,
            region="global",
            tags={},
            enabled_service=EnabledServiceAttributes(
                service_name=namespace,
                service_enabled=is_enabled,
            ),
            raw_response={
                "namespace": namespace,
                "registrationState": provider.registration_state,
            },
        )
