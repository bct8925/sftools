import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Record Viewer edit and save functionality
 *
 * Test IDs: RV-F-007, RV-F-015, RV-F-019
 * - RV-F-007: Edit text field - Input accepts text
 * - RV-F-015: Save modified fields - PATCH request, success
 * - RV-F-019: Modified fields highlighted - Visual distinction
 */
export default class EditRecordTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock describe for Account object
    router.onDescribe('Account', [
      { name: 'Id', label: 'Record ID', type: 'id', updateable: false },
      { name: 'Name', label: 'Account Name', type: 'string', updateable: true },
      { name: 'Phone', label: 'Phone', type: 'phone', updateable: true }
    ]);

    // Mock SOQL query for record retrieval (used by getRecordWithRelationships)
    // Pattern matches URL-encoded SOQL: "FROM%20Account%20WHERE%20Id"
    router.onQuery(
      /\/query\/?\?q=.*FROM%20Account%20WHERE%20Id/,
      [{
        attributes: { type: 'Account' },
        Id: '001MOCKACCOUNT01',
        Name: 'Original Name',
        Phone: '555-1234'
      }]
    );

    // Mock record update (PATCH)
    router.onUpdateRecord('Account', '001MOCKACCOUNT01');

    return router;
  }

  async test(): Promise<void> {
    // Navigate to record viewer
    await this.navigateToRecord('Account', '001MOCKACCOUNT01');
    await this.recordPage.waitForLoad();

    // Verify original name is displayed
    const initialValue = await this.recordPage.getFieldValue('Name');
    await this.expect(initialValue).toBe('Original Name');

    // Edit the name field
    const newName = 'Updated Name';
    await this.recordPage.setFieldValue('Name', newName);

    // Verify field is marked as modified
    const isModified = await this.recordPage.isFieldModified('Name');
    await this.expect(isModified).toBe(true);

    // Verify save button is enabled
    const saveEnabled = await this.recordPage.isSaveEnabled();
    await this.expect(saveEnabled).toBe(true);

    // Save changes
    await this.recordPage.save();

    // Verify status shows saved
    const status = await this.recordPage.getStatus();
    await this.expect(status).toContain('Saved');
  }
}
