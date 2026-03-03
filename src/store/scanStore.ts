import { create } from 'zustand';
import type { ValidationReport } from '../api/types';

interface ScanState {
    // Scan job tracking
    scanJobId: string | null;
    documentId: string | null;
    isScanning: boolean;
    scanProgress: number;
    currentStep: string;
    error: string | null;

    // Completed report
    report: ValidationReport | null;
    reportId: string | null;

    // Actions
    setScanJobId: (id: string | null) => void;
    setDocumentId: (id: string | null) => void;
    setIsScanning: (b: boolean) => void;
    setScanProgress: (n: number, step?: string) => void;
    setReport: (r: ValidationReport | null) => void;
    setReportId: (id: string | null) => void;
    setError: (e: string | null) => void;
    reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
    scanJobId: null,
    documentId: null,
    isScanning: false,
    scanProgress: 0,
    currentStep: '',
    error: null,
    report: null,
    reportId: null,

    setScanJobId: (id) => set({ scanJobId: id }),
    setDocumentId: (id) => set({ documentId: id }),
    setIsScanning: (b) => set({ isScanning: b }),
    setScanProgress: (n, step) =>
        set((s) => ({ scanProgress: n, currentStep: step ?? s.currentStep })),
    setReport: (r) => set({ report: r }),
    setReportId: (id) => set({ reportId: id }),
    setError: (e) => set({ error: e }),
    reset: () =>
        set({
            scanJobId: null,
            isScanning: false,
            scanProgress: 0,
            currentStep: '',
            error: null,
            report: null,
            reportId: null,
        }),
}));
