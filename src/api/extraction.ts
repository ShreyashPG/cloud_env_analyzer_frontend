import client from './client';
import type { UploadResponse, PrerequisitesResponse } from './types';

/**
 * Upload PDF/DOCX prerequisites document.
 * Returns job_id to poll + document_id.
 */
export async function uploadDocument(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await client.post<UploadResponse>('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120_000, // uploads can be slow
    });
    return data;
}

/**
 * Get all prerequisites for a document grouped by review status.
 */
export async function getPrerequisites(documentId: string): Promise<PrerequisitesResponse> {
    const { data } = await client.get<PrerequisitesResponse>(
        `/documents/${documentId}/prerequisites`
    );
    return data;
}
