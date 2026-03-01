import client from './client';
import type { CloudTemplate, Extraction, UploadResponse } from './types';
import { sleep, generateId } from '../lib/utils';

// ─── Fetch available templates ────────────────────────────
export async function getTemplates(): Promise<CloudTemplate[]> {
    const { data } = await client.get<CloudTemplate[]>('/templates');
    return data;
}

// ─── Simulate file upload (returns after fake delay) ─────
export async function uploadConfigFile(
    file: File,
    onProgress: (pct: number) => void,
    templateId: string
): Promise<UploadResponse> {
    // Simulate chunked upload with progress ticks
    for (let i = 10; i <= 100; i += 10) {
        await sleep(220);
        onProgress(i);
    }
    // In a real scenario this would be a multipart/form-data POST
    return {
        jobId: `job-${generateId()}`,
        fileId: `file-${generateId()}`,
        filename: file.name,
        size: file.size,
        templateId,
    } as UploadResponse & { templateId: string };
}

// ─── Simulate extraction (returns after fake delay) ────────
export async function triggerExtraction(
    fileId: string,
    templateId: string,
    onProgress: (pct: number) => void
): Promise<Extraction> {
    for (let i = 10; i <= 100; i += 10) {
        await sleep(280);
        onProgress(i);
    }
    // fetch the pre-seeded extraction from JSON server
    const { data } = await client.get<Extraction[]>('/extractions');
    const match = data.find((e) => e.templateId === templateId);
    if (match) return match;
    // fallback — use first extraction
    return data[0];
}

// ─── Get extraction by id ──────────────────────────────────
export async function getExtraction(id: string): Promise<Extraction> {
    const { data } = await client.get<Extraction>(`/extractions/${id}`);
    return data;
}

// ─── Remove a mismatch field from extraction data ─────────
export async function removeMismatchField(
    extractionId: string,
    field: string
): Promise<void> {
    // Simulate removal — in real app would PATCH the extraction
    await sleep(200);
    console.log(`[API] Removed field "${field}" from extraction ${extractionId}`);
}
