"""
tests/test_validation.py — Validation engine unit tests (no external dependencies).
These tests verify the core logic without any database or Azure credentials.
"""
from __future__ import annotations

import pytest

from app.core.types import (
    CloudProvider,
    Condition,
    KubernetesAttributes,
    Operator,
    Prerequisite,
    ResourceCategory,
    ResourceIntent,
    ResourceType,
    ScanResult,
    Severity,
    FindingStatus,
)
from app.validation.engine import ValidationEngine


def make_k8s_prereq(operator: str, version: str, severity: str = "critical") -> dict:
    """Helper: create a kubernetes_cluster prerequisite dict."""
    from app.core.types import RESOURCE_TYPE_TO_CATEGORY
    p = Prerequisite(
        category=RESOURCE_TYPE_TO_CATEGORY["kubernetes_cluster"],
        resource_type=ResourceType.KUBERNETES_CLUSTER,
        intent=ResourceIntent.MUST_EXIST_BEFORE,
        conditions=[
            Condition(
                attribute="k8s_version",
                operator=Operator(operator),
                expected_value=version,
            )
        ],
        severity=Severity(severity),
        source_text="cluster must be kubernetes 1.28+",
        confidence=0.95,
    )
    return p.model_dump(mode="json")


def make_k8s_scan(version: str) -> dict:
    """Helper: create a kubernetes ScanResult dict."""
    sr = ScanResult(
        resource_id="/subscriptions/test/resourceGroups/rg/providers/Microsoft.ContainerService/managedClusters/my-aks",
        resource_name="my-aks",
        resource_type=ResourceType.KUBERNETES_CLUSTER,
        cloud_provider=CloudProvider.AZURE,
        region="eastus",
        kubernetes=KubernetesAttributes(k8s_version=version),
    )
    return sr.model_dump(mode="json")


class TestValidationEngine:
    engine = ValidationEngine()

    def test_k8s_version_gte_pass(self):
        """k8s_version GTE 1.28 with actual 1.29.2 → deployment_ready=True, pass=1"""
        prereqs = [make_k8s_prereq("gte", "1.28")]
        scans = [make_k8s_scan("1.29.2")]
        report = self.engine.run(prereqs, scans, scan_job_id="job-1")

        assert report.deployment_ready is True
        assert report.passed == 1
        assert report.failed == 0
        assert report.critical_failures == 0

    def test_k8s_version_gte_fail(self):
        """k8s_version GTE 1.28 with actual 1.25.0 → deployment_ready=False, failed=1"""
        prereqs = [make_k8s_prereq("gte", "1.28", severity="critical")]
        scans = [make_k8s_scan("1.25.0")]
        report = self.engine.run(prereqs, scans, scan_job_id="job-2")

        assert report.deployment_ready is False
        assert report.failed == 1
        assert report.critical_failures == 1

    def test_will_be_created_skipped(self):
        """WILL_BE_CREATED intent → skipped=1, deployment_ready=True"""
        from app.core.types import RESOURCE_TYPE_TO_CATEGORY
        p = Prerequisite(
            category=RESOURCE_TYPE_TO_CATEGORY["kubernetes_cluster"],
            resource_type=ResourceType.KUBERNETES_CLUSTER,
            intent=ResourceIntent.WILL_BE_CREATED,
            conditions=[
                Condition(
                    attribute="k8s_version",
                    operator=Operator.GTE,
                    expected_value="1.28",
                )
            ],
            severity=Severity.HIGH,
            source_text="cluster will be created by terraform",
            confidence=0.90,
        )
        prereqs = [p.model_dump(mode="json")]
        scans = []  # no scan results needed
        report = self.engine.run(prereqs, scans, scan_job_id="job-3")

        assert report.skipped == 1
        assert report.deployment_ready is True  # skipped doesn't block

    def test_no_resources_found_critical_fail(self):
        """MUST_EXIST_BEFORE with no resources in subscription → FAIL, not SKIPPED."""
        prereqs = [make_k8s_prereq("gte", "1.28", severity="critical")]
        scans = []  # no scan results
        report = self.engine.run(prereqs, scans, scan_job_id="job-4")

        assert report.failed == 1
        assert report.deployment_ready is False

    def test_evaluator_gte_version_strings(self):
        """Evaluator should handle version strings like '1.28.5'."""
        from app.validation.evaluators import evaluate_gte
        assert evaluate_gte("1.29.2", "1.28") is True
        assert evaluate_gte("1.25.0", "1.28") is False
        assert evaluate_gte("1.28.0", "1.28") is True

    def test_evaluator_eq_bool(self):
        """eq evaluator handles bool comparisons correctly."""
        from app.validation.evaluators import evaluate_eq
        assert evaluate_eq(True, True) is True
        assert evaluate_eq(True, False) is False
        assert evaluate_eq(False, False) is True

    def test_evaluator_exists(self):
        """exists evaluator returns True for non-None, non-empty values."""
        from app.validation.evaluators import evaluate_exists
        assert evaluate_exists("foo", None) is True
        assert evaluate_exists(None, None) is False
        assert evaluate_exists("", None) is False
        assert evaluate_exists(0, None) is True  # 0 exists

    def test_evaluator_in(self):
        """in evaluator checks membership case-insensitively."""
        from app.validation.evaluators import evaluate_in
        assert evaluate_in("eastus", ["eastus", "westus"]) is True
        assert evaluate_in("EastUS", ["eastus"]) is True
        assert evaluate_in("northeurope", ["eastus", "westus"]) is False

    def test_report_rollup_computed(self):
        """ValidationReport model_validator computes rollup fields correctly."""
        from app.core.types import Finding, ValidationReport
        findings = [
            Finding(
                prerequisite_id="pre_1",
                condition=Condition(attribute="k8s_version", operator=Operator.GTE, expected_value="1.28"),
                status=FindingStatus.PASS,
                severity=Severity.HIGH,
            ),
            Finding(
                prerequisite_id="pre_2",
                condition=Condition(attribute="ha_enabled", operator=Operator.EQ, expected_value=True),
                status=FindingStatus.FAIL,
                severity=Severity.CRITICAL,
            ),
        ]
        report = ValidationReport(scan_job_id="job-test", findings=findings)
        assert report.total == 2
        assert report.passed == 1
        assert report.failed == 1
        assert report.critical_failures == 1
        assert report.deployment_ready is False
