import { create } from 'zustand';
import type { ReviewItem } from '../api/types';

interface ReviewState {
    items: ReviewItem[];
    isLoading: boolean;
    error: string | null;
    resolvedIds: string[];

    setItems: (items: ReviewItem[]) => void;
    setIsLoading: (b: boolean) => void;
    setError: (e: string | null) => void;
    markResolved: (itemId: string, resolution: string) => void;
    reset: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
    items: [],
    isLoading: false,
    error: null,
    resolvedIds: [],

    setItems: (items) => set({ items }),
    setIsLoading: (b) => set({ isLoading: b }),
    setError: (e) => set({ error: e }),
    markResolved: (itemId, resolution) =>
        set((s) => ({
            items: s.items.map((item) =>
                item.id === itemId
                    ? { ...item, resolved: true, resolution }
                    : item
            ),
            resolvedIds: [...s.resolvedIds, itemId],
        })),
    reset: () => set({ items: [], isLoading: false, error: null, resolvedIds: [] }),
}));
