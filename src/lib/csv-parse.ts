// CSV parsing utilities using Papa Parse

import Papa from 'papaparse';
import type { ColumnMapping } from '../types/salesforce';
import { escapeCsvField } from './csv-utils';

// ============================================================
// Preview Parsing
// ============================================================

export interface CsvPreviewResult {
    headers: string[];
    rowCount: number;
    previewRows: string[][];
    errors: Papa.ParseError[];
}

const DEFAULT_PREVIEW_LIMIT = 10;

/**
 * Parse CSV text to extract headers, row count, and a preview of the first N rows.
 * Used for display after file upload — does not return full data.
 */
export function parseCsvForPreview(
    csvText: string,
    previewLimit = DEFAULT_PREVIEW_LIMIT
): CsvPreviewResult {
    const result = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true,
    });

    const rows = result.data;
    if (rows.length === 0) {
        return { headers: [], rowCount: 0, previewRows: [], errors: result.errors };
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const previewRows = dataRows.slice(0, previewLimit);

    return {
        headers,
        rowCount: dataRows.length,
        previewRows,
        errors: result.errors,
    };
}

// ============================================================
// CSV Reconstruction
// ============================================================

/**
 * Reconstruct a CSV with remapped columns for Bulk API upload.
 * - Only includes columns where included=true AND fieldApiName is not null
 * - Header row uses Salesforce field API names
 * - Values are properly escaped for CSV
 */
export function reconstructCsv(csvText: string, mappings: ColumnMapping[]): string {
    const activeMappings = mappings.filter(m => m.included && m.fieldApiName !== null);

    const parsed = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length < 1) return '';

    // Header row: Salesforce field API names
    const header = activeMappings.map(m => escapeCsvField(m.fieldApiName!)).join(',');

    // Data rows: extract and escape values by csvIndex
    const dataRows = rows.slice(1).map(row => {
        return activeMappings.map(m => escapeCsvField(row[m.csvIndex] ?? '')).join(',');
    });

    return [header, ...dataRows].join('\n');
}

// ============================================================
// CSV Splitting
// ============================================================

/**
 * Split a CSV into chunks of at most maxRowsPerChunk data rows.
 * Each chunk includes the header row. Returns an array of CSV strings.
 * If the CSV has fewer rows than maxRowsPerChunk, returns a single-element array.
 */
export function splitCsvIntoChunks(csvText: string, maxRowsPerChunk: number): string[] {
    const parsed = Papa.parse<string[]>(csvText, {
        skipEmptyLines: true,
    });

    const rows = parsed.data;
    if (rows.length < 1) return [csvText];

    const header = rows[0];
    const dataRows = rows.slice(1);

    if (dataRows.length <= maxRowsPerChunk) {
        return [csvText];
    }

    const chunks: string[] = [];
    const headerLine = header.map(h => escapeCsvField(h)).join(',');

    for (let i = 0; i < dataRows.length; i += maxRowsPerChunk) {
        const chunkRows = dataRows.slice(i, i + maxRowsPerChunk);
        const chunkLines = chunkRows.map(row => row.map(v => escapeCsvField(v)).join(','));
        chunks.push([headerLine, ...chunkLines].join('\n'));
    }

    return chunks;
}
