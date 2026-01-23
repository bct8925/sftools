/**
 * Tests for src/lib/record-utils.js
 *
 * Test IDs:
 * - RV-U-001: sortFields() - Id first
 * - RV-U-002: sortFields() - Name second
 * - RV-U-003: sortFields() - Alphabetical sort
 * - RV-U-004: filterFields() - Address exclusion
 * - RV-U-005: filterFields() - Location exclusion
 * - RV-U-006: formatValue() - Boolean formatting
 * - RV-U-007: formatValue() - Date formatting
 * - RV-U-008: formatValue() - Null handling
 * - RV-U-009: formatPreviewHtml() - Reference link
 * - RV-U-010: formatPreviewHtml() - Preview button
 * - RV-U-011: parseValue() - Boolean parsing
 * - RV-U-012: parseValue() - Number parsing
 * - RV-U-013: getChangedFields() - Modified fields only
 * - RV-U-014: sortFields() - No mutation of original array
 * - RV-U-015: filterFields() - Attributes exclusion
 * - RV-U-016: formatValue() - Numeric types as strings
 * - RV-U-017: formatValue() - Other types as strings
 * - RV-U-018: formatPreviewHtml() - Preview button for textarea
 * - RV-U-019: formatPreviewHtml() - Preview button for encryptedstring
 * - RV-U-020: formatPreviewHtml() - No preview button for empty rich text
 * - RV-U-021: formatPreviewHtml() - Checkbox placeholder for boolean
 * - RV-U-022: formatPreviewHtml() - Datetime formatting
 * - RV-U-023: formatPreviewHtml() - Date formatting
 * - RV-U-024: formatPreviewHtml() - Reference with OwnerId special display
 * - RV-U-025: formatPreviewHtml() - Reference without related data
 * - RV-U-026: formatPreviewHtml() - Null values
 * - RV-U-027: formatPreviewHtml() - Other types as strings
 * - RV-U-028: parseValue() - Empty string as null
 * - RV-U-029: parseValue() - Null input
 * - RV-U-030: parseValue() - Invalid numeric inputs
 * - RV-U-031: parseValue() - String as-is for string fields
 * - RV-U-032: getChangedFields() - Exclude non-updateable fields
 * - RV-U-033: getChangedFields() - Exclude calculated fields
 * - RV-U-034: getChangedFields() - Null to value changes
 * - RV-U-035: getChangedFields() - Value to null changes
 * - RV-U-036: getChangedFields() - Undefined values as empty strings
 * - RV-U-037: getChangedFields() - Numeric value changes
 * - RV-U-038: getChangedFields() - Empty object when no changes
 */

import { describe, it, expect } from 'vitest';
import {
    sortFields,
    filterFields,
    formatValue,
    formatPreviewHtml,
    parseValue,
    getChangedFields,
} from '../../../src/lib/record-utils.js';

describe('sortFields', () => {
    it('RV-U-001: should place Id field first', () => {
        const fields = [
            { name: 'Name', nameField: false },
            { name: 'Id', nameField: false },
            { name: 'Email', nameField: false },
        ];

        const sorted = sortFields(fields);
        expect(sorted[0].name).toBe('Id');
    });

    it('RV-U-002: should place Name field second', () => {
        const fields = [
            { name: 'Email', nameField: false },
            { name: 'Name', nameField: true },
            { name: 'Id', nameField: false },
        ];

        const sorted = sortFields(fields);
        expect(sorted[0].name).toBe('Id');
        expect(sorted[1].name).toBe('Name');
    });

    it('RV-U-003: should sort remaining fields alphabetically', () => {
        const fields = [
            { name: 'Zebra__c', nameField: false },
            { name: 'Name', nameField: true },
            { name: 'Id', nameField: false },
            { name: 'Apple__c', nameField: false },
            { name: 'Banana__c', nameField: false },
        ];

        const sorted = sortFields(fields);
        expect(sorted[0].name).toBe('Id');
        expect(sorted[1].name).toBe('Name');
        expect(sorted[2].name).toBe('Apple__c');
        expect(sorted[3].name).toBe('Banana__c');
        expect(sorted[4].name).toBe('Zebra__c');
    });

    it('RV-U-014: should not mutate original array', () => {
        const fields = [
            { name: 'Name', nameField: false },
            { name: 'Id', nameField: false },
        ];
        const original = [...fields];

        sortFields(fields);
        expect(fields).toEqual(original);
    });
});

