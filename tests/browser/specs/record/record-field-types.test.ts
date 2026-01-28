import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToRecord,
    MockRouter,
} from '../../test-utils';

/**
 * Test Record Viewer field type rendering and editability
 *
 * Test IDs: RV-F-004, RV-F-006
 * - RV-F-004: Display API name - Developer name shown
 * - RV-F-006: Display field value - Current value displayed
 */
describe('RecordFieldTypesTest', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock describe for Account object
        router.onDescribe('Account', [
            { name: 'Id', label: 'Record ID', type: 'id', updateable: false },
            { name: 'Name', label: 'Account Name', type: 'string', updateable: true },
            { name: 'Phone', label: 'Phone', type: 'phone', updateable: true },
            { name: 'CreatedDate', label: 'Created Date', type: 'datetime', updateable: false },
        ]);

        // Mock SOQL query for record retrieval (used by getRecordWithRelationships)
        // Pattern matches URL-encoded SOQL: "FROM%20Account%20WHERE%20Id"
        router.onQuery(/\/query\/?\?q=.*FROM%20Account%20WHERE%20Id/, [
            {
                attributes: { type: 'Account' },
                Id: '001MOCKACCOUNT01',
                Name: 'Test Account',
                Phone: '555-9999',
                CreatedDate: '2024-01-15T10:30:00.000+0000',
            },
        ]);

        await setupMocks(router);
    });

    it('displays field types with correct editability', async () => {
        const { page } = getTestContext();
        const { recordPage } = createPageObjects(page);

        // Navigate to record viewer
        await navigateToRecord('Account', '001MOCKACCOUNT01');

        // Wait for record to load
        await recordPage.waitForLoad();

        // Verify Name field is editable
        const nameEditable = await recordPage.isFieldEditable('Name');
        expect(nameEditable).toBe(true);

        // Verify Id field is NOT editable (system field)
        const idEditable = await recordPage.isFieldEditable('Id');
        expect(idEditable).toBe(false);

        // Verify field values display correctly
        const nameValue = await recordPage.getFieldValue('Name');
        expect(nameValue).toBe('Test Account');

        // Verify Id value is the record ID
        const idValue = await recordPage.getFieldValue('Id');
        expect(idValue).toBe('001MOCKACCOUNT01');
    });
});
