import client from './client';
import type { StartScanRequest, StartScanResponse, ValidationReport } from './types';

/**
 * Start an Azure scan for the given document's approved prerequisites.
 * Returns job_id to poll.
 */
export async function startScan(params: StartScanRequest): Promise<StartScanResponse> {
    const { data } = await client.post<StartScanResponse>('/scans', params);
    return data;
}

/**
 * Fetch the full validation report by its ID.
 */
export async function getReport(reportId: string): Promise<ValidationReport> {
    const { data } = await client.get<ValidationReport>(`/reports/${reportId}`);
    return data;
}
