// validationStore is now a thin convenience store.
// The Validation page handles dismissed-findings state locally.
// The report data lives in scanStore.
import { create } from 'zustand';

interface ValidationState {
    dismissedFindings: string[];
    dismissFinding: (id: string) => void;
    dismissMultiple: (ids: string[]) => void;
    undismissFinding: (id: string) => void;
    undismissAll: () => void;
    reset: () => void;
}

export const useValidationStore = create<ValidationState>((set) => ({
    dismissedFindings: [],

    dismissFinding: (id) =>
        set((s) => ({ dismissedFindings: [...new Set([...s.dismissedFindings, id])] })),
    dismissMultiple: (ids) =>
        set((s) => ({ dismissedFindings: [...new Set([...s.dismissedFindings, ...ids])] })),
    undismissFinding: (id) =>
        set((s) => ({ dismissedFindings: s.dismissedFindings.filter((d) => d !== id) })),
    undismissAll: () => set({ dismissedFindings: [] }),
    reset: () => set({ dismissedFindings: [] }),
}));
