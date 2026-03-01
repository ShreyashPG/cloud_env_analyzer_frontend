import client from './client';
import type { Scan } from './types';
import { sleep, generateId } from '../lib/utils';

export async function getScans(): Promise<Scan[]> {
    const { data } = await client.get<Scan[]>('/scans');
    return data;
}

export async function startScan(params: {
    provider: string;
    environment: string;
    credentials: Record<string, string>;
}): Promise<Scan> {
    const newScan: Partial<Scan> = {
        id: `scan-${generateId()}`,
        provider: params.provider as Scan['provider'],
        status: 'running',
        startedAt: new Date().toISOString(),
        resourceCount: 0,
        issueCount: 0,
        environment: params.environment,
    };
    await sleep(500);
    return newScan as Scan;
}

export async function getScan(id: string): Promise<Scan> {
    const { data } = await client.get<Scan>(`/scans/${id}`);
    return data;
}
