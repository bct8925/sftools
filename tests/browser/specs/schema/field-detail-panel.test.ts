import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToSchema,
    MockRouter,
} from '../../test-utils';

/**
 * Test Field Detail Panel in Schema Browser
 *
 * Test IDs: SB-F-007, SB-F-008, SB-F-009, SB-F-010
 * - SB-F-007: Field detail expansion/collapse
 * - SB-F-008: Field metadata values display
 * - SB-F-009: Picklist values display
 * - SB-F-010: Relationship resolution
 */
describe('Schema Browser - Field Detail Panel', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        router.onGlobalDescribe([
            { name: 'Account', label: 'Account', keyPrefix: '001', queryable: true },
            { name: 'Contact', label: 'Contact', keyPrefix: '003', queryable: true },
        ]);

        router.onDescribe('Contact', [
            {
                name: 'Id',
                label: 'Record ID',
                type: 'id',
                updateable: false,
                nillable: false,
                createable: false,
                description: null,
                inlineHelpText: null,
                externalId: false,
                unique: false,
                autoNumber: false,
            },
            {
                name: 'FirstName',
                label: 'First Name',
                type: 'string',
                length: 40,
                nillable: true,
                createable: true,
                description: 'The first name',
                inlineHelpText: 'Enter first name',
                defaultValue: null,
                externalId: false,
                unique: false,
                autoNumber: false,
            },
            {
                name: 'AccountId',
                label: 'Account',
                type: 'reference',
                referenceTo: ['Account'],
                relationshipName: 'Account',
                nillable: true,
                createable: true,
                description: null,
                inlineHelpText: null,
                externalId: false,
                unique: false,
                autoNumber: false,
            },
            {
                name: 'Email',
                label: 'Email',
                type: 'email',
                length: 80,
                nillable: false,
                createable: true,
                description: 'Primary email',
                inlineHelpText: null,
                defaultValue: null,
                externalId: true,
                unique: true,
                autoNumber: false,
            },
            {
                name: 'LeadSource',
                label: 'Lead Source',
                type: 'picklist',
                nillable: true,
                createable: true,
                picklistValues: [
                    { value: 'Web', label: 'Web', active: true },
                    { value: 'Phone', label: 'Phone Inquiry', active: true },
                    { value: 'Fax', label: 'Fax', active: false },
                ],
                description: null,
                inlineHelpText: null,
                externalId: false,
                unique: false,
                autoNumber: false,
            },
            {
                name: 'AnnualRevenue',
                label: 'Annual Revenue',
                type: 'currency',
                precision: 18,
                scale: 2,
                nillable: true,
                createable: true,
                description: null,
                inlineHelpText: null,
                externalId: false,
                unique: false,
                autoNumber: false,
            },
        ]);

        router.onDescribe(
            'Account',
            [
                { name: 'Id', label: 'Record ID', type: 'id' },
                { name: 'Name', label: 'Account Name', type: 'string' },
            ],
            [{ childSObject: 'Contact', field: 'AccountId', relationshipName: 'Contacts' }]
        );

        await setupMocks(router);
    });

    it('SB-F-007: expands and collapses field detail panel', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();
        await schemaPage.selectObject('Contact');

        // Click field to expand
        await schemaPage.clickField('FirstName');
        expect(await schemaPage.isFieldExpanded('FirstName')).toBe(true);

        // Click same field to collapse
        await schemaPage.clickField('FirstName');
        expect(await schemaPage.isFieldExpanded('FirstName')).toBe(false);

        // Click one field, then another — first collapses
        await schemaPage.clickField('FirstName');
        expect(await schemaPage.isFieldExpanded('FirstName')).toBe(true);

        await schemaPage.clickField('Email');
        expect(await schemaPage.isFieldExpanded('Email')).toBe(true);
        expect(await schemaPage.isFieldExpanded('FirstName')).toBe(false);
    });

    it('SB-F-008: displays field metadata values', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();
        await schemaPage.selectObject('Contact');

        // String field with description and help text
        await schemaPage.clickField('FirstName');
        expect(await schemaPage.getFieldDetailValue('FirstName', 'Description')).toBe(
            'The first name'
        );
        expect(await schemaPage.getFieldDetailValue('FirstName', 'Help Text')).toBe(
            'Enter first name'
        );
        expect(await schemaPage.getFieldDetailValue('FirstName', 'Size')).toBe('40');

        // Required field with properties
        await schemaPage.clickField('Email');
        expect(await schemaPage.getFieldDetailValue('Email', 'Required')).toBe('Yes');
        expect(await schemaPage.getFieldDetailValue('Email', 'Description')).toBe('Primary email');

        const tags = await schemaPage.getFieldPropertyTags('Email');
        expect(tags).toContain('External ID');
        expect(tags).toContain('Unique');

        // Currency field shows precision/scale
        await schemaPage.clickField('AnnualRevenue');
        expect(await schemaPage.getFieldDetailValue('AnnualRevenue', 'Size')).toBe('18, 2');
    });

    it('SB-F-009: displays picklist values', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();
        await schemaPage.selectObject('Contact');

        await schemaPage.clickField('LeadSource');
        const values = await schemaPage.getPicklistValues('LeadSource');

        expect(values).toHaveLength(3);
        expect(values[0]).toEqual({ label: 'Web', active: true });
        expect(values[1]).toEqual({ label: 'Phone Inquiry', active: true });
        expect(values[2]).toEqual({ label: 'Fax', active: false });
    });

    it('SB-F-010: resolves relationship name for reference fields', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        await navigateToSchema();
        await schemaPage.waitForLoad();
        await schemaPage.selectObject('Contact');

        // Expand reference field — triggers describe on Account
        await schemaPage.clickField('AccountId');

        // Wait for relationship resolution (async API call)
        await page.waitForFunction(
            () => {
                const detail = document.querySelector(
                    '[data-testid="schema-field-detail"][data-field-name="AccountId"]'
                );
                const relRow = detail?.querySelector('[data-detail-label="Relationship"]');
                const value = relRow?.querySelector('span:last-child');
                return value && value.textContent !== '…';
            },
            { timeout: 10000 }
        );

        const relationship = await schemaPage.getRelationshipValue('AccountId');
        expect(relationship).toBe('Account.Contacts');

        // Non-reference field has no relationship
        await schemaPage.clickField('FirstName');
        const noRel = await schemaPage.getFieldDetailValue('FirstName', 'Relationship');
        expect(noRel).toBe('—');
    });
});
