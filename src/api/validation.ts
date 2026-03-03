import client from './client';
import type { ReviewItem, ReviewResolution } from './types';

/**
 * List review items, optionally filtered by document_id.
 */
export async function listReviewItems(documentId?: string): Promise<ReviewItem[]> {
    const params = documentId ? { document_id: documentId } : {};
    const { data } = await client.get<{ items: ReviewItem[]; total: number }>('/review', { params });
    return data.items;
}

/**
 * Resolve a review item.
 */
export async function resolveReviewItem(
    itemId: string,
    resolution: ReviewResolution,
    note?: string,
    modifiedConditions?: unknown[]
): Promise<void> {
    await client.post(`/review/${itemId}/resolve`, {
        resolution,
        note: note ?? null,
        modified_conditions: modifiedConditions ?? null,
    });
}
