import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Record Viewer field type rendering and editability
 *
 * Test IDs: RV-F-004, RV-F-006
 * - RV-F-004: Display API name - Developer name shown
 * - RV-F-006: Display field value - Current value displayed
 */
export default class RecordFieldTypesTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to record viewer
        await this.navigateToRecord('Account', '001MOCKACCOUNT01');

        // Wait for record to load
        await this.recordPage.waitForLoad();

        // Verify Name field is editable
        const nameEditable = await this.recordPage.isFieldEditable('Name');
        await this.expect(nameEditable).toBe(true);

        // Verify Id field is NOT editable (system field)
        const idEditable = await this.recordPage.isFieldEditable('Id');
        await this.expect(idEditable).toBe(false);

        // Verify field values display correctly
        const nameValue = await this.recordPage.getFieldValue('Name');
        await this.expect(nameValue).toBe('Test Account');

        // Verify Id value is the record ID
        const idValue = await this.recordPage.getFieldValue('Id');
        await this.expect(idValue).toBe('001MOCKACCOUNT01');
    }
}
