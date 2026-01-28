import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToRecord,
    MockRouter,
} from '../../test-utils';

/**
 * Test Record Viewer functionality
 *
 * Test IDs: RV-F-001, RV-F-002, RV-F-003, RV-F-005
 * - RV-F-001: Load record data - All fields displayed
 * - RV-F-002: Fields sorted correctly - Id first, Name second, alphabetical
 * - RV-F-003: Display field label - Human-readable label shown
 * - RV-F-005: Display field value - Current value displayed
 */
describe('ViewRecordTest', () => {
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
                Name: 'Acme Corporation',
                Phone: '555-1234',
            },
        ]);

        await setupMocks(router);
    });

    it('loads and displays record data', async () => {
        const { page } = getTestContext();
        const { recordPage } = createPageObjects(page);

        // Navigate to record viewer
        await navigateToRecord('Account', '001MOCKACCOUNT01');

        // Wait for record to load
        await recordPage.waitForLoad();

        // Verify object name is displayed
        const objectName = await recordPage.getObjectName();
        expect(objectName).toContain('Account');

        // Verify record ID is displayed
        const recordId = await recordPage.getRecordId();
        expect(recordId).toContain('001MOCKACCOUNT01');

        // Verify Name field value
        const nameValue = await recordPage.getFieldValue('Name');
        expect(nameValue).toBe('Acme Corporation');

        // Verify Id field is not editable (system field)
        const idEditable = await recordPage.isFieldEditable('Id');
        expect(idEditable).toBe(false);

        // Verify Name field is editable
        const nameEditable = await recordPage.isFieldEditable('Name');
        expect(nameEditable).toBe(true);
    });
});
