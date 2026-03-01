import { create } from 'zustand';
import type { Validation } from '../api/types';

interface ValidationState {
    validation: Validation | null;
    isValidating: boolean;
    dismissedFindings: string[];
    error: string | null;

    setValidation: (v: Validation | null) => void;
    setIsValidating: (b: boolean) => void;
    dismissFinding: (id: string) => void;
    dismissMultiple: (ids: string[]) => void;
    undismissFinding: (id: string) => void;
    undismissAll: () => void;
    setError: (e: string | null) => void;
    reset: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
    validation: null,
    isValidating: false,
    dismissedFindings: [],
    error: null,

    setValidation: (v) => set({ validation: v }),
    setIsValidating: (b) => set({ isValidating: b }),
    dismissFinding: (id) =>
        set((s) => ({ dismissedFindings: [...new Set([...s.dismissedFindings, id])] })),
    dismissMultiple: (ids) =>
        set((s) => ({ dismissedFindings: [...new Set([...s.dismissedFindings, ...ids])] })),
    undismissFinding: (id) =>
        set((s) => ({ dismissedFindings: s.dismissedFindings.filter((d) => d !== id) })),
    undismissAll: () => set({ dismissedFindings: [] }),
    setError: (e) => set({ error: e }),
    reset: () =>
        set({ validation: null, isValidating: false, dismissedFindings: [], error: null }),
}));

