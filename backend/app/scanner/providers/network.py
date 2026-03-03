"""app/scanner/providers/network.py — Azure VNet, Subnet, and NSG scanner"""
from __future__ import annotations

import ipaddress

import structlog

from app.core.types import (
    CloudProvider,
    NSGAttributes,
    ResourceType,
    ScanResult,
    SubnetAttributes,
    VirtualNetworkAttributes,
)
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureNetworkProvider(BaseProvider):
    """Scans Azure Virtual Networks, Subnets, and Network Security Groups."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.network import NetworkManagementClient

        self._client = NetworkManagementClient(credential, subscription_id)

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        """Routes to get_all_vnets for orchestrator compatibility."""
        return self.get_all_vnets(resource_group, name_filter)

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            vnet = self._client.virtual_networks.get(rg, name)
            return self._adapt_vnet(vnet)
        except Exception as e:
            log.error("network_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    # ---- VNets ----

    def get_all_vnets(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.virtual_networks.list(resource_group)
            else:
                iterator = self._client.virtual_networks.list_all()

            results = []
            for vnet in iterator:
                if name_filter and name_filter.lower() not in (vnet.name or "").lower():
                    continue
                try:
                    results.append(self._adapt_vnet(vnet))
                except Exception as e:
                    log.warning("vnet_adapt_failed", vnet=vnet.name, error=str(e))

            log.info("vnets_scanned", count=len(results))
            return results
        except Exception as e:
            log.error("vnet_get_all_failed", error=str(e))
            return []

    # ---- Subnets ----

    def get_all_subnets(
        self, resource_group: str | None = None
    ) -> list[ScanResult]:
        results = []
        try:
            if resource_group:
                vnets = list(self._client.virtual_networks.list(resource_group))
            else:
                vnets = list(self._client.virtual_networks.list_all())

            for vnet in vnets:
                vnet_rg, _ = self._parse_arm_id(vnet.id or "")
                location = vnet.location or ""
                try:
                    for subnet in self._client.subnets.list(vnet_rg, vnet.name):
                        try:
                            results.append(self._adapt_subnet(subnet, location))
                        except Exception as e:
                            log.warning("subnet_adapt_failed", subnet=subnet.name, error=str(e))
                except Exception as e:
                    log.warning("subnet_list_failed", vnet=vnet.name, error=str(e))

            log.info("subnets_scanned", count=len(results))
        except Exception as e:
            log.error("subnet_get_all_failed", error=str(e))
        return results

    # ---- NSGs ----

    def get_all_nsgs(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        try:
            if resource_group:
                iterator = self._client.network_security_groups.list(resource_group)
            else:
                iterator = self._client.network_security_groups.list_all()

            results = []
            for nsg in iterator:
                if name_filter and name_filter.lower() not in (nsg.name or "").lower():
                    continue
                try:
                    results.append(self._adapt_nsg(nsg))
                except Exception as e:
                    log.warning("nsg_adapt_failed", nsg=nsg.name, error=str(e))

            log.info("nsgs_scanned", count=len(results))
            return results
        except Exception as e:
            log.error("nsg_get_all_failed", error=str(e))
            return []

    # ---- Adapters ----

    def _adapt_vnet(self, raw_vnet) -> ScanResult:
        cidr: str | None = None
        if (
            raw_vnet.address_space
            and raw_vnet.address_space.address_prefixes
        ):
            cidr = raw_vnet.address_space.address_prefixes[0]

        dns_servers: list[str] = []
        if raw_vnet.dhcp_options and raw_vnet.dhcp_options.dns_servers:
            dns_servers = list(raw_vnet.dhcp_options.dns_servers)

        peering_enabled = bool(
            raw_vnet.virtual_network_peerings
        )

        return ScanResult(
            resource_id=raw_vnet.id or "",
            resource_name=raw_vnet.name or "",
            resource_type=ResourceType.VIRTUAL_NETWORK,
            cloud_provider=CloudProvider.AZURE,
            region=raw_vnet.location or "",
            tags=dict(raw_vnet.tags or {}),
            virtual_network=VirtualNetworkAttributes(
                vnet_cidr=cidr,
                vnet_exists=True,
                region=raw_vnet.location or "",
                peering_enabled=peering_enabled,
                dns_servers=dns_servers,
            ),
            raw_response=raw_vnet.as_dict() if hasattr(raw_vnet, "as_dict") else {},
        )

    def _adapt_subnet(self, raw_subnet, location: str) -> ScanResult:
        cidr = raw_subnet.address_prefix
        min_size: int | None = None
        if cidr:
            try:
                net = ipaddress.ip_network(cidr, strict=False)
                min_size = net.num_addresses - 5  # Azure reserves 5
            except ValueError:
                pass

        nsg_attached = raw_subnet.network_security_group is not None

        return ScanResult(
            resource_id=raw_subnet.id or "",
            resource_name=raw_subnet.name or "",
            resource_type=ResourceType.SUBNET,
            cloud_provider=CloudProvider.AZURE,
            region=location,
            tags={},
            subnet=SubnetAttributes(
                subnet_cidr=cidr,
                min_subnet_size=min_size,
                subnet_exists=True,
                nsg_attached=nsg_attached,
            ),
            raw_response=raw_subnet.as_dict() if hasattr(raw_subnet, "as_dict") else {},
        )

    def _adapt_nsg(self, raw_nsg) -> ScanResult:
        open_ports: list[int] = []
        allows_internet_inbound = False
        ssh_rdp_exposed = False

        all_rules = list(raw_nsg.security_rules or []) + list(
            raw_nsg.default_security_rules or []
        )

        for rule in all_rules:
            direction = getattr(rule, "direction", "") or ""
            access = getattr(rule, "access", "") or ""
            src = getattr(rule, "source_address_prefix", "") or ""
            dst_port_range = getattr(rule, "destination_port_range", "") or ""

            if direction.lower() == "inbound" and access.lower() == "allow":
                # Check for internet-wide inbound
                if dst_port_range == "*":
                    allows_internet_inbound = True

                # Collect single-port numbers
                if dst_port_range.isdigit():
                    port_num = int(dst_port_range)
                    if port_num not in open_ports:
                        open_ports.append(port_num)
                    # Check SSH/RDP exposure
                    if port_num in (22, 3389) and src in ("*", "Internet"):
                        ssh_rdp_exposed = True

        return ScanResult(
            resource_id=raw_nsg.id or "",
            resource_name=raw_nsg.name or "",
            resource_type=ResourceType.NETWORK_SECURITY_GROUP,
            cloud_provider=CloudProvider.AZURE,
            region=raw_nsg.location or "",
            tags=dict(raw_nsg.tags or {}),
            nsg=NSGAttributes(
                open_ports=open_ports,
                allows_internet_inbound=allows_internet_inbound,
                ssh_rdp_exposed=ssh_rdp_exposed,
            ),
            raw_response=raw_nsg.as_dict() if hasattr(raw_nsg, "as_dict") else {},
        )
