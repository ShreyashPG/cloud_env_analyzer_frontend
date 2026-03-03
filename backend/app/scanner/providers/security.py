"""app/scanner/providers/security.py — Azure Key Vault and Certificate scanner"""
from __future__ import annotations

from datetime import datetime, timezone

import structlog

from app.core.types import (
    CertificateAttributes,
    CloudProvider,
    EncryptionAttributes,
    ResourceType,
    ScanResult,
)
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)


class AzureSecurityProvider(BaseProvider):
    """Scans Azure Key Vaults and Certificates."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.keyvault import KeyVaultManagementClient

        self._kv_client = KeyVaultManagementClient(credential, subscription_id)
        self._credential = credential

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        return self.get_all_key_vaults(resource_group, name_filter)

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            rg, name = self._parse_arm_id(resource_id)
            vault = self._kv_client.vaults.get(rg, name)
            return self._adapt_key_vault(vault)
        except Exception as e:
            log.error("security_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def get_all_key_vaults(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        results = []
        try:
            if resource_group:
                iterator = self._kv_client.vaults.list_by_resource_group(resource_group)
            else:
                iterator = self._kv_client.vaults.list_by_subscription()

            for vault in iterator:
                if name_filter and name_filter.lower() not in (vault.name or "").lower():
                    continue
                try:
                    results.append(self._adapt_key_vault(vault))
                except Exception as e:
                    log.warning("kv_adapt_failed", vault=vault.name, error=str(e))

        except Exception as e:
            log.error("security_get_all_failed", error=str(e))

        log.info("key_vaults_scanned", count=len(results))
        return results

    def get_certificates_in_vault(
        self, vault_name: str, vault_url: str
    ) -> list[ScanResult]:
        results = []
        try:
            from azure.keyvault.certificates import CertificateClient

            cert_client = CertificateClient(
                vault_url=vault_url, credential=self._credential
            )
            now = datetime.now(timezone.utc)

            for cert in cert_client.list_properties_of_certificates():
                try:
                    expires = cert.expires_on
                    days: int | None = None
                    if expires:
                        # Ensure expires is timezone-aware
                        if expires.tzinfo is None:
                            expires = expires.replace(tzinfo=timezone.utc)
                        days = (expires - now).days
                    valid = days is not None and days > 0

                    results.append(
                        ScanResult(
                            resource_id=f"{vault_url}/certificates/{cert.name}",
                            resource_name=cert.name or "",
                            resource_type=ResourceType.CERTIFICATE,
                            cloud_provider=CloudProvider.AZURE,
                            region="global",
                            tags={},
                            certificate=CertificateAttributes(
                                cert_exists=True,
                                cert_valid=valid,
                                days_until_expiry=days,
                                ssl_enabled=True,
                            ),
                            raw_response={
                                "name": cert.name,
                                "vault": vault_url,
                            },
                        )
                    )
                except Exception as e:
                    log.warning("cert_adapt_failed", cert=cert.name, error=str(e))

        except Exception as e:
            log.error(
                "get_certs_failed", vault=vault_name, vault_url=vault_url, error=str(e)
            )

        return results

    def _adapt_key_vault(self, raw_vault) -> ScanResult:
        vault_url = ""
        if raw_vault.properties:
            vault_url = raw_vault.properties.vault_uri or ""

        return ScanResult(
            resource_id=raw_vault.id or "",
            resource_name=raw_vault.name or "",
            resource_type=ResourceType.KEY_VAULT,
            cloud_provider=CloudProvider.AZURE,
            region=raw_vault.location or "",
            tags=dict(raw_vault.tags or {}),
            encryption=EncryptionAttributes(
                key_vault_exists=True,
                encryption_at_rest=True,
                encryption_in_transit=True,
                tls_version="1.2",
            ),
            raw_response=raw_vault.as_dict() if hasattr(raw_vault, "as_dict") else {},
        )
