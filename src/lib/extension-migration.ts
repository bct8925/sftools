// Data export/import for migrating between extension IDs or backing up data
import { storage, getPlatform } from '../platform';

const EXPORT_FILENAME = 'sftools-data.json';
const EXPORT_VERSION = 1;

interface ExportData {
    version: number;
    exportedAt: string;
    data: Record<string, unknown>;
}

/**
 * Export extension storage data as a JSON file (download in Chrome, save dialog in VS Code).
 * Excludes describe cache (large, rebuilt automatically).
 */
export async function exportData(): Promise<void> {
    const allData = await storage.get(null);

    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(allData)) {
        if (!key.startsWith('describeCache_')) {
            data[key] = value;
        }
    }

    const exportPayload: ExportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        data,
    };

    await getPlatform().saveFile(
        EXPORT_FILENAME,
        JSON.stringify(exportPayload, null, 2),
        'application/json'
    );
}

/**
 * Import extension storage data from a JSON file.
 * Merges imported data into current storage (overwrites matching keys).
 * Returns the number of keys imported.
 */
export async function importData(file: File): Promise<number> {
    const text = await file.text();
    let parsed: unknown;

    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('Invalid JSON file');
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid export file format');
    }

    const exportData = parsed as Partial<ExportData>;

    if (!exportData.version || !exportData.data || typeof exportData.data !== 'object') {
        throw new Error('Invalid export file: missing version or data');
    }

    const data = exportData.data;
    const keys = Object.keys(data);

    if (keys.length === 0) {
        throw new Error('Export file contains no data');
    }

    await storage.set(data);
    return keys.length;
}
