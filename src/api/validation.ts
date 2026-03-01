import client from './client';
import type { Validation } from './types';
import { sleep } from '../lib/utils';

export async function validateExtraction(extractionId: string): Promise<Validation> {
    await sleep(800);
    const { data } = await client.get<Validation[]>('/validations');
    const match = data.find((v) => v.extractionId === extractionId);
    if (match) return match;
    return data[0];
}

export async function getValidation(id: string): Promise<Validation> {
    const { data } = await client.get<Validation>(`/validations/${id}`);
    return data;
}

export async function dismissFinding(validationId: string, findingId: string): Promise<void> {
    await sleep(200);
    console.log(`[API] Dismissed finding ${findingId} in validation ${validationId}`);
}