describe('filterFields', () => {
    it('RV-U-004: should exclude address type fields', () => {
        const fields = [
            { name: 'Id', type: 'id' },
            { name: 'BillingAddress', type: 'address' },
            { name: 'Name', type: 'string' },
        ];

        const filtered = filterFields(fields);
        expect(filtered).toHaveLength(2);
        expect(filtered.find(f => f.type === 'address')).toBeUndefined();
    });

    it('RV-U-005: should exclude location type fields', () => {
        const fields = [
            { name: 'Id', type: 'id' },
            { name: 'Geolocation__c', type: 'location' },
            { name: 'Name', type: 'string' },
        ];

        const filtered = filterFields(fields);
        expect(filtered).toHaveLength(2);
        expect(filtered.find(f => f.type === 'location')).toBeUndefined();
    });

    it('RV-U-015: should exclude attributes field', () => {
        const fields = [
            { name: 'Id', type: 'id' },
            { name: 'attributes', type: 'object' },
            { name: 'Name', type: 'string' },
        ];

        const filtered = filterFields(fields);
        expect(filtered).toHaveLength(2);
        expect(filtered.find(f => f.name === 'attributes')).toBeUndefined();
    });
});

describe('formatValue', () => {
    it('RV-U-006: should format boolean values', () => {
        const field = { type: 'boolean' };
        expect(formatValue(true, field)).toBe('true');
        expect(formatValue(false, field)).toBe('false');
    });

    it('RV-U-007: should format date values', () => {
        const dateField = { type: 'date' };
        const datetimeField = { type: 'datetime' };

        expect(formatValue('2024-01-15', dateField)).toBe('2024-01-15');
        expect(formatValue('2024-01-15T10:30:00Z', datetimeField)).toBe('2024-01-15T10:30:00Z');
    });

    it('RV-U-008: should handle null values', () => {
        const field = { type: 'string' };
        expect(formatValue(null, field)).toBe('');
        expect(formatValue(undefined, field)).toBe('');
    });

    it('RV-U-016: should format numeric types as strings', () => {
        expect(formatValue(42, { type: 'int' })).toBe('42');
        expect(formatValue(99.99, { type: 'double' })).toBe('99.99');
        expect(formatValue(1000.5, { type: 'currency' })).toBe('1000.5');
        expect(formatValue(25.5, { type: 'percent' })).toBe('25.5');
    });

    it('RV-U-017: should format other types as strings', () => {
        const field = { type: 'string' };
        expect(formatValue('Hello', field)).toBe('Hello');
        expect(formatValue(12345, field)).toBe('12345');
    });
});

