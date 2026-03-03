"""
app/core/types.py — SINGLE SOURCE OF TRUTH FOR ALL DATA SHAPES.
No other file may define Pydantic models for domain objects.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class CloudProvider(str, Enum):
    AZURE = "azure"


class ResourceCategory(str, Enum):
    RESOURCES = "resources"
    NETWORK = "network"
    IAM = "iam"
    SERVICES = "services"
    SECURITY = "security"
    QUOTAS = "quotas"


class ResourceType(str, Enum):
    VIRTUAL_MACHINE = "virtual_machine"
    KUBERNETES_CLUSTER = "kubernetes_cluster"
    BLOCK_STORAGE = "block_storage"
    OBJECT_STORAGE = "object_storage"
    RELATIONAL_DATABASE = "relational_database"
    CACHING_SERVICE = "caching_service"
    VIRTUAL_NETWORK = "virtual_network"
    SUBNET = "subnet"
    NETWORK_SECURITY_GROUP = "network_security_group"
    DNS_ZONE = "dns_zone"
    APP_LOAD_BALANCER = "app_load_balancer"
    RBAC_ROLE_ASSIGNMENT = "rbac_role_assignment"
    SERVICE_PRINCIPAL = "service_principal"
    MANAGED_IDENTITY = "managed_identity"
    APP_REGISTRATION = "app_registration"
    ENABLED_SERVICE = "enabled_service"
    PRIVATE_ENDPOINT = "private_endpoint"
    KEY_VAULT = "key_vault"
    CERTIFICATE = "certificate"
    FIREWALL_RULE = "firewall_rule"
    COMPUTE_QUOTA = "compute_quota"


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ResourceIntent(str, Enum):
    MUST_EXIST_BEFORE = "must_exist_before"
    WILL_BE_CREATED = "will_be_created"
    MUST_NOT_EXIST = "must_not_exist"
    OPTIONAL = "optional"


class Operator(str, Enum):
    GTE = "gte"
    LTE = "lte"
    EQ = "eq"
    IN = "in"
    EXISTS = "exists"
    CONTAINS = "contains"
    REGEX = "regex"
    NOT_EQ = "not_eq"


class FindingStatus(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    ERROR = "error"
    SKIPPED = "skipped"


# ---------------------------------------------------------------------------
# LLM Output Schema — FLAT and SIMPLE (raw types only, no validators, no enums)
# ---------------------------------------------------------------------------

class ExtractedCondition(BaseModel):
    attribute: str
    operator: str
    value: Any
    unit: str | None = None


class ExtractedRequirement(BaseModel):
    resource_type: str
    conditions: list[ExtractedCondition]
    severity: str
    intent: str
    source_text: str
    confidence: float
    reasoning: str


# ---------------------------------------------------------------------------
# Validated Domain Models
# ---------------------------------------------------------------------------

class Condition(BaseModel):
    attribute: str
    operator: Operator
    expected_value: Any
    unit: str | None = None
    description: str | None = None


def _gen_prereq_id() -> str:
    return f"pre_{uuid.uuid4().hex[:12]}"


class Prerequisite(BaseModel):
    id: str = Field(default_factory=_gen_prereq_id)
    category: ResourceCategory
    resource_type: ResourceType
    cloud_provider: CloudProvider = CloudProvider.AZURE
    intent: ResourceIntent = ResourceIntent.MUST_EXIST_BEFORE
    conditions: list[Condition]
    severity: Severity = Severity.HIGH
    source_text: str
    confidence: float = Field(ge=0.0, le=1.0)
    review_required: bool = False
    review_reason: str | None = None
    extracted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Attribute Classes — one per resource type, all fields Optional
# ---------------------------------------------------------------------------

class ComputeAttributes(BaseModel):
    vm_size: str | None = None
    min_vcpu: int | None = None
    min_memory_gb: float | None = None
    os_type: str | None = None
    os_version: str | None = None
    architecture: str | None = None
    availability_zone: str | None = None


class KubernetesAttributes(BaseModel):
    k8s_version: str | None = None
    min_node_count: int | None = None
    max_node_count: int | None = None
    node_vm_size: str | None = None
    network_plugin: str | None = None
    rbac_enabled: bool | None = None
    private_cluster: bool | None = None
    required_addons: list[str] = []


class StorageAttributes(BaseModel):
    disk_size_gb: int | None = None
    disk_type: str | None = None
    storage_tier: str | None = None
    redundancy: str | None = None
    encryption_enabled: bool | None = None
    public_access: str | None = None


class DatabaseAttributes(BaseModel):
    db_engine: str | None = None
    db_version: str | None = None
    db_tier: str | None = None
    min_vcores: int | None = None
    min_storage_gb: int | None = None
    ha_enabled: bool | None = None
    backup_retention_days: int | None = None
    public_access: str | None = None
    ssl_required: bool | None = None


class VirtualNetworkAttributes(BaseModel):
    vnet_cidr: str | None = None
    vnet_exists: bool | None = None
    region: str | None = None
    peering_enabled: bool | None = None
    dns_servers: list[str] = []


class SubnetAttributes(BaseModel):
    subnet_cidr: str | None = None
    min_subnet_size: int | None = None
    subnet_exists: bool | None = None
    dedicated_subnet: bool | None = None
    nsg_attached: bool | None = None


class NSGAttributes(BaseModel):
    open_ports: list[int] = []
    blocked_ports: list[int] = []
    allows_internet_inbound: bool | None = None
    ssh_rdp_exposed: bool | None = None


class RBACAttributes(BaseModel):
    role_name: str | None = None
    role_names: list[str] = []
    scope: str | None = None
    principal_type: str | None = None
    role_exists: bool | None = None


class ServicePrincipalAttributes(BaseModel):
    sp_exists: bool | None = None
    sp_type: str | None = None
    client_id_exists: bool | None = None
    client_secret_valid: bool | None = None


class EnabledServiceAttributes(BaseModel):
    service_name: str | None = None
    service_enabled: bool | None = None


class EncryptionAttributes(BaseModel):
    key_vault_exists: bool | None = None
    encryption_at_rest: bool | None = None
    encryption_in_transit: bool | None = None
    tls_version: str | None = None


class CertificateAttributes(BaseModel):
    cert_exists: bool | None = None
    cert_valid: bool | None = None
    days_until_expiry: int | None = None
    ssl_enabled: bool | None = None


class FirewallRuleAttributes(BaseModel):
    rule_exists: bool | None = None
    allowed_ip_ranges: list[str] = []
    target_service: str | None = None
    rule_type: str | None = None


class ComputeQuotaAttributes(BaseModel):
    quota_name: str | None = None
    vcpu_quota_total: int | None = None
    vcpu_quota_used: int | None = None
    vcpu_quota_available: int | None = None


# ---------------------------------------------------------------------------
# ScanResult — one per discovered Azure resource
# ---------------------------------------------------------------------------

class ScanResult(BaseModel):
    resource_id: str
    resource_name: str
    resource_type: ResourceType
    cloud_provider: CloudProvider = CloudProvider.AZURE
    region: str
    tags: dict = {}

    # Attribute groups — only one will be populated per result
    compute: ComputeAttributes | None = None
    kubernetes: KubernetesAttributes | None = None
    storage: StorageAttributes | None = None
    database: DatabaseAttributes | None = None
    virtual_network: VirtualNetworkAttributes | None = None
    subnet: SubnetAttributes | None = None
    nsg: NSGAttributes | None = None
    rbac: RBACAttributes | None = None
    service_principal: ServicePrincipalAttributes | None = None
    enabled_service: EnabledServiceAttributes | None = None
    encryption: EncryptionAttributes | None = None
    certificate: CertificateAttributes | None = None
    firewall_rule: FirewallRuleAttributes | None = None
    compute_quota: ComputeQuotaAttributes | None = None

    raw_response: dict = {}
    scan_timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ---------------------------------------------------------------------------
# Findings and Validation Report
# ---------------------------------------------------------------------------

def _gen_report_id() -> str:
    return f"rpt_{uuid.uuid4().hex[:12]}"


class Finding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    prerequisite_id: str
    resource_id: str | None = None
    resource_name: str | None = None
    condition: Condition
    status: FindingStatus
    severity: Severity
    actual_value: Any = None
    expected_value: Any = None
    reason: str | None = None


class ValidationReport(BaseModel):
    report_id: str = Field(default_factory=_gen_report_id)
    scan_job_id: str
    cloud_provider: CloudProvider = CloudProvider.AZURE
    region: str = "eastus"
    findings: list[Finding] = []

    # Computed rollup fields — set by model_validator
    total: int = 0
    passed: int = 0
    failed: int = 0
    errors: int = 0
    skipped: int = 0
    critical_failures: int = 0
    high_failures: int = 0
    deployment_ready: bool = False

    @model_validator(mode="after")
    def compute_rollup(self) -> "ValidationReport":
        self.total = len(self.findings)
        self.passed = sum(1 for f in self.findings if f.status == FindingStatus.PASS)
        self.failed = sum(1 for f in self.findings if f.status == FindingStatus.FAIL)
        self.errors = sum(1 for f in self.findings if f.status == FindingStatus.ERROR)
        self.skipped = sum(1 for f in self.findings if f.status == FindingStatus.SKIPPED)

        failures = [f for f in self.findings if f.status == FindingStatus.FAIL]
        self.critical_failures = sum(1 for f in failures if f.severity == Severity.CRITICAL)
        self.high_failures = sum(1 for f in failures if f.severity == Severity.HIGH)

        self.deployment_ready = self.critical_failures == 0 and self.high_failures == 0
        return self


# ---------------------------------------------------------------------------
# ATTRIBUTE_TO_GROUP — maps every valid attribute name → ScanResult field name
# ---------------------------------------------------------------------------

ATTRIBUTE_TO_GROUP: dict[str, str] = {
    # ComputeAttributes
    "vm_size": "compute",
    "min_vcpu": "compute",
    "min_memory_gb": "compute",
    "os_type": "compute",
    "os_version": "compute",
    "architecture": "compute",
    "availability_zone": "compute",
    # KubernetesAttributes
    "k8s_version": "kubernetes",
    "min_node_count": "kubernetes",
    "max_node_count": "kubernetes",
    "node_vm_size": "kubernetes",
    "network_plugin": "kubernetes",
    "rbac_enabled": "kubernetes",
    "private_cluster": "kubernetes",
    "required_addons": "kubernetes",
    # StorageAttributes
    "disk_size_gb": "storage",
    "disk_type": "storage",
    "storage_tier": "storage",
    "redundancy": "storage",
    "encryption_enabled": "storage",
    "public_access": "storage",
    # DatabaseAttributes
    "db_engine": "database",
    "db_version": "database",
    "db_tier": "database",
    "min_vcores": "database",
    "min_storage_gb": "database",
    "ha_enabled": "database",
    "backup_retention_days": "database",
    "ssl_required": "database",
    # VirtualNetworkAttributes
    "vnet_cidr": "virtual_network",
    "vnet_exists": "virtual_network",
    "peering_enabled": "virtual_network",
    "dns_servers": "virtual_network",
    # SubnetAttributes
    "subnet_cidr": "subnet",
    "min_subnet_size": "subnet",
    "subnet_exists": "subnet",
    "dedicated_subnet": "subnet",
    "nsg_attached": "subnet",
    # NSGAttributes
    "open_ports": "nsg",
    "blocked_ports": "nsg",
    "allows_internet_inbound": "nsg",
    "ssh_rdp_exposed": "nsg",
    # RBACAttributes
    "role_name": "rbac",
    "role_names": "rbac",
    "scope": "rbac",
    "principal_type": "rbac",
    "role_exists": "rbac",
    # ServicePrincipalAttributes
    "sp_exists": "service_principal",
    "sp_type": "service_principal",
    "client_id_exists": "service_principal",
    "client_secret_valid": "service_principal",
    # EnabledServiceAttributes
    "service_name": "enabled_service",
    "service_enabled": "enabled_service",
    # EncryptionAttributes
    "key_vault_exists": "encryption",
    "encryption_at_rest": "encryption",
    "encryption_in_transit": "encryption",
    "tls_version": "encryption",
    # CertificateAttributes
    "cert_exists": "certificate",
    "cert_valid": "certificate",
    "days_until_expiry": "certificate",
    "ssl_enabled": "certificate",
    # FirewallRuleAttributes
    "rule_exists": "firewall_rule",
    "allowed_ip_ranges": "firewall_rule",
    "target_service": "firewall_rule",
    "rule_type": "firewall_rule",
    # ComputeQuotaAttributes
    "quota_name": "compute_quota",
    "vcpu_quota_total": "compute_quota",
    "vcpu_quota_used": "compute_quota",
    "vcpu_quota_available": "compute_quota",
}

# ---------------------------------------------------------------------------
# Derived lists used by prompts and validators
# ---------------------------------------------------------------------------

VALID_ATTRIBUTE_NAMES: list[str] = sorted(ATTRIBUTE_TO_GROUP.keys())
VALID_RESOURCE_TYPES: list[str] = [rt.value for rt in ResourceType]
VALID_OPERATORS: list[str] = [op.value for op in Operator]

# ---------------------------------------------------------------------------
# Resource type → category mapping
# ---------------------------------------------------------------------------

RESOURCE_TYPE_TO_CATEGORY: dict[str, ResourceCategory] = {
    "virtual_machine": ResourceCategory.RESOURCES,
    "kubernetes_cluster": ResourceCategory.RESOURCES,
    "block_storage": ResourceCategory.RESOURCES,
    "object_storage": ResourceCategory.RESOURCES,
    "relational_database": ResourceCategory.RESOURCES,
    "caching_service": ResourceCategory.RESOURCES,
    "virtual_network": ResourceCategory.NETWORK,
    "subnet": ResourceCategory.NETWORK,
    "network_security_group": ResourceCategory.NETWORK,
    "dns_zone": ResourceCategory.NETWORK,
    "app_load_balancer": ResourceCategory.NETWORK,
    "rbac_role_assignment": ResourceCategory.IAM,
    "service_principal": ResourceCategory.IAM,
    "managed_identity": ResourceCategory.IAM,
    "app_registration": ResourceCategory.IAM,
    "enabled_service": ResourceCategory.SERVICES,
    "private_endpoint": ResourceCategory.NETWORK,
    "key_vault": ResourceCategory.SECURITY,
    "certificate": ResourceCategory.SECURITY,
    "firewall_rule": ResourceCategory.SECURITY,
    "compute_quota": ResourceCategory.QUOTAS,
}
