import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Field Property Filtering in Schema Browser
 *
 * Test IDs: SB-F-006, SB-F-007, SB-F-008, SB-F-009, SB-F-010, SB-F-011, SB-F-012
 *
 * Verifies that field detail rows are conditionally rendered based on field type:
 * - Size row: only shown for string-like and numeric types
 * - Properties row: only shown when field has External ID, Unique, or Auto Number
 * - Relationship row: only shown for reference fields
 * - Universal rows: always shown (Description, Help Text, Required, Default)
 */
describe('Schema Browser - Field Property Filtering', () => {
    describe('SB-F-006: String field shows Size row, hides Relationship row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'Name',
                    label: 'Name',
                    type: 'string',
                    length: 255,
                    precision: 0,
                    scale: 0,
                    nillable: false,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: true,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            await setupMocks(router);
        });

        it('displays Size row and hides Relationship row for string fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            // Click field to expand details
            await schemaPage.clickField('Name');
            await page.waitForTimeout(300);

            // Verify field is expanded
            const isExpanded = await schemaPage.isFieldExpanded('Name');
            expect(isExpanded).toBe(true);

            // Size row should be visible
            const sizeRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Name"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Size"]'
            );
            const sizeRowVisible = await sizeRow.isVisible();
            expect(sizeRowVisible).toBe(true);
            const sizeValue = await schemaPage.getFieldDetailValue('Name', 'Size');
            expect(sizeValue).toBe('255');

            // Relationship row should NOT be visible
            const relationshipRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Name"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Relationship"]'
            );
            const relationshipRowCount = await relationshipRow.count();
            expect(relationshipRowCount).toBe(0);

            // Universal rows should be visible
            const descRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Name"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Description"]'
            );
            const descRowVisible = await descRow.isVisible();
            expect(descRowVisible).toBe(true);
        });
    });

    describe('SB-F-007: Numeric field shows Size row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'Amount__c',
                    label: 'Amount',
                    type: 'currency',
                    length: 0,
                    precision: 18,
                    scale: 2,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            await setupMocks(router);
        });

        it('displays Size row with precision and scale for currency fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('Amount__c');
            await page.waitForTimeout(300);

            // Size row should be visible with precision, scale format
            const sizeRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Amount__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Size"]'
            );
            const sizeRowVisible = await sizeRow.isVisible();
            expect(sizeRowVisible).toBe(true);
            const sizeValue = await schemaPage.getFieldDetailValue('Amount__c', 'Size');
            expect(sizeValue).toBe('18, 2');
        });
    });

    describe('SB-F-008: Boolean field hides Size row and Relationship row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'IsActive__c',
                    label: 'Is Active',
                    type: 'boolean',
                    length: 0,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            await setupMocks(router);
        });

        it('hides both Size and Relationship rows for boolean fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('IsActive__c');
            await page.waitForTimeout(300);

            // Size row should NOT be visible
            const sizeRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="IsActive__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Size"]'
            );
            const sizeRowCount = await sizeRow.count();
            expect(sizeRowCount).toBe(0);

            // Relationship row should NOT be visible
            const relationshipRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="IsActive__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Relationship"]'
            );
            const relationshipRowCount = await relationshipRow.count();
            expect(relationshipRowCount).toBe(0);

            // Universal rows should still be visible
            const descRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="IsActive__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Description"]'
            );
            const descRowVisible = await descRow.isVisible();
            expect(descRowVisible).toBe(true);
        });
    });

    describe('SB-F-009: Reference field shows Relationship row, hides Size row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            // Mock the reference field
            router.onDescribe('CustomObject__c', [
                {
                    name: 'Account__c',
                    label: 'Account',
                    type: 'reference',
                    length: 18,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: ['Account'],
                    relationshipName: 'Account__r',
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            // Mock the parent object describe for relationship resolution
            router.onDescribe(
                'Account',
                [],
                [
                    {
                        relationshipName: 'CustomObjects__r',
                        childSObject: 'CustomObject__c',
                        field: 'Account__c',
                    },
                ]
            );

            await setupMocks(router);
        });

        it('displays Relationship row and hides Size row for reference fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('Account__c');
            await page.waitForTimeout(300);

            // Relationship row should be visible
            const relationshipRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Account__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Relationship"]'
            );
            const relationshipRowVisible = await relationshipRow.isVisible();
            expect(relationshipRowVisible).toBe(true);

            // Wait for relationship to resolve
            await page.waitForTimeout(500);

            const relationshipValue = await schemaPage.getRelationshipValue('Account__c');
            expect(relationshipValue).toBe('Account.CustomObjects__r');

            // Size row should NOT be visible
            const sizeRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Account__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Size"]'
            );
            const sizeRowCount = await sizeRow.count();
            expect(sizeRowCount).toBe(0);
        });
    });

    describe('SB-F-010: Field with External ID shows Properties row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'ExternalId__c',
                    label: 'External ID',
                    type: 'string',
                    length: 100,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: true,
                    unique: true,
                    autoNumber: false,
                },
            ]);

            await setupMocks(router);
        });

        it('displays Properties row with External ID and Unique tags', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('ExternalId__c');
            await page.waitForTimeout(300);

            // Properties row should be visible
            const propertiesRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="ExternalId__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Properties"]'
            );
            const propertiesRowVisible = await propertiesRow.isVisible();
            expect(propertiesRowVisible).toBe(true);

            // Check property tags
            const tags = await schemaPage.getFieldPropertyTags('ExternalId__c');
            expect(tags).toContain('External ID');
            expect(tags).toContain('Unique');
            expect(tags).toHaveLength(2);
        });
    });

    describe('SB-F-011: Field with no special properties hides Properties row', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'Description__c',
                    label: 'Description',
                    type: 'textarea',
                    length: 1000,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            await setupMocks(router);
        });

        it('hides Properties row when field has no special properties', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('Description__c');
            await page.waitForTimeout(300);

            // Properties row should NOT be visible
            const propertiesRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Description__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Properties"]'
            );
            const propertiesRowCount = await propertiesRow.count();
            expect(propertiesRowCount).toBe(0);
        });
    });

    describe('SB-F-012: Universal rows always shown for all field types', () => {
        beforeEach(async () => {
            const router = new MockRouter();

            router.onGlobalDescribe([
                {
                    name: 'CustomObject__c',
                    label: 'Custom Object',
                    keyPrefix: 'a00',
                    queryable: true,
                },
            ]);

            router.onDescribe('CustomObject__c', [
                {
                    name: 'TextField__c',
                    label: 'Text Field',
                    type: 'string',
                    length: 80,
                    precision: 0,
                    scale: 0,
                    nillable: false,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: 'This is help text',
                    description: 'This is a description',
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                    defaultValue: 'Default Value',
                },
                {
                    name: 'BooleanField__c',
                    label: 'Boolean Field',
                    type: 'boolean',
                    length: 0,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: [],
                    relationshipName: null,
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
                {
                    name: 'Lookup__c',
                    label: 'Lookup',
                    type: 'reference',
                    length: 18,
                    precision: 0,
                    scale: 0,
                    nillable: true,
                    updateable: true,
                    createable: true,
                    calculated: false,
                    nameField: false,
                    referenceTo: ['Account'],
                    relationshipName: 'Lookup__r',
                    inlineHelpText: null,
                    description: null,
                    externalId: false,
                    unique: false,
                    autoNumber: false,
                },
            ]);

            // Mock Account describe for relationship resolution
            router.onDescribe('Account', [], []);

            await setupMocks(router);
        });

        it('always shows Description, Help Text, Required, and Default rows for string fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('TextField__c');
            await page.waitForTimeout(300);

            // Verify all universal rows are present
            const descRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="TextField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Description"]'
            );
            const descRowVisible = await descRow.isVisible();
            expect(descRowVisible).toBe(true);
            const descValue = await schemaPage.getFieldDetailValue('TextField__c', 'Description');
            expect(descValue).toBe('This is a description');

            const helpRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="TextField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Help Text"]'
            );
            const helpRowVisible = await helpRow.isVisible();
            expect(helpRowVisible).toBe(true);
            const helpValue = await schemaPage.getFieldDetailValue('TextField__c', 'Help Text');
            expect(helpValue).toBe('This is help text');

            const requiredRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="TextField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Required"]'
            );
            const requiredRowVisible = await requiredRow.isVisible();
            expect(requiredRowVisible).toBe(true);

            const defaultRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="TextField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Default"]'
            );
            const defaultRowVisible = await defaultRow.isVisible();
            expect(defaultRowVisible).toBe(true);
            const defaultValue = await schemaPage.getFieldDetailValue('TextField__c', 'Default');
            expect(defaultValue).toBe('Default Value');
        });

        it('always shows universal rows for boolean fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('BooleanField__c');
            await page.waitForTimeout(300);

            // Verify all universal rows are present
            const descRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="BooleanField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Description"]'
            );
            const descRowVisible = await descRow.isVisible();
            expect(descRowVisible).toBe(true);

            const helpRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="BooleanField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Help Text"]'
            );
            const helpRowVisible = await helpRow.isVisible();
            expect(helpRowVisible).toBe(true);

            const requiredRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="BooleanField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Required"]'
            );
            const requiredRowVisible = await requiredRow.isVisible();
            expect(requiredRowVisible).toBe(true);

            const defaultRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="BooleanField__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Default"]'
            );
            const defaultRowVisible = await defaultRow.isVisible();
            expect(defaultRowVisible).toBe(true);
        });

        it('always shows universal rows for reference fields', async () => {
            const { page } = getTestContext();
            const { schemaPage } = createPageObjects(page);

            await navigateToExtension();
            await schemaPage.navigateTo();
            await schemaPage.waitForLoad();
            await schemaPage.selectObject('CustomObject__c');

            await schemaPage.clickField('Lookup__c');
            await page.waitForTimeout(300);

            // Verify all universal rows are present
            const descRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Lookup__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Description"]'
            );
            const descRowVisible = await descRow.isVisible();
            expect(descRowVisible).toBe(true);

            const helpRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Lookup__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Help Text"]'
            );
            const helpRowVisible = await helpRow.isVisible();
            expect(helpRowVisible).toBe(true);

            const requiredRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Lookup__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Required"]'
            );
            const requiredRowVisible = await requiredRow.isVisible();
            expect(requiredRowVisible).toBe(true);

            const defaultRow = page.locator(
                '[data-testid="schema-field-detail"][data-field-name="Lookup__c"] ' +
                    '[data-testid="schema-field-detail-row"][data-detail-label="Default"]'
            );
            const defaultRowVisible = await defaultRow.isVisible();
            expect(defaultRowVisible).toBe(true);
        });
    });
});
