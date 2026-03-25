import { describe, it, expect } from 'vitest';
import {
    parseCsvForPreview,
    reconstructCsv,
    splitCsvIntoChunks,
} from '../../../src/lib/csv-parse.js';
import type { ColumnMapping } from '../../../src/types/salesforce.js';

describe('parseCsvForPreview', () => {
    it('returns headers and row count for simple CSV', () => {
        const csv = 'Name,Email\nAlice,alice@example.com\nBob,bob@example.com';
        const result = parseCsvForPreview(csv);

        expect(result.headers).toEqual(['Name', 'Email']);
        expect(result.rowCount).toBe(2);
        expect(result.errors).toHaveLength(0);
    });

    it('limits previewRows to previewLimit', () => {
        const csv = 'Id\n1\n2\n3\n4\n5';
        const result = parseCsvForPreview(csv, 2);

        expect(result.previewRows).toHaveLength(2);
        expect(result.rowCount).toBe(5);
    });

    it('returns empty result for empty CSV', () => {
        const result = parseCsvForPreview('');

        expect(result.headers).toHaveLength(0);
        expect(result.rowCount).toBe(0);
        expect(result.previewRows).toHaveLength(0);
    });

    it('returns default 10-row preview limit', () => {
        const rows = Array.from({ length: 15 }, (_, i) => `row${i}`);
        const csv = ['Id', ...rows].join('\n');
        const result = parseCsvForPreview(csv);

        expect(result.previewRows).toHaveLength(10);
        expect(result.rowCount).toBe(15);
    });

    it('handles CSV with quoted fields', () => {
        const csv = 'Name,Description\n"Acme, Inc","A company, with comma"';
        const result = parseCsvForPreview(csv);

        expect(result.headers).toEqual(['Name', 'Description']);
        expect(result.rowCount).toBe(1);
    });
});

describe('reconstructCsv', () => {
    const baseMappings: ColumnMapping[] = [
        {
            csvHeader: 'name',
            csvIndex: 0,
            fieldApiName: 'Name',
            included: true,
            mappingSource: 'api-name',
        },
        {
            csvHeader: 'email',
            csvIndex: 1,
            fieldApiName: 'Email__c',
            included: true,
            mappingSource: 'label',
        },
        {
            csvHeader: 'skip',
            csvIndex: 2,
            fieldApiName: null,
            included: false,
            mappingSource: 'none',
        },
    ];

    it('produces header row with SF field API names', () => {
        const csv = 'name,email,skip\nAlice,a@test.com,ignored';
        const result = reconstructCsv(csv, baseMappings);
        const lines = result.split('\n');

        expect(lines[0]).toBe('Name,Email__c');
    });

    it('excludes columns where included=false or fieldApiName=null', () => {
        const csv = 'name,email,skip\nAlice,a@test.com,ignored';
        const result = reconstructCsv(csv, baseMappings);
        const lines = result.split('\n');

        expect(lines[1]).toBe('Alice,a@test.com');
        expect(lines[1]).not.toContain('ignored');
    });

    it('maps by csvIndex (not header name)', () => {
        const csv = 'col_a,col_b\nvalA,valB';
        const mappings: ColumnMapping[] = [
            {
                csvHeader: 'col_a',
                csvIndex: 0,
                fieldApiName: 'Field_A__c',
                included: true,
                mappingSource: 'manual',
            },
            {
                csvHeader: 'col_b',
                csvIndex: 1,
                fieldApiName: 'Field_B__c',
                included: true,
                mappingSource: 'manual',
            },
        ];
        const result = reconstructCsv(csv, mappings);
        expect(result).toBe('Field_A__c,Field_B__c\nvalA,valB');
    });

    it('escapes values with commas', () => {
        const csv = 'Name\n"Acme, Inc"';
        const mappings: ColumnMapping[] = [
            {
                csvHeader: 'Name',
                csvIndex: 0,
                fieldApiName: 'Name',
                included: true,
                mappingSource: 'api-name',
            },
        ];
        const result = reconstructCsv(csv, mappings);
        expect(result).toBe('Name\n"Acme, Inc"');
    });

    it('returns empty string for empty CSV', () => {
        expect(reconstructCsv('', baseMappings)).toBe('');
    });
});

describe('splitCsvIntoChunks', () => {
    it('returns single chunk when rows <= maxRowsPerChunk', () => {
        const csv = 'Id\n1\n2\n3';
        const chunks = splitCsvIntoChunks(csv, 10);

        expect(chunks).toHaveLength(1);
        expect(chunks[0]).toBe(csv);
    });

    it('splits into correct number of chunks', () => {
        const rows = Array.from({ length: 10 }, (_, i) => String(i + 1));
        const csv = ['Id', ...rows].join('\n');
        const chunks = splitCsvIntoChunks(csv, 3);

        // 10 rows, 3 per chunk = 4 chunks (3+3+3+1)
        expect(chunks).toHaveLength(4);
    });

    it('each chunk includes header row', () => {
        const csv = 'Name,Email\nAlice,a@test.com\nBob,b@test.com\nCarol,c@test.com';
        const chunks = splitCsvIntoChunks(csv, 2);

        expect(chunks).toHaveLength(2);
        expect(chunks[0].split('\n')[0]).toBe('Name,Email');
        expect(chunks[1].split('\n')[0]).toBe('Name,Email');
    });

    it('last chunk contains remaining rows', () => {
        const csv = 'Id\n1\n2\n3\n4\n5';
        const chunks = splitCsvIntoChunks(csv, 2);

        expect(chunks).toHaveLength(3);
        // Last chunk has just 1 row
        const lastChunkLines = chunks[2].split('\n').filter(l => l.trim());
        expect(lastChunkLines).toHaveLength(2); // header + 1 row
    });

    it('returns original CSV as single element when empty', () => {
        const csv = 'Id\n';
        const chunks = splitCsvIntoChunks(csv, 5);
        expect(chunks).toHaveLength(1);
    });
});