describe('formatPreviewHtml', () => {
    it('RV-U-009: should create reference link placeholder', () => {
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
        const connectionId = 'conn-123';

        const result = formatPreviewHtml(
            record.AccountId,
            field,
            record,
            nameFieldMap,
            connectionId
        );
        expect(result).toContain('__LINK__');
        expect(result).toContain('Acme Corp');
        expect(result).toContain('Account');
        expect(result).toContain('001xxxxxxxxxxxx');
    });

    it('RV-U-010: should create preview button placeholder for rich text', () => {
        const field = { type: 'html' };
        const result = formatPreviewHtml('<p>Rich content</p>', field, {});
        expect(result).toBe('__PREVIEW_BUTTON__');
    });

    it('RV-U-018: should create preview button placeholder for textarea', () => {
        const field = { type: 'textarea' };
        const result = formatPreviewHtml('Long text content', field, {});
        expect(result).toBe('__PREVIEW_BUTTON__');
    });

    it('RV-U-019: should create preview button placeholder for encryptedstring', () => {
        const field = { type: 'encryptedstring' };
        const result = formatPreviewHtml('Encrypted content', field, {});
        expect(result).toBe('__PREVIEW_BUTTON__');
    });

    it('RV-U-020: should not create preview button for empty rich text', () => {
        const field = { type: 'html' };
        expect(formatPreviewHtml('', field, {})).toBe('');
        expect(formatPreviewHtml('   ', field, {})).toBe('   '); // Empty spaces return as-is, not trimmed
        expect(formatPreviewHtml(null, field, {})).toBe('');
    });

    it('RV-U-021: should create checkbox placeholder for boolean', () => {
        const field = { type: 'boolean' };
        expect(formatPreviewHtml(true, field, {})).toBe('__CHECKBOX_CHECKED__');
        expect(formatPreviewHtml(false, field, {})).toBe('__CHECKBOX_UNCHECKED__');
    });

    it('RV-U-022: should format datetime values', () => {
        const field = { type: 'datetime' };
        const value = '2024-01-15T10:30:00Z';
        const result = formatPreviewHtml(value, field, {});
        expect(result).toBe(new Date(value).toLocaleString());
    });

    it('RV-U-023: should format date values', () => {
        const field = { type: 'date' };
        const value = '2024-01-15';
        const result = formatPreviewHtml(value, field, {});
        expect(result).toBe(new Date(value + 'T00:00:00').toLocaleDateString());
    });

    it('RV-U-024: should handle reference with OwnerId special display', () => {
        const field = {
            name: 'OwnerId',
            type: 'reference',
            relationshipName: 'Owner',
            referenceTo: ['User'],
        };
        const record = {
            OwnerId: '005xxxxxxxxxxxx',
            Owner: { Name: 'John Doe' },
        };
        const nameFieldMap = { User: 'Name' };
        const connectionId = 'conn-123';

        const result = formatPreviewHtml(record.OwnerId, field, record, nameFieldMap, connectionId);
        expect(result).toContain('User/Group');
    });

    it('RV-U-025: should handle reference without related data', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            relationshipName: 'Account',
            referenceTo: ['Account'],
        };
        const record = { AccountId: '001xxxxxxxxxxxx' };
        const nameFieldMap = {};
        const connectionId = 'conn-123';

        const result = formatPreviewHtml(
            record.AccountId,
            field,
            record,
            nameFieldMap,
            connectionId
        );
        expect(result).toBe('001xxxxxxxxxxxx');
    });

    it('RV-U-026: should handle null values', () => {
        const field = { type: 'string' };
        expect(formatPreviewHtml(null, field, {})).toBe('');
        expect(formatPreviewHtml(undefined, field, {})).toBe('');
    });

    it('RV-U-027: should format other types as strings', () => {
        const field = { type: 'string' };
        expect(formatPreviewHtml('Hello', field, {})).toBe('Hello');
        expect(formatPreviewHtml(12345, field, {})).toBe('12345');
    });
});

describe('parseValue', () => {
    it('RV-U-011: should parse string to boolean', () => {
        const field = { type: 'boolean' };
        expect(parseValue('true', field)).toBe(true);
        expect(parseValue('True', field)).toBe(true);
        expect(parseValue('TRUE', field)).toBe(true);
        expect(parseValue('false', field)).toBe(false);
        expect(parseValue('False', field)).toBe(false);
        expect(parseValue('anything', field)).toBe(false);
    });

    it('RV-U-012: should parse string to number', () => {
        const intField = { type: 'int' };
        const doubleField = { type: 'double' };
        const currencyField = { type: 'currency' };
        const percentField = { type: 'percent' };

        expect(parseValue('42', intField)).toBe(42);
        expect(parseValue('-10', intField)).toBe(-10);
        expect(parseValue('99.99', doubleField)).toBe(99.99);
        expect(parseValue('1000.50', currencyField)).toBe(1000.5);
        expect(parseValue('25.5', percentField)).toBe(25.5);
    });

    it('RV-U-028: should handle empty string as null', () => {
        const field = { type: 'string' };
        expect(parseValue('', field)).toBeNull();
    });

    it('RV-U-029: should handle null input', () => {
        const field = { type: 'string' };
        expect(parseValue(null, field)).toBeNull();
    });

    it('RV-U-030: should return null for invalid numeric inputs', () => {
        expect(parseValue('abc', { type: 'int' })).toBeNull();
        expect(parseValue('xyz', { type: 'double' })).toBeNull();
    });

    it('RV-U-031: should return string as-is for string fields', () => {
        const field = { type: 'string' };
        expect(parseValue('Hello', field)).toBe('Hello');
        expect(parseValue('  Spaces  ', field)).toBe('  Spaces  ');
    });
});

