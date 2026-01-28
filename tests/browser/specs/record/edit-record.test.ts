import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToRecord,
    MockRouter,
} from '../../test-utils';

/**
 * Test Record Viewer edit and save functionality
 *
 * Test IDs: RV-F-007, RV-F-015, RV-F-019
 * - RV-F-007: Edit text field - Input accepts text
 * - RV-F-015: Save modified fields - PATCH request, success
 * - RV-F-019: Modified fields highlighted - Visual distinction
 */
describe('EditRecordTest', () => {
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

        // Mock record update (PATCH)
        router.onUpdateRecord('Account', '001MOCKACCOUNT01');

        await setupMocks(router);
    });

    it('edits and saves record fields', async () => {
        const { page } = getTestContext();
        const { recordPage } = createPageObjects(page);

        // Navigate to record viewer
        await navigateToRecord('Account', '001MOCKACCOUNT01');
        await recordPage.waitForLoad();

        // Verify original name is displayed
        const initialValue = await recordPage.getFieldValue('Name');
        expect(initialValue).toBe('Original Name');

        // Edit the name field
        const newName = 'Updated Name';
        await recordPage.setFieldValue('Name', newName);

        // Verify field is marked as modified
        const isModified = await recordPage.isFieldModified('Name');
        expect(isModified).toBe(true);

        // Verify save button is enabled
        const saveEnabled = await recordPage.isSaveEnabled();
        expect(saveEnabled).toBe(true);

        // Save changes
        await recordPage.save();

        // Verify status shows saved
        const status = await recordPage.getStatus();
        expect(status).toContain('Saved');
    });
});
