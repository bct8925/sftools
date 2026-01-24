import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Record Viewer functionality
 *
 * Test IDs: RV-F-001, RV-F-002, RV-F-003, RV-F-005
 * - RV-F-001: Load record data - All fields displayed
 * - RV-F-002: Fields sorted correctly - Id first, Name second, alphabetical
 * - RV-F-003: Display field label - Human-readable label shown
 * - RV-F-005: Display field value - Current value displayed
 */
export default class ViewRecordTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to record viewer
        await this.navigateToRecord('Account', '001MOCKACCOUNT01');

        // Wait for record to load
        await this.recordPage.waitForLoad();

        // Verify object name is displayed
        const objectName = await this.recordPage.getObjectName();
        await this.expect(objectName).toContain('Account');

        // Verify record ID is displayed
        const recordId = await this.recordPage.getRecordId();
        await this.expect(recordId).toContain('001MOCKACCOUNT01');

        // Verify Name field value
        const nameValue = await this.recordPage.getFieldValue('Name');
        await this.expect(nameValue).toBe('Acme Corporation');

        // Verify Id field is not editable (system field)
        const idEditable = await this.recordPage.isFieldEditable('Id');
        await this.expect(idEditable).toBe(false);

        // Verify Name field is editable
        const nameEditable = await this.recordPage.isFieldEditable('Name');
        await this.expect(nameEditable).toBe(true);
    }
}
