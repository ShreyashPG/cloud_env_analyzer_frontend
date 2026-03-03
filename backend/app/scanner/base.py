"""app/scanner/base.py — Abstract base provider for cloud resource scanning"""
from __future__ import annotations

from abc import ABC, abstractmethod

from app.core.types import ScanResult


class BaseProvider(ABC):
    """
    Abstract base class for cloud resource providers.
    All Azure providers inherit from this.

    Constructor always takes (credential, subscription_id).
    All methods catch all exceptions, log with structlog, return empty/None.
    """

    @abstractmethod
    def get_all(
        self,
        resource_group: str | None = None,
        name_filter: str | None = None,
    ) -> list[ScanResult]:
        """Never raises. Returns [] on failure."""
        ...

    @abstractmethod
    def get_by_id(self, resource_id: str) -> ScanResult | None:
        """Returns None if not found or on error."""
        ...

    @staticmethod
    def _parse_arm_id(resource_id: str) -> tuple[str, str]:
        """
        Parse Azure ARM resource ID into (resource_group, resource_name).
        ARM ID format: /subscriptions/{sub}/resourceGroups/{rg}/providers/{ns}/{type}/{name}
        """
        parts = resource_id.split("/")
        name = parts[-1] if parts else ""
        rg = ""
        for i, part in enumerate(parts):
            if part.lower() == "resourcegroups" and i + 1 < len(parts):
                rg = parts[i + 1]
                break
        return rg, name
