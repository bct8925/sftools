import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getValueByPath,
    formatCellValue,
    escapeCsvField,
    getExportFilename,
    recordsToCsv,
    downloadCsv,
} from '../../../src/lib/csv-utils.js';

describe('getValueByPath', () => {
    it('returns undefined for empty path', () => {
        const record = { Id: '001xx', Name: 'Test', attributes: { type: 'Account', url: '' } };
        expect(getValueByPath(record, '')).toBeUndefined();
    });

    it('returns simple field value', () => {
        const record = {
            Id: '001xx',
            Name: 'Test Account',
            attributes: { type: 'Account', url: '' },
        };
        expect(getValueByPath(record, 'Name')).toBe('Test Account');
    });

    it('traverses nested path with dot notation', () => {
        const record = {
            Id: '001xx',
            attributes: { type: 'Contact', url: '' },
            Account: {
                Name: 'Acme Inc',
                Owner: {
                    Name: 'John Doe',
                },
            },
        };
        expect(getValueByPath(record, 'Account.Name')).toBe('Acme Inc');
        expect(getValueByPath(record, 'Account.Owner.Name')).toBe('John Doe');
    });

    it('returns undefined for null intermediate value', () => {
        const record = {
            Id: '001xx',
            attributes: { type: 'Contact', url: '' },
            Account: null,
        };
        expect(getValueByPath(record, 'Account.Name')).toBeUndefined();
    });

    it('returns undefined for undefined intermediate value', () => {
        const record = {
            Id: '001xx',
            attributes: { type: 'Contact', url: '' },
        };
        expect(getValueByPath(record, 'Account.Name')).toBeUndefined();
    });

    it('returns undefined for missing key', () => {
        const record = { Id: '001xx', attributes: { type: 'Account', url: '' } };
        expect(getValueByPath(record, 'MissingField')).toBeUndefined();
    });
});

