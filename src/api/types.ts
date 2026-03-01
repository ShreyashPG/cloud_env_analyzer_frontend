// ─────────────── Cloud Provider ───────────────
export type CloudProvider = 'aws' | 'gcp' | 'azure';

// ─────────────── Template ────────────────────
export interface CloudTemplate {
    id: string;
    name: string;
    provider: CloudProvider;
    fields: string[];
}

// ─────────────── Prereq Doc Extraction ───────
export interface PrereqExtraction {
    id: string;
    filename: string;
    extractedAt: string;
    provider: CloudProvider;
    /** Full key→value map extracted from the document */
    data: Record<string, string | Record<string, string>>;
    /** Field keys that are NOT found in the cloud provider template */
    mismatches: string[];
}

// ─────────────── Job ─────────────────────────
export type JobStatus = 'queued' | 'uploading' | 'extracting' | 'completed' | 'failed';
export interface Job {
    id: string;
    status: JobStatus;
    progress: number;
    phase: string;
    createdAt: string;
    completedAt?: string;
    fileId: string;
    error?: string;
}

// ─────────────── Validation ──────────────────
export type FindingSeverity = 'blocker' | 'warning' | 'info';
export type FindingDomain = 'identity' | 'network' | 'policy' | 'resources' | 'services' | 'general';
export type ValidationStatus = 'pending' | 'validating' | 'passed' | 'mismatch' | 'failed';

export interface Finding {
    id: string;
    field: string;
    severity: FindingSeverity;
    domain: FindingDomain;
    message: string;
    remediation: string;
}

export interface Validation {
    id: string;
    extractionId: string;
    templateId: string;
    status: ValidationStatus;
    validatedAt?: string;
    findings: Finding[];
}

// ─────────────── Scan ────────────────────────
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ScanResult {
    provider: CloudProvider;
    environment: string;
    scannedAt: string;
    /** Live environment data returned by the scan */
    data: Record<string, unknown>;
    /** Permissions/roles/rules found */
    permissions: string[];
    roles: string[];
    networkRules: Array<{ port: number; cidr: string; direction: 'inbound' | 'outbound'; allowed: boolean }>;
}

export interface Scan {
    id: string;
    provider: CloudProvider;
    status: ScanStatus;
    startedAt: string;
    completedAt?: string;
    resourceCount: number;
    issueCount: number;
    environment: string;
    scope?: string;
    error?: string;
}

// ─────────────── Comparison Report ───────────
export type GapSeverity = 'blocker' | 'warning';
export type GapCategory = 'permission' | 'role' | 'network_rule' | 'field_missing' | 'value_mismatch';

export interface GapItem {
    id: string;
    category: GapCategory;
    field: string;
    prereqValue: string;
    scanValue: string | null;
    severity: GapSeverity;
    description: string;
    remediation: string;
}

export interface ComparisonReport {
    id: string;
    generatedAt: string;
    provider: CloudProvider;
    environment: string;
    totalGaps: number;
    blockerGaps: number;
    warningGaps: number;
    prereqFields: number;
    matchedFields: number;
    gaps: GapItem[];
}

// ─────────────── Audit Log ───────────────────
export type AuditEventLevel = 'info' | 'warn' | 'error' | 'success';
export interface AuditEvent {
    id: string;
    timestamp: string;
    level: AuditEventLevel;
    module: string;
    action: string;
    result: string;
    durationMs?: number;
    meta?: Record<string, unknown>;
}

// ─────────────── Dashboard ───────────────────
export interface DashboardStats {
    id: string;
    totalScans: number;
    totalExtractions: number;
    totalValidations: number;
    totalIssues: number;
    deploymentsReady: number;
    lastScanAt: string;
    providerDistribution: Record<CloudProvider, number>;
}

// ─────────────── Upload Response ─────────────
export interface UploadResponse {
    jobId: string;
    fileId: string;
    filename: string;
    size: number;
}
