/**
 * Tests for src/lib/query-utils.js
 *
 * Test IDs:
 * - Q-U-001: normalizeQuery() - Removes extra whitespace
 * - Q-U-002: normalizeQuery() - Converts to lowercase
 * - Q-U-003: flattenColumnMetadata() - Flattens nested joinColumns
 * - Q-U-004: flattenColumnMetadata() - Handles multiple nesting levels
 * - Q-U-005: extractColumnsFromRecord() - Extracts keys from record
 * - Q-U-006: getValueByPath() - Returns nested value by dot path
 * - Q-U-007: getValueByPath() - Returns undefined for missing path
 * - Q-U-008: recordsToCsv() - Generates valid CSV
 * - Q-U-009: recordsToCsv() - Handles null values
 * - Q-U-010: escapeCsvField() - Escapes quotes
 * - Q-U-011: escapeCsvField() - Handles commas
 * - Q-U-012: escapeCsvField() - Handles newlines
 * - Q-U-013: formatCellValue() - Formats dates
 * - Q-U-014: formatCellValue() - Formats booleans
 * - Q-U-015: formatCellValue() - Handles null/undefined
 * - Q-U-016: parseValueFromInput() - Parses numbers
 * - Q-U-017: parseValueFromInput() - Parses booleans
 * - Q-U-018: parseValueFromInput() - Returns null for empty string
 * - Q-U-019: isFieldEditable() - Returns false for formula fields
 * - Q-U-020: isFieldEditable() - Returns true for updateable fields
 * - Q-U-021: checkIfEditable() - Returns false without Id
 * - Q-U-022: checkIfEditable() - Returns false for aggregate queries
 * - Q-U-023: normalizeQuery() - Trims whitespace
 * - Q-U-024: normalizeQuery() - Handles newlines and tabs
 * - Q-U-025: flattenColumnMetadata() - Handles subqueries with aggregate flag
 * - Q-U-026: flattenColumnMetadata() - Empty metadata array
 * - Q-U-027: extractColumnsFromRecord() - Excludes attributes key
 * - Q-U-028: extractColumnsFromRecord() - Sets default column properties
 * - Q-U-029: getValueByPath() - Returns direct value for non-nested path
 * - Q-U-030: getValueByPath() - Returns undefined for null intermediate
 * - Q-U-031: getValueByPath() - Returns undefined for empty path
 * - Q-U-032: getValueByPath() - Returns undefined for null path
 * - Q-U-033: recordsToCsv() - Handles nested paths
 * - Q-U-034: escapeCsvField() - Returns empty string for null
 * - Q-U-035: escapeCsvField() - Returns empty string for undefined
 * - Q-U-036: escapeCsvField() - Returns simple strings unchanged
 * - Q-U-037: escapeCsvField() - Converts numbers to strings
 * - Q-U-038: formatCellValue() - Returns Name property from objects
 * - Q-U-039: formatCellValue() - Returns Id property if no Name
 * - Q-U-040: formatCellValue() - Returns JSON for other objects
 * - Q-U-041: formatCellValue() - Formats subquery data with record count
 * - Q-U-042: formatCellValue() - Formats subquery array with count
 * - Q-U-043: parseValueFromInput() - Parses numbers (double)
 * - Q-U-044: parseValueFromInput() - Parses currency
 * - Q-U-045: parseValueFromInput() - Parses percent
 * - Q-U-046: parseValueFromInput() - Returns string for text types
 * - Q-U-047: parseValueFromInput() - Returns null for invalid int
 * - Q-U-048: parseValueFromInput() - Returns null for invalid double
 * - Q-U-049: isFieldEditable() - Returns false for relationship paths
 * - Q-U-050: isFieldEditable() - Returns false for non-updateable fields
 * - Q-U-051: isFieldEditable() - Returns false when field not in describe
 * - Q-U-052: isFieldEditable() - Returns false when describe is null
 * - Q-U-053: checkIfEditable() - Returns false without object name
 * - Q-U-054: checkIfEditable() - Returns true for valid editable query
 */

import { describe, it, expect } from 'vitest';
import {
    normalizeQuery,
    flattenColumnMetadata,
    extractColumnsFromRecord,
    getValueByPath,
    recordsToCsv,
    escapeCsvField,
    formatCellValue,
    parseValueFromInput,
    isFieldEditable,
    checkIfEditable
} from '../../../src/lib/query-utils.js';

