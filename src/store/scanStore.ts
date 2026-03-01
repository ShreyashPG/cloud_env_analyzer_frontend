import { create } from 'zustand';
import type { Scan, ScanResult } from '../api/types';

interface ScanState {
    scans: Scan[];
    activeScan: Scan | null;
    scanResult: ScanResult | null;   // full live data from completed scan
    isScanning: boolean;
    scanProgress: number;
    currentStep: string;
    error: string | null;

    setScans: (s: Scan[]) => void;
    setActiveScan: (s: Scan | null) => void;
    setScanResult: (r: ScanResult | null) => void;
    setIsScanning: (b: boolean) => void;
    setScanProgress: (n: number) => void;
    setCurrentStep: (s: string) => void;
    setError: (e: string | null) => void;
    reset: () => void;
}

export const useScanStore = create<ScanState>((set) => ({
    scans: [],
    activeScan: null,
    scanResult: null,
    isScanning: false,
    scanProgress: 0,
    currentStep: '',
    error: null,

    setScans: (s) => set({ scans: s }),
    setActiveScan: (s) => set({ activeScan: s }),
    setScanResult: (r) => set({ scanResult: r }),
    setIsScanning: (b) => set({ isScanning: b }),
    setScanProgress: (n) => set({ scanProgress: n }),
    setCurrentStep: (s) => set({ currentStep: s }),
    setError: (e) => set({ error: e }),
    reset: () =>
        set({ activeScan: null, scanResult: null, isScanning: false, scanProgress: 0, currentStep: '', error: null }),
}));
