/**
 * Tests for src/lib/schema-utils.js
 *
 * Test IDs:
 * - SB-U-001: filterObjects() - Filters by API name
 * - SB-U-002: filterObjects() - Filters by label
 * - SB-U-003: filterObjects() - Case insensitive
 * - SB-U-004: filterFields() - Filters by API name
 * - SB-U-005: filterFields() - Filters by label
 * - SB-U-006: getFieldTypeDisplay() - Returns "Formula" for calculated
 * - SB-U-007: getFieldTypeDisplay() - Returns type name
 * - SB-U-008: filterObjects() - Returns all objects when search term is empty
 * - SB-U-009: filterObjects() - Returns all objects when search term is whitespace
 * - SB-U-010: filterObjects() - Returns empty array when no matches
 * - SB-U-011: filterObjects() - Returns multiple matches
 * - SB-U-012: filterFields() - Returns all fields when search term is empty
 * - SB-U-013: filterFields() - Returns all fields when search term is whitespace
 * - SB-U-014: filterFields() - Returns empty array when no matches
 * - SB-U-015: filterFields() - Returns multiple matches
 * - SB-U-016: getFieldTypeDisplay() - Returns reference info for reference fields (single)
 * - SB-U-017: getFieldTypeDisplay() - Returns reference info for reference fields (multiple)
 * - SB-U-018: getFieldTypeDisplay() - Marks OwnerId as not clickable reference
 * - SB-U-019: getFieldTypeDisplay() - Handles reference fields without referenceTo
 * - SB-U-020: getFieldTypeDisplay() - Handles reference fields with empty referenceTo
 */

import { describe, it, expect } from 'vitest';
import { filterObjects, filterFields, getFieldTypeDisplay } from '../../../src/lib/schema-utils.js';

describe('filterObjects', () => {
    const objects = [
        { name: 'Account', label: 'Account' },
        { name: 'Contact', label: 'Contact' },
        { name: 'Custom_Object__c', label: 'Custom Object' },
        { name: 'Order', label: 'Order' },
    ];

    it('SB-U-001: filters by API name', () => {
        const result = filterObjects(objects, 'Account');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Account');
    });

    it('SB-U-001: filters by API name (partial match)', () => {
        const result = filterObjects(objects, 'custom');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Custom_Object__c');
    });

    it('SB-U-002: filters by label', () => {
        const result = filterObjects(objects, 'Contact');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Contact');
    });

    it('SB-U-002: filters by label (partial match)', () => {
        const result = filterObjects(objects, 'Custom');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Custom Object');
    });

    it('SB-U-003: is case insensitive', () => {
        const result = filterObjects(objects, 'ACCOUNT');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Account');
    });

    it('SB-U-008: returns all objects when search term is empty', () => {
        const result = filterObjects(objects, '');
        expect(result).toHaveLength(4);
    });

    it('SB-U-009: returns all objects when search term is whitespace', () => {
        const result = filterObjects(objects, '   ');
        expect(result).toHaveLength(4);
    });

    it('SB-U-010: returns empty array when no matches', () => {
        const result = filterObjects(objects, 'NonExistent');
        expect(result).toHaveLength(0);
    });

    it('SB-U-011: returns multiple matches', () => {
        const result = filterObjects(objects, 'o');
        expect(result.length).toBeGreaterThan(1);
    });
});

describe('filterFields', () => {
    const fields = [
        { name: 'Id', label: 'Record ID' },
        { name: 'Name', label: 'Account Name' },
        { name: 'Email', label: 'Email' },
        { name: 'Custom_Field__c', label: 'Custom Field' },
    ];

    it('SB-U-004: filters by API name', () => {
        const result = filterFields(fields, 'Name');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Name');
    });

    it('SB-U-004: filters by API name (partial match)', () => {
        const result = filterFields(fields, 'custom');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Custom_Field__c');
    });

    it('SB-U-005: filters by label', () => {
        const result = filterFields(fields, 'Email');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Email');
    });

    it('SB-U-005: filters by label (partial match)', () => {
        const result = filterFields(fields, 'Account');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Account Name');
    });

    it('SB-U-005: is case insensitive', () => {
        const result = filterFields(fields, 'EMAIL');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Email');
    });

    it('SB-U-012: returns all fields when search term is empty', () => {
        const result = filterFields(fields, '');
        expect(result).toHaveLength(4);
    });

    it('SB-U-013: returns all fields when search term is whitespace', () => {
        const result = filterFields(fields, '   ');
        expect(result).toHaveLength(4);
    });

    it('SB-U-014: returns empty array when no matches', () => {
        const result = filterFields(fields, 'NonExistent');
        expect(result).toHaveLength(0);
    });

    it('SB-U-015: returns multiple matches', () => {
        const result = filterFields(fields, 'e');
        expect(result.length).toBeGreaterThan(1);
    });
});

describe('getFieldTypeDisplay', () => {
    it('SB-U-006: returns "formula" for calculated fields with formula', () => {
        const field = {
            type: 'string',
            calculated: true,
            calculatedFormula: 'FirstName & " " & LastName',
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('string (formula)');
        expect(result.isReference).toBe(false);
    });

    it('SB-U-006: returns "rollup" for calculated fields without formula', () => {
        const field = {
            type: 'currency',
            calculated: true,
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('currency (rollup)');
        expect(result.isReference).toBe(false);
    });

    it('SB-U-007: returns type name for regular fields', () => {
        const field = {
            type: 'string',
            calculated: false,
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('string');
        expect(result.isReference).toBe(false);
    });

    it('SB-U-016: returns reference info for reference fields (single)', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            referenceTo: ['Account'],
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (Account)');
        expect(result.isReference).toBe(true);
        expect(result.referenceTo).toEqual(['Account']);
    });

    it('SB-U-017: returns reference info for reference fields (multiple)', () => {
        const field = {
            name: 'WhoId',
            type: 'reference',
            referenceTo: ['Lead', 'Contact'],
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (Lead, Contact)');
        expect(result.isReference).toBe(true);
        expect(result.referenceTo).toEqual(['Lead', 'Contact']);
    });

    it('SB-U-018: marks OwnerId as not clickable reference', () => {
        const field = {
            name: 'OwnerId',
            type: 'reference',
            referenceTo: ['User'],
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (User)');
        expect(result.isReference).toBe(false);
        expect(result.referenceTo).toEqual(['User']);
    });

    it('SB-U-019: handles reference fields without referenceTo', () => {
        const field = {
            name: 'SomeId',
            type: 'reference',
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference');
        expect(result.isReference).toBe(false);
    });

    it('SB-U-020: handles reference fields with empty referenceTo', () => {
        const field = {
            name: 'SomeId',
            type: 'reference',
            referenceTo: [],
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference');
        expect(result.isReference).toBe(false);
    });
});
