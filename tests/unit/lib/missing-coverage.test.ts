/**
 * Tests for missing coverage lines in various lib files
 */

import { describe, it, expect } from 'vitest';
import { formatOutput } from '../../../src/lib/apex-utils.js';
import { flattenColumnMetadata } from '../../../src/lib/column-utils.js';
import { formatPreviewHtml } from '../../../src/lib/record-utils.js';
import { escapeAttr } from '../../../src/lib/text-utils.js';
import { valuesEqual } from '../../../src/lib/value-utils.js';

describe('apex-utils - missing compileProblem', () => {
    it('should use fallback message when compileProblem is missing', () => {
        const result = {
            compiled: false,
            success: false,
            line: 5,
            column: 12,
        };

        const output = formatOutput(result, null);

        expect(output).toContain('=== COMPILATION ERROR ===');
        expect(output).toContain('Line 5, Column 12');
        expect(output).toContain('Unknown compilation error');
    });
});

describe('column-utils - subquery with prefix', () => {
    it('should use path as title when prefix is present for subquery', () => {
        const input = [
            {
                columnName: 'Contacts',
                displayName: 'Contacts',
                aggregate: true,
                joinColumns: [{ columnName: 'Id', displayName: 'Contact ID', aggregate: false }],
            },
        ];

        // Call with prefix to test line 37
        const result = flattenColumnMetadata(input, 'Account');

        expect(result).toEqual([
            {
                title: 'Account.Contacts',
                path: 'Account.Contacts',
                aggregate: false,
                isSubquery: true,
                subqueryColumns: input[0].joinColumns,
            },
        ]);
    });
});

describe('record-utils - reference field edge cases', () => {
    it('should return string value when relationshipName is missing', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            referenceTo: ['Account'],
        };
        const record = { AccountId: '001xxxxxxxxxxxx' };

        const result = formatPreviewHtml('001xxxxxxxxxxxx', field, record, {}, 'conn-123');

        expect(result).toBe('001xxxxxxxxxxxx');
    });

    it('should return string value when referenceTo is empty', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            relationshipName: 'Account',
            referenceTo: [],
        };
        const record = { AccountId: '001xxxxxxxxxxxx' };

        const result = formatPreviewHtml('001xxxxxxxxxxxx', field, record, {}, 'conn-123');

        expect(result).toBe('001xxxxxxxxxxxx');
    });

    it('should return string value when connectionId is null', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            relationshipName: 'Account',
            referenceTo: ['Account'],
        };
        const record = {
            AccountId: '001xxxxxxxxxxxx',
            Account: { Name: 'Acme Corp' },
        };
        const nameFieldMap = { Account: 'Name' };

        const result = formatPreviewHtml('001xxxxxxxxxxxx', field, record, nameFieldMap, null);

        expect(result).toBe('001xxxxxxxxxxxx');
    });

    it('should return empty string for null value in default case', () => {
        const field = {
            name: 'CustomField__c',
            type: 'string',
        };

        const result = formatPreviewHtml(null, field, {});

        expect(result).toBe('');
    });
});

describe('text-utils - escapeAttr with non-string', () => {
    it('should convert non-string to string before escaping', () => {
        expect(escapeAttr(123 as any)).toBe('123');
        expect(escapeAttr(true as any)).toBe('true');
        expect(escapeAttr(false as any)).toBe('false');
    });
});

describe('value-utils - valuesEqual edge case', () => {
    it('should use empty string fallback when newValue is undefined', () => {
        expect(valuesEqual('test', undefined)).toBe(false);
        expect(valuesEqual('', undefined)).toBe(true);
    });
});
