import { create } from 'zustand';
import type { Prerequisite } from '../api/types';

/** Workflow phases for the extraction pipeline */
export type ExtractionPhase = 'idle' | 'uploading' | 'extracting' | 'done' | 'failed';

interface ExtractionState {
    phase: ExtractionPhase;

    // Current document being processed
    documentId: string | null;
    jobId: string | null;
    filename: string | null;

    // Job progress
    progress: number;
    currentStep: string;

    // Results after extraction
    approved: Prerequisite[];
    pendingReview: Prerequisite[];
    total: number;

    // Error
    error: string | null;

    // Actions
    setPhase: (p: ExtractionPhase) => void;
    setDocumentId: (id: string | null) => void;
    setJobId: (id: string | null) => void;
    setFilename: (n: string | null) => void;
    setProgress: (n: number, step?: string) => void;
    setResults: (approved: Prerequisite[], pendingReview: Prerequisite[], total: number) => void;
    setError: (e: string | null) => void;
    approveItem: (itemId: string) => void;
    reset: () => void;
}

const INITIAL = {
    phase: 'idle' as ExtractionPhase,
    documentId: null,
    jobId: null,
    filename: null,
    progress: 0,
    currentStep: '',
    approved: [],
    pendingReview: [],
    total: 0,
    error: null,
};

export const useExtractionStore = create<ExtractionState>((set) => ({
    ...INITIAL,

    setPhase: (p) => set({ phase: p }),
    setDocumentId: (id) => set({ documentId: id }),
    setJobId: (id) => set({ jobId: id }),
    setFilename: (n) => set({ filename: n }),
    setProgress: (n, step) =>
        set((s) => ({ progress: n, currentStep: step ?? s.currentStep })),
    setResults: (approved, pendingReview, total) =>
        set({ approved, pendingReview, total }),
    setError: (e) => set({ error: e }),
    approveItem: (itemId) =>
        set((s) => {
            const item = s.pendingReview.find((p) => p.id === itemId);
            if (!item) return {};
            return {
                pendingReview: s.pendingReview.filter((p) => p.id !== itemId),
                approved: [...s.approved, { ...item, review_required: false }],
            };
        }),
    reset: () => set({ ...INITIAL }),
}));
