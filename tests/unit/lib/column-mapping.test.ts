import { describe, it, expect } from 'vitest';
import {
    getEligibleFields,
    autoMapColumns,
    remapColumns,
    validateMappings,
} from '../../../src/lib/column-mapping.js';
import type { FieldDescribe } from '../../../src/types/salesforce.js';

// Minimal FieldDescribe factory for tests
function makeField(name: string, label: string, opts: Partial<FieldDescribe> = {}): FieldDescribe {
    return {
        name,
        label,
        type: 'string',
        length: 255,
        precision: 0,
        scale: 0,
        nillable: true,
        updateable: false,
        createable: false,
        calculated: false,
        nameField: false,
        referenceTo: [],
        relationshipName: null,
        inlineHelpText: null,
        description: null,
        externalId: false,
        unique: false,
        autoNumber: false,
        ...opts,
    };
}

const ALL_FIELDS: FieldDescribe[] = [
    makeField('Id', 'Record ID', { createable: false, updateable: false }),
    makeField('Name', 'Account Name', { createable: true, updateable: true }),
    makeField('Email__c', 'Email', { createable: true, updateable: true }),
    makeField('CreatedDate', 'Created Date', { createable: false, updateable: false }),
    makeField('ExternalId__c', 'External ID', {
        createable: true,
        updateable: true,
        externalId: true,
    }),
];

describe('getEligibleFields', () => {
    it('insert: returns only createable fields', () => {
        const result = getEligibleFields(ALL_FIELDS, 'insert');
        const names = result.map(f => f.name);

        expect(names).toContain('Name');
        expect(names).toContain('Email__c');
        expect(names).toContain('ExternalId__c');
        expect(names).not.toContain('Id');
        expect(names).not.toContain('CreatedDate');
    });

    it('update: returns updateable fields and Id', () => {
        const result = getEligibleFields(ALL_FIELDS, 'update');
        const names = result.map(f => f.name);

        expect(names).toContain('Id');
        expect(names).toContain('Name');
        expect(names).toContain('Email__c');
        expect(names).not.toContain('CreatedDate');
    });

    it('upsert: returns createable || updateable + externalIdField unconditionally', () => {
        // Add a non-createable/updateable field that is the externalId target
        const readOnlyExtId = makeField('ReadOnlyExt__c', 'Read Only Ext', {
            createable: false,
            updateable: false,
            externalId: true,
        });
        const fields = [...ALL_FIELDS, readOnlyExtId];

        const result = getEligibleFields(fields, 'upsert', 'ReadOnlyExt__c');
        const names = result.map(f => f.name);

        expect(names).toContain('ReadOnlyExt__c'); // included even though not createable/updateable
        expect(names).toContain('Name');
        expect(names).toContain('ExternalId__c');
    });

    it('upsert: includes externalIdField even if not createable or updateable', () => {
        const specialField = makeField('SF_ID__c', 'Special ID', {
            createable: false,
            updateable: false,
            externalId: false,
        });
        const fields = [...ALL_FIELDS, specialField];
        const result = getEligibleFields(fields, 'upsert', 'SF_ID__c');

        expect(result.map(f => f.name)).toContain('SF_ID__c');
    });

    it('delete: returns only Id', () => {
        const result = getEligibleFields(ALL_FIELDS, 'delete');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Id');
    });
});

