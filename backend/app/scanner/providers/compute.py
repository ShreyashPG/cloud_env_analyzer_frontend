"""app/scanner/providers/compute.py — Azure VM scanner"""
from __future__ import annotations

import structlog

from app.core.types import CloudProvider, ComputeAttributes, ResourceType, ScanResult
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureComputeProvider(BaseProvider):
    """Scans Azure Virtual Machines using azure-mgmt-compute."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.compute import ComputeManagementClient

        self._client = ComputeManagementClient(credential, subscription_id)
        self._subscription_id = subscription_id
        self._sku_cache: dict[str, dict[str, dict]] = {}

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.virtual_machines.list(resource_group)
            else:
                iterator = self._client.virtual_machines.list_all()

            results = []
            for vm in iterator:
                if name_filter and name_filter.lower() not in (vm.name or "").lower():
                    continue
                try:
                    adapted = self._adapt(vm)
                    results.append(adapted)
                except Exception as e:
                    log.warning("vm_adapt_failed", vm=vm.name, error=str(e))

            log.info("compute_get_all_complete", count=len(results))
            return results
        except Exception as e:
            log.error("compute_get_all_failed", error=str(e))
            return []

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            vm = self._client.virtual_machines.get(rg, name)
            return self._adapt(vm)
        except Exception as e:
            log.error("compute_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def _warm_sku_cache(self, location: str) -> None:
        if location in self._sku_cache:
            return
        self._sku_cache[location] = {}
        try:
            for sku in self._client.resource_skus.list(
                filter=f"location eq '{location}'"
            ):
                if sku.name and sku.capabilities:
                    self._sku_cache[location][sku.name] = {
                        c.name: c.value for c in sku.capabilities
                    }
        except Exception as e:
            log.warning("sku_cache_warm_failed", location=location, error=str(e))

    def _adapt(self, raw_vm) -> ScanResult:
        location = raw_vm.location or ""
        vm_size = (
            raw_vm.hardware_profile.vm_size if raw_vm.hardware_profile else None
        )

        min_vcpu: int | None = None
        min_memory_gb: float | None = None
        if vm_size and location:
            self._warm_sku_cache(location)
            caps = self._sku_cache.get(location, {}).get(vm_size, {})
            if "vCPUs" in caps:
                try:
                    min_vcpu = int(caps["vCPUs"])
                except (ValueError, TypeError):
                    pass
            if "MemoryGB" in caps:
                try:
                    min_memory_gb = float(caps["MemoryGB"])
                except (ValueError, TypeError):
                    pass

        os_type: str | None = None
        os_version: str | None = None
        if raw_vm.storage_profile:
            if raw_vm.storage_profile.os_disk:
                os_type = (
                    str(raw_vm.storage_profile.os_disk.os_type)
                    if raw_vm.storage_profile.os_disk.os_type
                    else None
                )
            if raw_vm.storage_profile.image_reference:
                ref = raw_vm.storage_profile.image_reference
                os_version = (
                    " ".join(p for p in [ref.offer, ref.sku] if p) or None
                )

        az = raw_vm.zones[0] if raw_vm.zones else None

        return ScanResult(
            resource_id=raw_vm.id or "",
            resource_name=raw_vm.name or "",
            resource_type=ResourceType.VIRTUAL_MACHINE,
            cloud_provider=CloudProvider.AZURE,
            region=location,
            tags=dict(raw_vm.tags or {}),
            compute=ComputeAttributes(
                vm_size=vm_size,
                min_vcpu=min_vcpu,
                min_memory_gb=min_memory_gb,
                os_type=os_type,
                os_version=os_version,
                availability_zone=az,
            ),
            raw_response=raw_vm.as_dict() if hasattr(raw_vm, "as_dict") else {},
        )
