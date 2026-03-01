import client from './client';
import type { Job } from './types';

export async function getJob(id: string): Promise<Job> {
    const { data } = await client.get<Job[]>('/jobs');
    const match = data.find((j) => j.id === id);
    if (match) return match;
    return { ...data[0], id };
}

export async function pollJobUntilDone(
    jobId: string,
    onUpdate: (job: Job) => void,
    intervalMs = 2000,
    timeoutMs = 120000
): Promise<Job> {
    const start = Date.now();
    return new Promise<Job>((resolve, reject) => {
        const tick = async () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error('Job polling timed out'));
                return;
            }
            const job = await getJob(jobId);
            onUpdate(job);
            if (job.status === 'completed') return resolve(job);
            if (job.status === 'failed') return reject(new Error(job.error ?? 'Job failed'));
            setTimeout(tick, intervalMs);
        };
        tick();
    });
}