describe('autoMapColumns', () => {
    it('maps CSV header matching API name (case-insensitive)', () => {
        const mappings = autoMapColumns(['NAME', 'email__c'], ALL_FIELDS);

        const nameMapped = mappings.find(m => m.csvHeader === 'NAME');
        expect(nameMapped?.fieldApiName).toBe('Name');
        expect(nameMapped?.mappingSource).toBe('api-name');
        expect(nameMapped?.included).toBe(true);
    });

    it('maps CSV header matching label (case-insensitive)', () => {
        const mappings = autoMapColumns(['account name'], ALL_FIELDS);

        const m = mappings[0];
        expect(m.fieldApiName).toBe('Name');
        expect(m.mappingSource).toBe('label');
        expect(m.included).toBe(true);
    });

    it('API name match takes priority over label match', () => {
        // Create a field where label equals the API name of another field
        const fields = [
            makeField('Email', 'Name', { createable: true }),
            makeField('Name', 'Account Name', { createable: true }),
        ];
        const mappings = autoMapColumns(['Name'], fields);

        // Should match API name 'Name', not label 'Name' (which is Email's label)
        expect(mappings[0].fieldApiName).toBe('Name');
        expect(mappings[0].mappingSource).toBe('api-name');
    });

    it('returns null fieldApiName for unmatched header', () => {
        const mappings = autoMapColumns(['UnknownColumn'], ALL_FIELDS);

        const m = mappings[0];
        expect(m.fieldApiName).toBeNull();
        expect(m.included).toBe(false);
        expect(m.mappingSource).toBe('none');
    });

    it('preserves correct csvIndex for each header', () => {
        const mappings = autoMapColumns(['Id', 'Name', 'UnknownCol'], ALL_FIELDS);

        expect(mappings[0].csvIndex).toBe(0);
        expect(mappings[1].csvIndex).toBe(1);
        expect(mappings[2].csvIndex).toBe(2);
    });

    it('uses Map-based O(1) lookup — all headers mapped correctly with large field list', () => {
        // Build 200 fields, map the last one
        const fields = Array.from({ length: 200 }, (_, i) =>
            makeField(`Field_${i}__c`, `Field ${i}`, { createable: true })
        );
        const mappings = autoMapColumns(['Field_199__c'], fields);
        expect(mappings[0].fieldApiName).toBe('Field_199__c');
    });
});

describe('remapColumns', () => {
    const ELIGIBLE_FIELDS: FieldDescribe[] = [
        makeField('Id', 'Record ID', { createable: false, updateable: true }),
        makeField('Name', 'Account Name', { createable: true, updateable: true }),
        makeField('Email__c', 'Email', { createable: true, updateable: true }),
        makeField('Phone__c', 'Phone', { createable: true, updateable: true }),
    ];

    const makePrevMapping = (
        csvHeader: string,
        csvIndex: number,
        fieldApiName: string | null,
        opts: Partial<import('../../../src/types/salesforce.js').ColumnMapping> = {}
    ): import('../../../src/types/salesforce.js').ColumnMapping => ({
        csvHeader,
        csvIndex,
        fieldApiName,
        included: fieldApiName !== null,
        mappingSource: fieldApiName ? 'manual' : 'none',
        ...opts,
    });

    it('preserves previous mapping when header name matches (case-insensitive)', () => {
        const previous = [
            makePrevMapping('name', 0, 'Name', { included: true, mappingSource: 'manual' }),
            makePrevMapping('Email__c', 1, 'Email__c', {
                included: false,
                mappingSource: 'api-name',
            }),
        ];

        // New CSV has headers with different casing
        const result = remapColumns(['NAME', 'email__c'], ELIGIBLE_FIELDS, previous);

        expect(result[0].fieldApiName).toBe('Name');
        expect(result[0].mappingSource).toBe('manual');
        expect(result[0].csvHeader).toBe('NAME');
        expect(result[0].csvIndex).toBe(0);

        expect(result[1].fieldApiName).toBe('Email__c');
        expect(result[1].included).toBe(false); // preserved excluded state
        expect(result[1].mappingSource).toBe('api-name');
    });

    it('falls back to auto-mapping for new headers not in previous mappings', () => {
        const previous = [makePrevMapping('Name', 0, 'Name')];

        const result = remapColumns(['Name', 'Phone__c', 'Unknown'], ELIGIBLE_FIELDS, previous);

        // Name preserved from previous
        expect(result[0].fieldApiName).toBe('Name');
        // Phone__c auto-mapped by API name
        expect(result[1].fieldApiName).toBe('Phone__c');
        expect(result[1].mappingSource).toBe('api-name');
        // Unknown gets no mapping
        expect(result[2].fieldApiName).toBeNull();
        expect(result[2].mappingSource).toBe('none');
    });

    it('drops previous mapping if the field is no longer eligible', () => {
        const previous = [
            makePrevMapping('Name', 0, 'Name'),
            makePrevMapping('Removed__c', 1, 'Removed__c', { mappingSource: 'manual' }),
        ];

        // Removed__c is not in ELIGIBLE_FIELDS
        const result = remapColumns(['Name', 'Removed__c'], ELIGIBLE_FIELDS, previous);

        expect(result[0].fieldApiName).toBe('Name');
        // Removed__c field not eligible — falls back to auto-map (no match)
        expect(result[1].fieldApiName).toBeNull();
        expect(result[1].mappingSource).toBe('none');
    });

    it('handles empty previous mappings (equivalent to autoMapColumns)', () => {
        const result = remapColumns(['Name', 'Email__c', 'Unknown'], ELIGIBLE_FIELDS, []);
        const autoResult = autoMapColumns(['Name', 'Email__c', 'Unknown'], ELIGIBLE_FIELDS);

        expect(result).toEqual(autoResult);
    });

    it('assigns correct csvIndex based on new header positions', () => {
        const previous = [
            makePrevMapping('Email__c', 0, 'Email__c'),
            makePrevMapping('Name', 1, 'Name'),
        ];

        // Reversed order in new CSV
        const result = remapColumns(['Name', 'Email__c'], ELIGIBLE_FIELDS, previous);

        expect(result[0].csvHeader).toBe('Name');
        expect(result[0].csvIndex).toBe(0);
        expect(result[1].csvHeader).toBe('Email__c');
        expect(result[1].csvIndex).toBe(1);
    });

    it('auto-maps by label when header matches label but not API name', () => {
        const previous = [makePrevMapping('Id', 0, 'Id')];

        const result = remapColumns(['Id', 'Account Name'], ELIGIBLE_FIELDS, previous);

        expect(result[0].fieldApiName).toBe('Id');
        // "Account Name" matches label of Name field
        expect(result[1].fieldApiName).toBe('Name');
        expect(result[1].mappingSource).toBe('label');
    });
});

