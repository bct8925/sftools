import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Record Viewer refresh functionality
 *
 * Test IDs: RV-F-016
 * - RV-F-016: Refresh record - Data reloaded
 */
export default class RecordRefreshTest extends SftoolsTest {
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
                Name: 'Original Name',
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

        // Get original name value
        const initialValue = await this.recordPage.getFieldValue('Name');
        await this.expect(initialValue).toBe('Original Name');

        // Set field value to a different name
        const modifiedName = 'Modified Name';
        await this.recordPage.setFieldValue('Name', modifiedName);

        // Verify field value changed in UI
        const modifiedValue = await this.recordPage.getFieldValue('Name');
        await this.expect(modifiedValue).toBe(modifiedName);

        // Verify field is marked as modified
        const isModified = await this.recordPage.isFieldModified('Name');
        await this.expect(isModified).toBe(true);

        // Click refresh
        await this.recordPage.refresh();

        // Wait for load after refresh
        await this.recordPage.waitForLoad();

        // Verify name field reverted to original value
        const revertedValue = await this.recordPage.getFieldValue('Name');
        await this.expect(revertedValue).toBe('Original Name');

        // Verify field is no longer modified
        const isStillModified = await this.recordPage.isFieldModified('Name');
        await this.expect(isStillModified).toBe(false);
    }
}
