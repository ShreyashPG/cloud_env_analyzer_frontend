"""app/scanner/providers/iam.py — Azure RBAC role assignment scanner"""
from __future__ import annotations

import structlog

from app.core.types import CloudProvider, RBACAttributes, ResourceType, ScanResult
from app.scanner.base import BaseProvider

log = structlog.get_logger(__name__)

PRINCIPAL_TYPE_MAP = {
    "User": "user",
    "ServicePrincipal": "service_principal",
    "Group": "group",
}


class AzureIAMProvider(BaseProvider):
    """Scans Azure RBAC role assignments."""

    def __init__(self, credential, subscription_id: str):
        from azure.mgmt.authorization import AuthorizationManagementClient

        self._auth_client = AuthorizationManagementClient(credential, subscription_id)
        self._subscription_id = subscription_id
        self._role_name_cache: dict[str, str] = {}

    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        return self.get_all_role_assignments()

    def get_by_id(self, resource_id: str) -> ScanResult | None:
        try:
            assignment = self._auth_client.role_assignments.get_by_id(resource_id)
            return self._adapt_assignment(assignment)
        except Exception as e:
            log.error("iam_get_by_id_failed", resource_id=resource_id, error=str(e))
            return None

    def _build_role_cache(self) -> None:
        if self._role_name_cache:
            return
        try:
            scope = f"/subscriptions/{self._subscription_id}"
            for role_def in self._auth_client.role_definitions.list(scope):
                if role_def.id and role_def.role_name:
                    self._role_name_cache[role_def.id] = role_def.role_name
        except Exception as e:
            log.warning("role_cache_build_failed", error=str(e))

    def get_all_role_assignments(self, scope: str | None = None) -> list[ScanResult]:
        self._build_role_cache()
        results = []
        try:
            for assignment in self._auth_client.role_assignments.list_for_subscription():
                try:
                    result = self._adapt_assignment(assignment)
                    if result:
                        results.append(result)
                except Exception as e:
                    log.warning(
                        "role_assignment_adapt_failed",
                        assignment_id=assignment.id,
                        error=str(e),
                    )
        except Exception as e:
            log.error("iam_list_failed", error=str(e))

        log.info("iam_get_all_complete", count=len(results))
        return results

    def _adapt_assignment(self, assignment) -> ScanResult | None:
        props = assignment.properties
        if not props:
            return None

        role_name = self._role_name_cache.get(
            props.role_definition_id or "", "Unknown"
        )
        scope = props.scope or ""
        scope_level = (
            "resource_group" if "resourcegroups" in scope.lower() else "subscription"
        )
        principal_type = PRINCIPAL_TYPE_MAP.get(props.principal_type or "", None)

        return ScanResult(
            resource_id=assignment.id or "",
            resource_name=role_name,
            resource_type=ResourceType.RBAC_ROLE_ASSIGNMENT,
            cloud_provider=CloudProvider.AZURE,
            region="global",
            tags={},
            rbac=RBACAttributes(
                role_name=role_name,
                role_names=[role_name],
                scope=scope_level,
                principal_type=principal_type,
                role_exists=True,
            ),
            raw_response={
                "id": assignment.id,
                "scope": scope,
                "principalType": props.principal_type,
            },
        )