describe('formatCellValue', () => {
    it('returns empty string for null', () => {
        expect(formatCellValue(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(formatCellValue(undefined)).toBe('');
    });

    it('returns string value as-is', () => {
        expect(formatCellValue('Test String')).toBe('Test String');
    });

    it('converts number to string', () => {
        expect(formatCellValue(123)).toBe('123');
        expect(formatCellValue(45.67)).toBe('45.67');
    });

    it('converts boolean to string', () => {
        expect(formatCellValue(true)).toBe('true');
        expect(formatCellValue(false)).toBe('false');
    });

    it('extracts Name from object with Name property', () => {
        expect(formatCellValue({ Name: 'Account Name', Id: '001xx' })).toBe('Account Name');
    });

    it('extracts Id from object with Id but no Name', () => {
        expect(formatCellValue({ Id: '001xx', Type: 'Account' })).toBe('001xx');
    });

    it('returns JSON for object with neither Name nor Id', () => {
        const obj = { Type: 'Custom', Value: 42 };
        expect(formatCellValue(obj)).toBe(JSON.stringify(obj));
    });

    it('formats subquery with records array', () => {
        const subquery = { records: [{ Id: '001' }, { Id: '002' }], totalSize: 2, done: true };
        expect(formatCellValue(subquery, { path: 'Contacts', isSubquery: true })).toBe(
            '[2 records]'
        );
    });

    it('formats subquery using records length if totalSize missing', () => {
        const subquery = { records: [{ Id: '001' }, { Id: '002' }, { Id: '003' }], done: true };
        expect(formatCellValue(subquery, { path: 'Contacts', isSubquery: true })).toBe(
            '[3 records]'
        );
    });

    it('formats plain array as subquery', () => {
        const array = [{ Id: '001' }, { Id: '002' }];
        expect(formatCellValue(array, { path: 'Items', isSubquery: true })).toBe('[2 records]');
    });
});

describe('escapeCsvField', () => {
    it('returns empty string for null', () => {
        expect(escapeCsvField(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
        expect(escapeCsvField(undefined)).toBe('');
    });

    it('returns plain string as-is', () => {
        expect(escapeCsvField('Simple text')).toBe('Simple text');
    });

    it('wraps string with comma in quotes', () => {
        expect(escapeCsvField('Text, with comma')).toBe('"Text, with comma"');
    });

    it('wraps string with quotes and escapes internal quotes', () => {
        expect(escapeCsvField('Text with "quotes"')).toBe('"Text with ""quotes"""');
    });

    it('wraps string with newline in quotes', () => {
        expect(escapeCsvField('Text\nwith newline')).toBe('"Text\nwith newline"');
    });

    it('wraps string with comma, quotes, and newline', () => {
        expect(escapeCsvField('Text, "quoted"\nNewline')).toBe('"Text, ""quoted""\nNewline"');
    });
});

describe('getExportFilename', () => {
    it('uses object name in filename', () => {
        const filename = getExportFilename('Account');
        expect(filename).toMatch(/^Account_\d{8}T\d{6}\.csv$/);
    });

    it('defaults to query when object name is null', () => {
        const filename = getExportFilename(null);
        expect(filename).toMatch(/^query_\d{8}T\d{6}\.csv$/);
    });

    it('includes timestamp in correct format', () => {
        const filename = getExportFilename('Contact');
        const timestampPart = filename.replace('Contact_', '').replace('.csv', '');
        // Format: YYYYMMDDTHHMMSS
        expect(timestampPart).toMatch(/^\d{8}T\d{6}$/);
    });
});

describe('downloadCsv', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Mock URL methods if they don't exist in jsdom
        if (!global.URL.createObjectURL) {
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
        }
        if (!global.URL.revokeObjectURL) {
            global.URL.revokeObjectURL = vi.fn();
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should create blob and trigger download', () => {
        const mockLink = {
            href: '',
            download: '',
            style: { display: '' },
            click: vi.fn(),
        };
        const mockCreateElement = vi
            .spyOn(document, 'createElement')
            .mockReturnValue(mockLink as any);
        const mockAppendChild = vi
            .spyOn(document.body, 'appendChild')
            .mockImplementation(() => mockLink as any);
        const mockRemoveChild = vi
            .spyOn(document.body, 'removeChild')
            .mockImplementation(() => mockLink as any);
        const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL');
        const mockRevokeObjectURL = vi.spyOn(URL, 'revokeObjectURL');

        downloadCsv('Id,Name\n001,Test', 'test.csv');

        expect(mockCreateElement).toHaveBeenCalledWith('a');
        expect(mockLink.href).toBe('blob:mock-url');
        expect(mockLink.download).toBe('test.csv');
        expect(mockLink.style.display).toBe('none');
        expect(mockAppendChild).toHaveBeenCalledWith(mockLink);
        expect(mockLink.click).toHaveBeenCalled();
        expect(mockRemoveChild).toHaveBeenCalledWith(mockLink);

        // Wait for timeout
        vi.advanceTimersByTime(1000);
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        expect(mockCreateObjectURL).toHaveBeenCalled();
    });
});

describe('recordsToCsv', () => {
    it('generates CSV with headers and data rows', () => {
        const records = [
            { Id: '001xx', Name: 'Acme Inc', attributes: { type: 'Account', url: '' } },
            { Id: '002xx', Name: 'Global Corp', attributes: { type: 'Account', url: '' } },
        ];
        const columns = [
            { path: 'Id', title: 'Record ID' },
            { path: 'Name', title: 'Account Name' },
        ];

        const csv = recordsToCsv(records, columns);
        const lines = csv.split('\n');

        expect(lines[0]).toBe('Record ID,Account Name');
        expect(lines[1]).toBe('001xx,Acme Inc');
        expect(lines[2]).toBe('002xx,Global Corp');
    });

    it('handles empty records array', () => {
        const columns = [
            { path: 'Id', title: 'ID' },
            { path: 'Name', title: 'Name' },
        ];

        const csv = recordsToCsv([], columns);
        expect(csv).toBe('ID,Name');
    });

    it('escapes column titles with special characters', () => {
        const records = [{ Id: '001xx', attributes: { type: 'Account', url: '' } }];
        const columns = [{ path: 'Id', title: 'Record "ID"' }];

        const csv = recordsToCsv(records, columns);
        expect(csv.split('\n')[0]).toBe('"Record ""ID"""');
    });

    it('handles nested field paths', () => {
        const records = [
            {
                Id: '003xx',
                attributes: { type: 'Contact', url: '' },
                Account: { Name: 'Acme Inc' },
            },
        ];
        const columns = [
            { path: 'Id', title: 'ID' },
            { path: 'Account.Name', title: 'Account' },
        ];

        const csv = recordsToCsv(records, columns);
        const lines = csv.split('\n');

        expect(lines[0]).toBe('ID,Account');
        expect(lines[1]).toBe('003xx,Acme Inc');
    });

    it('formats subquery columns', () => {
        const records = [
            {
                Id: '001xx',
                attributes: { type: 'Account', url: '' },
                Contacts: { records: [{ Id: '003xx' }, { Id: '004xx' }], totalSize: 2, done: true },
            },
        ];
        const columns = [
            { path: 'Id', title: 'ID' },
            { path: 'Contacts', title: 'Contacts', isSubquery: true },
        ];

        const csv = recordsToCsv(records, columns);
        const lines = csv.split('\n');

        expect(lines[0]).toBe('ID,Contacts');
        expect(lines[1]).toBe('001xx,[2 records]');
    });
});
