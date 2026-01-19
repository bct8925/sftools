import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Record Viewer edit and save functionality
 *
 * Test IDs: RV-F-007, RV-F-015, RV-F-019
 * - RV-F-007: Edit text field - Input accepts text
 * - RV-F-015: Save modified fields - PATCH request, success
 * - RV-F-019: Modified fields highlighted - Visual distinction
 */
export default class EditRecordTest extends SftoolsTest {
  private testAccountId: string = '';
  private originalName: string = '';

  async setup(): Promise<void> {
    // Create a test account with a known name
    this.originalName = `Playwright Edit Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(this.originalName);
  }

  async teardown(): Promise<void> {
    // Clean up test account
    if (this.testAccountId) {
      await this.salesforce.deleteRecord('Account', this.testAccountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to record viewer
    await this.navigateToRecord('Account', this.testAccountId);
    await this.recordPage.waitForLoad();

    // Verify original name is displayed
    const initialValue = await this.recordPage.getFieldValue('Name');
    await this.expect(initialValue).toBe(this.originalName);

    // Edit the name field
    const newName = `Updated ${Date.now()}`;
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

    // Verify the change persisted in Salesforce
    const records = await this.salesforce.query(
      `SELECT Name FROM Account WHERE Id = '${this.testAccountId}'`
    );
    await this.expect(records[0].Name).toBe(newName);
  }
}
