import { create } from 'zustand';
import type { PrereqExtraction, CloudTemplate, Validation, CloudProvider } from '../api/types';

/** 3-step workflow: idle → extracting → extracted(review) */
export type WorkflowStep = 'idle' | 'extracting' | 'extracted' | 'failed';

interface ExtractionState {
    // ── Workflow step ─────────────────────────────────
    phase: WorkflowStep;

    // ── Prereq document ───────────────────────────────
    prereqFile: File | null;
    selectedProvider: CloudProvider | null;
    selectedTemplate: CloudTemplate | null;

    // ── Extraction progress ───────────────────────────
    extractProgress: number;
    elapsedSeconds: number;

    // ── Extraction result ─────────────────────────────
    prereqExtraction: PrereqExtraction | null;

    // ── Review edits ──────────────────────────────────
    removedFields: string[];
    addedFields: Record<string, string>;
    renamedFields: Record<string, string>;

    // ── Validation result ─────────────────────────────
    validation: Validation | null;

    error: string | null;

    // ── Actions ───────────────────────────────────────
    setPhase: (p: WorkflowStep) => void;
    setPrereqFile: (f: File | null) => void;
    setSelectedProvider: (p: CloudProvider | null) => void;
    setTemplate: (t: CloudTemplate | null) => void;
    setExtractProgress: (n: number) => void;
    setElapsedSeconds: (n: number) => void;
    setPrereqExtraction: (e: PrereqExtraction | null) => void;
    removeField: (field: string) => void;
    removeAllMismatchFields: () => void;
    addCustomField: (key: string, value: string) => void;
    renameField: (originalKey: string, newKey: string) => void;
    setValidation: (v: Validation | null) => void;
    setError: (e: string | null) => void;
    reset: () => void;
}

const INITIAL = {
    phase: 'idle' as WorkflowStep,
    prereqFile: null,
    selectedProvider: null,
    selectedTemplate: null,
    extractProgress: 0,
    elapsedSeconds: 0,
    prereqExtraction: null,
    removedFields: [],
    addedFields: {},
    renamedFields: {},
    validation: null,
    error: null,
};

export const useExtractionStore = create<ExtractionState>((set) => ({
    ...INITIAL,

    setPhase: (p) => set({ phase: p }),
    setPrereqFile: (f) => set({ prereqFile: f }),
    setSelectedProvider: (p) => set({ selectedProvider: p }),
    setTemplate: (t) => set({ selectedTemplate: t }),
    setExtractProgress: (n) => set({ extractProgress: n }),
    setElapsedSeconds: (n) => set({ elapsedSeconds: n }),
    setPrereqExtraction: (e) => set({ prereqExtraction: e }),

    removeField: (field) =>
        set((s) => ({ removedFields: [...s.removedFields, field] })),
    removeAllMismatchFields: () =>
        set((s) => ({
            removedFields: s.prereqExtraction
                ? [...s.prereqExtraction.mismatches]
                : s.removedFields,
        })),
    addCustomField: (key, value) =>
        set((s) => ({ addedFields: { ...s.addedFields, [key]: value } })),
    renameField: (originalKey, newKey) =>
        set((s) => ({ renamedFields: { ...s.renamedFields, [originalKey]: newKey } })),

    setValidation: (v) => set({ validation: v }),
    setError: (e) => set({ error: e }),

    reset: () => set({ ...INITIAL }),
}));
