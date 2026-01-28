import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToRecord,
    MockRouter,
} from '../../test-utils';

/**
 * Test Record Viewer refresh functionality
 *
 * Test IDs: RV-F-016
 * - RV-F-016: Refresh record - Data reloaded
 */
describe('RecordRefreshTest', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock describe for Account object
        router.onDescribe('Account', [
            { name: 'Id', label: 'Record ID', type: 'id', updateable: false },
            { name: 'Name', label: 'Account Name', type: 'string', updateable: true },
            { name: 'Phone', label: 'Phone', type: 'phone', updateable: true },
        ]);

        // Mock SOQL query for record retrieval (used by getRecordWithRelationships)
        // Pattern matches URL-encoded SOQL: "FROM%20Account%20WHERE%20Id"
        router.onQuery(/\/query\/?\?q=.*FROM%20Account%20WHERE%20Id/, [
            {
                attributes: { type: 'Account' },
                Id: '001MOCKACCOUNT01',
                Name: 'Original Name',
                Phone: '555-1234',
            },
        ]);

        await setupMocks(router);
    });

    it('refreshes record and reverts unsaved changes', async () => {
        const { page } = getTestContext();
        const { recordPage } = createPageObjects(page);

        // Navigate to record viewer
        await navigateToRecord('Account', '001MOCKACCOUNT01');

        // Wait for record to load
        await recordPage.waitForLoad();

        // Get original name value
        const initialValue = await recordPage.getFieldValue('Name');
        expect(initialValue).toBe('Original Name');

        // Set field value to a different name
        const modifiedName = 'Modified Name';
        await recordPage.setFieldValue('Name', modifiedName);

        // Verify field value changed in UI
        const modifiedValue = await recordPage.getFieldValue('Name');
        expect(modifiedValue).toBe(modifiedName);

        // Verify field is marked as modified
        const isModified = await recordPage.isFieldModified('Name');
        expect(isModified).toBe(true);

        // Click refresh
        await recordPage.refresh();

        // Wait for load after refresh
        await recordPage.waitForLoad();

        // Verify name field reverted to original value
        const revertedValue = await recordPage.getFieldValue('Name');
        expect(revertedValue).toBe('Original Name');

        // Verify field is no longer modified
        const isStillModified = await recordPage.isFieldModified('Name');
        expect(isStillModified).toBe(false);
    });
});
