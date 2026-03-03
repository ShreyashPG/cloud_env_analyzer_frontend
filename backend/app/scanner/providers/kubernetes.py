"""app/scanner/providers/kubernetes.py — Azure AKS cluster scanner"""
from __future__ import annotations

import structlog

from app.core.types import (
    CloudProvider,
    KubernetesAttributes,
    ResourceType,
    ScanResult,
)
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureKubernetesProvider(BaseProvider):
    """Scans Azure Kubernetes Service (AKS) clusters."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.containerservice import ContainerServiceClient

        self._client = ContainerServiceClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.managed_clusters.list_by_resource_group(
                    resource_group
                )
            else:
                iterator = self._client.managed_clusters.list()

            results = []
            for cluster in iterator:
                if name_filter and name_filter.lower() not in (cluster.name or "").lower():
                    continue
                try:
                    results.append(self._adapt(cluster))
                except Exception as e:
                    log.warning("aks_adapt_failed", cluster=cluster.name, error=str(e))

            log.info("kubernetes_get_all_complete", count=len(results))
            return results
        except Exception as e:
            log.error("kubernetes_get_all_failed", error=str(e))
            return []

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            cluster = self._client.managed_clusters.get(rg, name)
            return self._adapt(cluster)
        except Exception as e:
            log.error("kubernetes_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def _adapt(self, raw_cluster) -> ScanResult:
        k8s_version = raw_cluster.kubernetes_version

        min_node: int | None = None
        max_node: int | None = None
        node_vm_size: str | None = None

        if raw_cluster.agent_pool_profiles:
            for pool in raw_cluster.agent_pool_profiles:
                if pool.min_count is not None:
                    min_node = min(min_node, pool.min_count) if min_node is not None else pool.min_count
                if pool.max_count is not None:
                    max_node = max(max_node, pool.max_count) if max_node is not None else pool.max_count
                if getattr(pool, "mode", None) == "System" and pool.vm_size:
                    node_vm_size = pool.vm_size

        network_plugin: str | None = None
        if raw_cluster.network_profile:
            network_plugin = raw_cluster.network_profile.network_plugin

        private_cluster = False
        if raw_cluster.api_server_access_profile:
            private_cluster = bool(
                raw_cluster.api_server_access_profile.enable_private_cluster
            )

        addons: list[str] = []
        if raw_cluster.addon_profiles:
            for name, profile in raw_cluster.addon_profiles.items():
                if getattr(profile, "enabled", False):
                    addons.append(name)

        return ScanResult(
            resource_id=raw_cluster.id or "",
            resource_name=raw_cluster.name or "",
            resource_type=ResourceType.KUBERNETES_CLUSTER,
            cloud_provider=CloudProvider.AZURE,
            region=raw_cluster.location or "",
            tags=dict(raw_cluster.tags or {}),
            kubernetes=KubernetesAttributes(
                k8s_version=k8s_version,
                min_node_count=min_node,
                max_node_count=max_node,
                node_vm_size=node_vm_size,
                network_plugin=network_plugin,
                rbac_enabled=raw_cluster.enable_rbac,
                private_cluster=private_cluster,
                required_addons=addons,
            ),
            raw_response=raw_cluster.as_dict() if hasattr(raw_cluster, "as_dict") else {},
        )
