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
 * - SB-U-008: buildFieldSuggestions() - Creates Monaco completions
 * - SB-U-009: loadRelationshipFields() - Loads related object fields
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

    it('filters by API name', () => {
        const result = filterObjects(objects, 'Account');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Account');
    });

    it('filters by API name (partial match)', () => {
        const result = filterObjects(objects, 'custom');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Custom_Object__c');
    });

    it('filters by label', () => {
        const result = filterObjects(objects, 'Contact');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Contact');
    });

    it('filters by label (partial match)', () => {
        const result = filterObjects(objects, 'Custom');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Custom Object');
    });

    it('is case insensitive', () => {
        const result = filterObjects(objects, 'ACCOUNT');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Account');
    });

    it('returns all objects when search term is empty', () => {
        const result = filterObjects(objects, '');
        expect(result).toHaveLength(4);
    });

    it('returns all objects when search term is whitespace', () => {
        const result = filterObjects(objects, '   ');
        expect(result).toHaveLength(4);
    });

    it('returns empty array when no matches', () => {
        const result = filterObjects(objects, 'NonExistent');
        expect(result).toHaveLength(0);
    });

    it('returns multiple matches', () => {
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

    it('filters by API name', () => {
        const result = filterFields(fields, 'Name');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Name');
    });

    it('filters by API name (partial match)', () => {
        const result = filterFields(fields, 'custom');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Custom_Field__c');
    });

    it('filters by label', () => {
        const result = filterFields(fields, 'Email');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Email');
    });

    it('filters by label (partial match)', () => {
        const result = filterFields(fields, 'Account');
        expect(result).toHaveLength(1);
        expect(result[0].label).toBe('Account Name');
    });

    it('is case insensitive', () => {
        const result = filterFields(fields, 'EMAIL');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Email');
    });

    it('returns all fields when search term is empty', () => {
        const result = filterFields(fields, '');
        expect(result).toHaveLength(4);
    });

    it('returns all fields when search term is whitespace', () => {
        const result = filterFields(fields, '   ');
        expect(result).toHaveLength(4);
    });

    it('returns empty array when no matches', () => {
        const result = filterFields(fields, 'NonExistent');
        expect(result).toHaveLength(0);
    });

    it('returns multiple matches', () => {
        const result = filterFields(fields, 'e');
        expect(result.length).toBeGreaterThan(1);
    });
});

describe('getFieldTypeDisplay', () => {
    it('returns "formula" for calculated fields with formula', () => {
        const field = {
            type: 'string',
            calculated: true,
            calculatedFormula: 'FirstName & " " & LastName'
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('string (formula)');
        expect(result.isReference).toBe(false);
    });

    it('returns "rollup" for calculated fields without formula', () => {
        const field = {
            type: 'currency',
            calculated: true
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('currency (rollup)');
        expect(result.isReference).toBe(false);
    });

    it('returns type name for regular fields', () => {
        const field = {
            type: 'string',
            calculated: false
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('string');
        expect(result.isReference).toBe(false);
    });

    it('returns reference info for reference fields (single)', () => {
        const field = {
            name: 'AccountId',
            type: 'reference',
            referenceTo: ['Account']
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (Account)');
        expect(result.isReference).toBe(true);
        expect(result.referenceTo).toEqual(['Account']);
    });

    it('returns reference info for reference fields (multiple)', () => {
        const field = {
            name: 'WhoId',
            type: 'reference',
            referenceTo: ['Lead', 'Contact']
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (Lead, Contact)');
        expect(result.isReference).toBe(true);
        expect(result.referenceTo).toEqual(['Lead', 'Contact']);
    });

    it('marks OwnerId as not clickable reference', () => {
        const field = {
            name: 'OwnerId',
            type: 'reference',
            referenceTo: ['User']
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference (User)');
        expect(result.isReference).toBe(false);
        expect(result.referenceTo).toEqual(['User']);
    });

    it('handles reference fields without referenceTo', () => {
        const field = {
            name: 'SomeId',
            type: 'reference'
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference');
        expect(result.isReference).toBe(false);
    });

    it('handles reference fields with empty referenceTo', () => {
        const field = {
            name: 'SomeId',
            type: 'reference',
            referenceTo: []
        };
        const result = getFieldTypeDisplay(field);
        expect(result.text).toBe('reference');
        expect(result.isReference).toBe(false);
    });
});
