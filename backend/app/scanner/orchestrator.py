"""app/scanner/orchestrator.py — ScanOrchestrator — runs all providers in parallel"""
from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

import structlog

from app.core.types import ResourceIntent, ScanResult

log = structlog.get_logger(__name__)


class ScanOrchestrator:
    """
    Generic scan orchestrator. Takes prerequisites, determines resource types needed,
    runs providers in a ThreadPoolExecutor (Azure SDK is sync), returns all ScanResults.

    Adding a new cloud provider: extend PROVIDER_MAP below with the new provider factory.
    """

    def __init__(
        self,
        subscription_id: str,
        tenant_id: str,
        client_id: str,
        client_secret: str,
    ):
        from azure.identity import ClientSecretCredential

        from app.scanner.providers.compute import AzureComputeProvider
        from app.scanner.providers.database import AzureDatabaseProvider
        from app.scanner.providers.iam import AzureIAMProvider
        from app.scanner.providers.kubernetes import AzureKubernetesProvider
        from app.scanner.providers.network import AzureNetworkProvider
        from app.scanner.providers.quotas import AzureQuotasProvider
        from app.scanner.providers.security import AzureSecurityProvider
        from app.scanner.providers.services import AzureServicesProvider
        from app.scanner.providers.storage import AzureStorageProvider

        self._credential = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )
        self._subscription_id = subscription_id

        self._compute = AzureComputeProvider(self._credential, subscription_id)
        self._kubernetes = AzureKubernetesProvider(self._credential, subscription_id)
        self._storage = AzureStorageProvider(self._credential, subscription_id)
        self._database = AzureDatabaseProvider(self._credential, subscription_id)
        self._network = AzureNetworkProvider(self._credential, subscription_id)
        self._iam = AzureIAMProvider(self._credential, subscription_id)
        self._services = AzureServicesProvider(self._credential, subscription_id)
        self._security = AzureSecurityProvider(self._credential, subscription_id)
        self._quotas = AzureQuotasProvider(self._credential, subscription_id)

    def run(
        self,
        prerequisites: list[dict],
        resource_group: str | None = None,
        region: str = "eastus",
    ) -> list[ScanResult]:
        """
        Main entry point.
        1. Determines which resource types to scan (skips WILL_BE_CREATED).
        2. Maps resource types to provider callables.
        3. Runs each provider in a ThreadPoolExecutor (max 8 workers).
        4. Collects and returns all results.
        Never raises — returns partial results on provider failure.
        """
        types_to_scan: set[str] = set()
        for prereq in prerequisites:
            if prereq.get("intent") != ResourceIntent.WILL_BE_CREATED.value:
                rt = prereq.get("resource_type")
                if rt:
                    types_to_scan.add(rt)

        # Map resource types to provider lambdas
        provider_map: dict[str, object] = {
            "virtual_machine": lambda: self._compute.get_all(resource_group),
            "kubernetes_cluster": lambda: self._kubernetes.get_all(resource_group),
            "object_storage": lambda: self._storage.get_all(resource_group),
            "block_storage": lambda: self._storage.get_all(resource_group),
            "relational_database": lambda: self._database.get_all(resource_group),
            "virtual_network": lambda: self._network.get_all_vnets(resource_group),
            "subnet": lambda: self._network.get_all_subnets(resource_group),
            "network_security_group": lambda: self._network.get_all_nsgs(resource_group),
            "rbac_role_assignment": lambda: self._iam.get_all(),
            "service_principal": lambda: self._iam.get_all(),
            "enabled_service": lambda: self._services.get_all(),
            "key_vault": lambda: self._security.get_all(),
            "certificate": lambda: self._security.get_all(),
            "compute_quota": lambda: self._quotas.get_compute_quotas(region),
        }

        handlers_to_run = {
            rt: provider_map[rt]
            for rt in types_to_scan
            if rt in provider_map
        }

        log.info(
            "scan_starting",
            resource_types=list(handlers_to_run.keys()),
            resource_group=resource_group,
            region=region,
        )

        all_results: list[ScanResult] = []

        with ThreadPoolExecutor(max_workers=8) as executor:
            future_to_type = {
                executor.submit(handler): rt
                for rt, handler in handlers_to_run.items()
            }

            for future in as_completed(future_to_type):
                rt = future_to_type[future]
                try:
                    results = future.result()
                    all_results.extend(results)
                    log.info(
                        "provider_complete",
                        resource_type=rt,
                        count=len(results),
                    )
                except Exception as e:
                    log.error("provider_failed", resource_type=rt, error=str(e))

        log.info("scan_complete", total_resources=len(all_results))
        return all_results
