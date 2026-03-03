import client from './client';
import type { Job } from './types';

export async function getJob(id: string): Promise<Job> {
    const { data } = await client.get<Job>(`/jobs/${id}`);
    return data;
}

/**
 * Poll a job by ID until it reaches 'completed' or 'failed'.
 * Calls onUpdate on each tick with the latest Job state.
 */
export async function pollJobUntilDone(
    jobId: string,
    onUpdate: (job: Job) => void,
    intervalMs = 2000,
    timeoutMs = 300_000 // 5 min max for large documents or slow Azure scans
): Promise<Job> {
    const start = Date.now();
    return new Promise<Job>((resolve, reject) => {
        const tick = async () => {
            if (Date.now() - start > timeoutMs) {
                reject(new Error('Job timed out after 5 minutes'));
                return;
            }
            try {
                const job = await getJob(jobId);
                onUpdate(job);
                if (job.status === 'completed') return resolve(job);
                if (job.status === 'failed')
                    return reject(new Error(job.error_message ?? 'Job failed'));
                setTimeout(tick, intervalMs);
            } catch (err) {
                // Network blip — retry instead of failing immediately
                setTimeout(tick, intervalMs * 2);
            }
        };
        tick();
    });
}