describe('getChangedFields', () => {
    it('RV-U-013: should return only modified fields', () => {
        const originalValues = {
            Id: '001xxxxxxxxxxxx',
            Name: 'Original Name',
            Email: 'original@example.com',
            Active__c: true,
        };

        const currentValues = {
            Id: '001xxxxxxxxxxxx',
            Name: 'Updated Name',
            Email: 'original@example.com',
            Active__c: false,
        };

        const fieldDescribe = {
            Id: { updateable: false, calculated: false },
            Name: { updateable: true, calculated: false },
            Email: { updateable: true, calculated: false },
            Active__c: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);

        expect(Object.keys(changes)).toHaveLength(2);
        expect(changes.Name).toBe('Updated Name');
        expect(changes.Active__c).toBe(false);
        expect(changes.Email).toBeUndefined();
        expect(changes.Id).toBeUndefined();
    });

    it('RV-U-032: should exclude non-updateable fields', () => {
        const originalValues = { Id: '001', CreatedDate: '2024-01-01' };
        const currentValues = { Id: '002', CreatedDate: '2024-01-02' };
        const fieldDescribe = {
            Id: { updateable: false, calculated: false },
            CreatedDate: { updateable: false, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(Object.keys(changes)).toHaveLength(0);
    });

    it('RV-U-033: should exclude calculated fields', () => {
        const originalValues = { Formula__c: 'value1' };
        const currentValues = { Formula__c: 'value2' };
        const fieldDescribe = {
            Formula__c: { updateable: true, calculated: true },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(Object.keys(changes)).toHaveLength(0);
    });

    it('RV-U-034: should handle null to value changes', () => {
        const originalValues = { Email: null };
        const currentValues = { Email: 'new@example.com' };
        const fieldDescribe = {
            Email: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(changes.Email).toBe('new@example.com');
    });

    it('RV-U-035: should handle value to null changes', () => {
        const originalValues = { Email: 'old@example.com' };
        const currentValues = { Email: null };
        const fieldDescribe = {
            Email: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(changes.Email).toBeNull();
    });

    it('RV-U-036: should handle undefined values as empty strings', () => {
        const originalValues = { Email: undefined };
        const currentValues = { Email: '' };
        const fieldDescribe = {
            Email: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(Object.keys(changes)).toHaveLength(0);
    });

    it('RV-U-037: should detect changes when comparing numeric values', () => {
        const originalValues = { Amount: 100 };
        const currentValues = { Amount: 200 };
        const fieldDescribe = {
            Amount: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(changes.Amount).toBe(200);
    });

    it('RV-U-038: handles null values', () => {
        const originalValues = { Name: 'Original', Amount: null };
        const currentValues = { Name: 'Original', Amount: 100 };
        const fieldDescribe = {
            Name: { updateable: true, calculated: false },
            Amount: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(changes.Amount).toBe(100);
        expect(changes.Name).toBeUndefined();
    });

    it('RV-U-039: should return empty object when no changes', () => {
        const originalValues = { Name: 'Test', Email: 'test@example.com' };
        const currentValues = { Name: 'Test', Email: 'test@example.com' };
        const fieldDescribe = {
            Name: { updateable: true, calculated: false },
            Email: { updateable: true, calculated: false },
        };

        const changes = getChangedFields(originalValues, currentValues, fieldDescribe);
        expect(Object.keys(changes)).toHaveLength(0);
    });
});
