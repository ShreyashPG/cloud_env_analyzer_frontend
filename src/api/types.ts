// ─────────────── Cloud Provider ───────────────
export type CloudProvider = 'aws' | 'gcp' | 'azure';

// ─────────────── Job ─────────────────────────
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
    id: string;
    job_type: 'extraction' | 'scan';
    status: JobStatus;
    progress_pct: number;
    current_step: string;
    error_message?: string | null;
    result_id?: string | null;
    created_at: string;
    updated_at: string;
}

// ─────────────── Conditions ──────────────────
export interface Condition {
    attribute: string;
    operator: 'gte' | 'lte' | 'eq' | 'in' | 'exists' | 'contains' | 'not_eq' | 'regex';
    expected_value: unknown;
    unit?: string | null;
}

// ─────────────── Prerequisite ────────────────
export type Intent = 'must_exist_before' | 'will_be_created' | 'must_not_exist' | 'optional';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type ResourceCategory = 'compute' | 'storage' | 'networking' | 'database' | 'security' | 'services' | 'resources' | 'identity';

export interface Prerequisite {
    id: string;
    category: ResourceCategory;
    resource_type: string;
    cloud_provider: CloudProvider;
    intent: Intent;
    severity: Severity;
    conditions: Condition[];
    source_text: string;
    confidence: number;
    review_required: boolean;
    review_reason?: string | null;
    extracted_at?: string;
}

// ─────────────── Document Upload ─────────────
export interface UploadResponse {
    job_id: string;
    document_id: string;
    message: string;
}

export interface PrerequisitesResponse {
    document_id: string;
    total: number;
    approved: Prerequisite[];
    pending_review: Prerequisite[];
}

// ─────────────── Review ──────────────────────
export interface ReviewItem {
    id: string;
    prerequisite_id: string;
    reason: string;
    resolved: boolean;
    resolution?: string | null;
    reviewer_note?: string | null;
    created_at: string;
    prerequisite: Prerequisite | null;
}

export type ReviewResolution = 'approved' | 'rejected' | 'modified';

// ─────────────── Scan ────────────────────────
export interface StartScanRequest {
    document_id: string;
    resource_group?: string | null;
    region?: string;
}

export interface StartScanResponse {
    job_id: string;
    document_id: string;
    message: string;
    approved_prerequisites: number;
}

// ─────────────── Findings / Report ───────────
export type FindingStatus = 'pass' | 'fail' | 'error' | 'skipped';

export interface Finding {
    id: string;
    prerequisite_id: string;
    resource_id?: string | null;
    resource_name?: string | null;
    condition: Condition;
    status: FindingStatus;
    severity: Severity;
    actual_value?: unknown;
    expected_value?: unknown;
    reason: string;
}

export interface ReportSummary {
    deployment_ready: boolean;
    total: number;
    passed: number;
    failed: number;
    errors: number;
    skipped: number;
    critical_failures: number;
    high_failures: number;
}

export interface ValidationReport {
    report_id: string;
    scan_job_id: string;
    cloud_provider: CloudProvider;
    region: string;
    generated_at: string;
    summary: ReportSummary;
    findings: Finding[];
    findings_by_status: Record<FindingStatus, Finding[]>;
}

// ─────────────── Dashboard (derived) ─────────
export interface DashboardStats {
    totalScans: number;
    totalExtractions: number;
    totalReports: number;
    totalFailures: number;
    deploymentsReady: number;
    lastActivityAt?: string;
}