describe('validateMappings', () => {
    const makeMappings = (
        overrides: Partial<import('../../../src/types/salesforce.js').ColumnMapping>[] = []
    ) =>
        overrides.map((o, i) => ({
            csvHeader: `col${i}`,
            csvIndex: i,
            fieldApiName: null,
            included: true,
            mappingSource: 'manual' as const,
            ...o,
        }));

    it('insert: valid when at least one column mapped', () => {
        const mappings = makeMappings([{ fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'insert');

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('insert: invalid when no columns mapped', () => {
        const mappings = makeMappings([{ fieldApiName: null, included: false }]);
        const result = validateMappings(mappings, 'insert');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('update: invalid when Id not mapped', () => {
        const mappings = makeMappings([{ fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'update');

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Id'))).toBe(true);
    });

    it('update: valid when Id is mapped', () => {
        const mappings = makeMappings([{ fieldApiName: 'Id' }, { fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'update');

        expect(result.valid).toBe(true);
    });

    it('upsert: invalid when no externalIdFieldName provided', () => {
        const mappings = makeMappings([{ fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'upsert', undefined);

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.toLowerCase().includes('external'))).toBe(true);
    });

    it('upsert: invalid when externalIdField not in mappings', () => {
        const mappings = makeMappings([{ fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'upsert', 'ExternalId__c');

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('ExternalId__c'))).toBe(true);
    });

    it('upsert: valid when externalIdField is mapped', () => {
        const mappings = makeMappings([
            { fieldApiName: 'Name' },
            { fieldApiName: 'ExternalId__c' },
        ]);
        const result = validateMappings(mappings, 'upsert', 'ExternalId__c');

        expect(result.valid).toBe(true);
    });

    it('delete: invalid when Id not mapped', () => {
        const mappings = makeMappings([{ fieldApiName: 'Name' }]);
        const result = validateMappings(mappings, 'delete');

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Id'))).toBe(true);
    });

    it('delete: valid when Id is mapped', () => {
        const mappings = makeMappings([{ fieldApiName: 'Id' }]);
        const result = validateMappings(mappings, 'delete');

        expect(result.valid).toBe(true);
    });

    it('detects duplicate field assignments', () => {
        const mappings = makeMappings([
            { csvIndex: 0, fieldApiName: 'Name' },
            { csvIndex: 1, fieldApiName: 'Name' },
        ]);
        const result = validateMappings(mappings, 'insert');

        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('Name'))).toBe(true);
    });
});