describe('query-utils', () => {
    describe('normalizeQuery', () => {
        it('Q-U-001: removes extra whitespace', () => {
            const query = 'SELECT   Id,    Name   FROM   Account';
            expect(normalizeQuery(query)).toBe('select id, name from account');
        });

        it('Q-U-002: converts to lowercase', () => {
            const query = 'SELECT Id FROM Account';
            expect(normalizeQuery(query)).toBe('select id from account');
        });

        it('Q-U-023: trims leading and trailing whitespace', () => {
            const query = '  SELECT Id FROM Account  ';
            expect(normalizeQuery(query)).toBe('select id from account');
        });

        it('Q-U-024: handles newlines and tabs', () => {
            const query = 'SELECT\n\tId,\n\tName\nFROM Account';
            expect(normalizeQuery(query)).toBe('select id, name from account');
        });
    });

    describe('flattenColumnMetadata', () => {
        it('Q-U-003: flattens nested joinColumns', () => {
            const metadata = [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                {
                    columnName: 'Account',
                    displayName: 'Account',
                    aggregate: false,
                    joinColumns: [
                        { columnName: 'Name', displayName: 'Name', aggregate: false }
                    ]
                }
            ];

            const result = flattenColumnMetadata(metadata);

            expect(result).toHaveLength(2);
            expect(result[0].path).toBe('Id');
            expect(result[1].path).toBe('Account.Name');
            expect(result[1].title).toBe('Account.Name');
        });

        it('Q-U-004: handles multiple nesting levels', () => {
            const metadata = [
                {
                    columnName: 'Account',
                    displayName: 'Account',
                    aggregate: false,
                    joinColumns: [
                        {
                            columnName: 'Owner',
                            displayName: 'Owner',
                            aggregate: false,
                            joinColumns: [
                                { columnName: 'Name', displayName: 'Name', aggregate: false }
                            ]
                        }
                    ]
                }
            ];

            const result = flattenColumnMetadata(metadata);

            expect(result).toHaveLength(1);
            expect(result[0].path).toBe('Account.Owner.Name');
        });

        it('Q-U-025: handles subqueries with aggregate flag', () => {
            const metadata = [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                {
                    columnName: 'Contacts',
                    displayName: 'Contacts',
                    aggregate: true,
                    joinColumns: [
                        { columnName: 'Id', displayName: 'Id', aggregate: false },
                        { columnName: 'Name', displayName: 'Name', aggregate: false }
                    ]
                }
            ];

            const result = flattenColumnMetadata(metadata);

            expect(result).toHaveLength(2);
            expect(result[1].isSubquery).toBe(true);
            expect(result[1].subqueryColumns).toHaveLength(2);
        });

        it('Q-U-026: handles empty metadata array', () => {
            expect(flattenColumnMetadata([])).toEqual([]);
        });
    });

    describe('extractColumnsFromRecord', () => {
        it('Q-U-005: extracts keys from record', () => {
            const record = {
                Id: '001xxx',
                Name: 'Test',
                attributes: { type: 'Account' }
            };

            const result = extractColumnsFromRecord(record);

            expect(result).toHaveLength(2);
            expect(result.map(c => c.path)).toContain('Id');
            expect(result.map(c => c.path)).toContain('Name');
        });

        it('Q-U-027: excludes attributes key', () => {
            const record = {
                Id: '001xxx',
                attributes: { type: 'Account' }
            };

            const result = extractColumnsFromRecord(record);

            expect(result.map(c => c.path)).not.toContain('attributes');
        });

        it('Q-U-028: sets default column properties', () => {
            const record = { Id: '001xxx' };
            const result = extractColumnsFromRecord(record);

            expect(result[0]).toEqual({
                title: 'Id',
                path: 'Id',
                aggregate: false,
                isSubquery: false
            });
        });
    });

    describe('getValueByPath', () => {
        it('Q-U-006: returns nested value by dot path', () => {
            const record = {
                Account: {
                    Owner: {
                        Name: 'John Doe'
                    }
                }
            };

            expect(getValueByPath(record, 'Account.Owner.Name')).toBe('John Doe');
        });

        it('Q-U-007: returns undefined for missing path', () => {
            const record = { Account: { Name: 'Test' } };

            expect(getValueByPath(record, 'Account.Owner.Name')).toBeUndefined();
        });

        it('Q-U-029: returns direct value for non-nested path', () => {
            const record = { Name: 'Test Account' };

            expect(getValueByPath(record, 'Name')).toBe('Test Account');
        });

        it('Q-U-030: returns undefined for null intermediate', () => {
            const record = { Account: null };

            expect(getValueByPath(record, 'Account.Name')).toBeUndefined();
        });

        it('Q-U-031: returns undefined for empty path', () => {
            const record = { Name: 'Test' };

            expect(getValueByPath(record, '')).toBeUndefined();
        });

        it('Q-U-032: returns undefined for null path', () => {
            const record = { Name: 'Test' };

            expect(getValueByPath(record, null)).toBeUndefined();
        });
    });

    describe('recordsToCsv', () => {
        it('Q-U-008: generates valid CSV', () => {
            const records = [
                { Id: '001xxx', Name: 'Account 1' },
                { Id: '002xxx', Name: 'Account 2' }
            ];
            const columns = [
                { title: 'Id', path: 'Id' },
                { title: 'Name', path: 'Name' }
            ];

            const csv = recordsToCsv(records, columns);
            const lines = csv.split('\n');

            expect(lines).toHaveLength(3);
            expect(lines[0]).toBe('Id,Name');
            expect(lines[1]).toBe('001xxx,Account 1');
            expect(lines[2]).toBe('002xxx,Account 2');
        });

        it('Q-U-009: handles null values', () => {
            const records = [{ Id: '001xxx', Name: null }];
            const columns = [
                { title: 'Id', path: 'Id' },
                { title: 'Name', path: 'Name' }
            ];

            const csv = recordsToCsv(records, columns);

            expect(csv).toContain('001xxx,');
        });

        it('Q-U-033: handles nested paths', () => {
            const records = [
                { Id: '001xxx', Account: { Name: 'Parent Account' } }
            ];
            const columns = [
                { title: 'Id', path: 'Id' },
                { title: 'Account.Name', path: 'Account.Name' }
            ];

            const csv = recordsToCsv(records, columns);

            expect(csv).toContain('Parent Account');
        });
    });

    describe('escapeCsvField', () => {
        it('Q-U-010: escapes quotes', () => {
            expect(escapeCsvField('Say "Hello"')).toBe('"Say ""Hello"""');
        });

        it('Q-U-011: handles commas', () => {
            expect(escapeCsvField('One, Two')).toBe('"One, Two"');
        });

        it('Q-U-012: handles newlines', () => {
            expect(escapeCsvField('Line1\nLine2')).toBe('"Line1\nLine2"');
        });

        it('Q-U-034: returns empty string for null', () => {
            expect(escapeCsvField(null)).toBe('');
        });

        it('Q-U-035: returns empty string for undefined', () => {
            expect(escapeCsvField(undefined)).toBe('');
        });

        it('Q-U-036: returns simple strings unchanged', () => {
            expect(escapeCsvField('Simple text')).toBe('Simple text');
        });

        it('Q-U-037: converts numbers to strings', () => {
            expect(escapeCsvField(123)).toBe('123');
        });
    });

    describe('formatCellValue', () => {
        it('Q-U-013: formats dates (passes through as string)', () => {
            expect(formatCellValue('2024-01-15', {})).toBe('2024-01-15');
        });

        it('Q-U-014: formats booleans', () => {
            expect(formatCellValue(true, {})).toBe('true');
            expect(formatCellValue(false, {})).toBe('false');
        });

        it('Q-U-015: handles null/undefined', () => {
            expect(formatCellValue(null, {})).toBe('');
            expect(formatCellValue(undefined, {})).toBe('');
        });

        it('Q-U-038: returns Name property from objects', () => {
            const obj = { Name: 'Test Name', Id: '001xxx' };
            expect(formatCellValue(obj, {})).toBe('Test Name');
        });

        it('Q-U-039: returns Id property if no Name', () => {
            const obj = { Id: '001xxx' };
            expect(formatCellValue(obj, {})).toBe('001xxx');
        });

        it('Q-U-040: returns JSON for other objects', () => {
            const obj = { foo: 'bar' };
            expect(formatCellValue(obj, {})).toBe('{"foo":"bar"}');
        });

        it('Q-U-041: formats subquery data with record count', () => {
            const subqueryData = { records: [{}, {}], totalSize: 2 };
            expect(formatCellValue(subqueryData, { isSubquery: true })).toBe('[2 records]');
        });

        it('Q-U-042: formats subquery array with count', () => {
            const subqueryArray = [{}, {}, {}];
            expect(formatCellValue(subqueryArray, { isSubquery: true })).toBe('[3 records]');
        });
    });

    describe('parseValueFromInput', () => {
        it('Q-U-016: parses numbers (int)', () => {
            expect(parseValueFromInput('42', { type: 'int' })).toBe(42);
        });

        it('Q-U-017: parses booleans', () => {
            expect(parseValueFromInput('true', { type: 'boolean' })).toBe(true);
            expect(parseValueFromInput('false', { type: 'boolean' })).toBe(false);
        });

        it('Q-U-018: returns null for empty string', () => {
            expect(parseValueFromInput('', { type: 'string' })).toBeNull();
            expect(parseValueFromInput(null, { type: 'string' })).toBeNull();
        });

        it('Q-U-043: parses numbers (double)', () => {
            expect(parseValueFromInput('3.14', { type: 'double' })).toBe(3.14);
        });

        it('Q-U-044: parses currency', () => {
            expect(parseValueFromInput('99.99', { type: 'currency' })).toBe(99.99);
        });

        it('Q-U-045: parses percent', () => {
            expect(parseValueFromInput('0.25', { type: 'percent' })).toBe(0.25);
        });

        it('Q-U-053: parses numbers (string to number)', () => {
            expect(parseValueFromInput('42', { type: 'int' })).toBe(42);
        });

        it('Q-U-054: parses string to boolean', () => {
            expect(parseValueFromInput('true', { type: 'boolean' })).toBe(true);
            expect(parseValueFromInput('false', { type: 'boolean' })).toBe(false);
        });

        it('Q-U-055: returns null for empty string', () => {
            expect(parseValueFromInput('', { type: 'string' })).toBeNull();
            expect(parseValueFromInput(null, { type: 'string' })).toBeNull();
        });

        it('Q-U-056: preserves regular strings', () => {
            expect(parseValueFromInput('hello', { type: 'string' })).toBe('hello');
            expect(parseValueFromInput('test value', { type: 'textarea' })).toBe('test value');
        });

        it('Q-U-046: returns string for text types', () => {
            expect(parseValueFromInput('hello', { type: 'string' })).toBe('hello');
            expect(parseValueFromInput('hello', { type: 'textarea' })).toBe('hello');
        });

        it('Q-U-047: returns null for invalid int', () => {
            expect(parseValueFromInput('not a number', { type: 'int' })).toBeNull();
        });

        it('Q-U-048: returns null for invalid double', () => {
            expect(parseValueFromInput('not a number', { type: 'double' })).toBeNull();
        });
    });

    describe('isFieldEditable', () => {
        it('Q-U-019: returns false for formula fields', () => {
            const fieldDescribe = {
                FormulaField__c: { updateable: true, calculated: true }
            };

            expect(isFieldEditable('FormulaField__c', fieldDescribe)).toBe(false);
        });

        it('Q-U-057: returns false for formula/calculated fields', () => {
            const fieldDescribe = {
                FormulaField__c: { updateable: true, calculated: true }
            };

            expect(isFieldEditable('FormulaField__c', fieldDescribe)).toBe(false);
        });

        it('Q-U-020: returns true for updateable fields', () => {
            const fieldDescribe = {
                Name: { updateable: true, calculated: false }
            };

            expect(isFieldEditable('Name', fieldDescribe)).toBe(true);
        });

        it('Q-U-049: returns false for relationship paths', () => {
            const fieldDescribe = {
                'Account.Name': { updateable: true, calculated: false }
            };

            expect(isFieldEditable('Account.Name', fieldDescribe)).toBe(false);
        });

        it('Q-U-050: returns false for non-updateable fields', () => {
            const fieldDescribe = {
                CreatedDate: { updateable: false, calculated: false }
            };

            expect(isFieldEditable('CreatedDate', fieldDescribe)).toBe(false);
        });

        it('Q-U-051: returns false when field not in describe', () => {
            expect(isFieldEditable('Unknown', {})).toBe(false);
        });

        it('Q-U-052: returns false when describe is null', () => {
            expect(isFieldEditable('Name', null)).toBe(false);
        });
    });

    describe('checkIfEditable', () => {
        it('Q-U-021: returns false without Id', () => {
            const columns = [
                { path: 'Name', aggregate: false }
            ];

            expect(checkIfEditable(columns, 'Account')).toBe(false);
        });

        it('Q-U-022: returns false for aggregate queries', () => {
            const columns = [
                { path: 'Id', aggregate: false },
                { path: 'expr0', aggregate: true }
            ];

            expect(checkIfEditable(columns, 'Account')).toBe(false);
        });

        it('Q-U-053: returns false without object name', () => {
            const columns = [
                { path: 'Id', aggregate: false }
            ];

            expect(checkIfEditable(columns, null)).toBe(false);
            expect(checkIfEditable(columns, '')).toBe(false);
        });

        it('Q-U-054: returns true for valid editable query', () => {
            const columns = [
                { path: 'Id', aggregate: false },
                { path: 'Name', aggregate: false }
            ];

            expect(checkIfEditable(columns, 'Account')).toBe(true);
        });
    });
});
