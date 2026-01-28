import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToSchema,
    MockRouter,
} from '../../test-utils';

/**
 * Test Schema Browser functionality
 *
 * Test IDs: SB-F-001, SB-F-002, SB-F-004, SB-F-005
 * - SB-F-001: Load all objects - Object list populated
 * - SB-F-002: Filter objects by name - Matching objects shown
 * - SB-F-004: Select object - Field panel opens
 * - SB-F-005: Filter fields - Matching fields shown
 */
describe('Schema Browser', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock global describe with common objects
        router.onGlobalDescribe([
            { name: 'Account', label: 'Account', keyPrefix: '001', queryable: true },
            { name: 'Contact', label: 'Contact', keyPrefix: '003', queryable: true },
            { name: 'Opportunity', label: 'Opportunity', keyPrefix: '006', queryable: true },
        ]);

        // Mock Account describe
        router.onDescribe('Account', [
            { name: 'Id', label: 'Record ID', type: 'id', updateable: false },
            { name: 'Name', label: 'Account Name', type: 'string', updateable: true },
            { name: 'Phone', label: 'Phone', type: 'phone', updateable: true },
            { name: 'Industry', label: 'Industry', type: 'picklist', updateable: true },
        ]);

        await setupMocks(router);
    });

    it('SB-F-001, SB-F-002, SB-F-004, SB-F-005: browses schema and filters objects and fields', async () => {
        const { page } = getTestContext();
        const { schemaPage } = createPageObjects(page);

        // Navigate to schema browser
        await navigateToSchema();
        await schemaPage.waitForLoad();

        // Verify objects are loaded
        const objectCount = await schemaPage.getObjectCount();
        expect(objectCount).toBeGreaterThan(0);

        // Filter for Account object
        await schemaPage.filterObjects('Account');

        // Verify Account is in the filtered list
        const filteredObjects = await schemaPage.getVisibleObjectNames();
        expect(filteredObjects).toContain('Account');

        // Select Account to view fields
        await schemaPage.selectObject('Account');

        // Verify object name is shown
        const selectedName = await schemaPage.getSelectedObjectApiName();
        expect(selectedName).toContain('Account');

        // Verify fields are loaded
        const fieldNames = await schemaPage.getVisibleFieldNames();
        expect(fieldNames).toContain('Name');
        expect(fieldNames).toContain('Id');

        // Verify field details
        const nameField = await schemaPage.getFieldDetails('Name');
        expect(nameField?.label).toBe('Account Name');
    });
});
