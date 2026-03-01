export function cn(...classes: (string | undefined | null | false)[]): string {
    return classes.filter(Boolean).join(' ');
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toUpperCase() ?? '';
}

export function getMimeTypeLabel(file: File): string {
    const ext = getFileExtension(file.name);
    const mimeMap: Record<string, string> = {
        json: 'JSON Config',
        yaml: 'YAML Config',
        yml: 'YAML Config',
        toml: 'TOML Config',
        env: 'ENV File',
        txt: 'Text File',
        xml: 'XML Config',
    };
    return mimeMap[ext.toLowerCase()] ?? 'Config File';
}

export function generateId(): string {
    return Math.random().toString(36).slice(2, 11);
}
