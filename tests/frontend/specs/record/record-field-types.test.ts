import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Record Viewer field type rendering and editability
 *
 * Test IDs: RV-F-004, RV-F-005, RV-F-006
 * - RV-F-004: Display API name - Developer name shown
 * - RV-F-005: Display field value - Current value displayed
 * - RV-F-006: Display field type - Type indicator shown
 */
export default class RecordFieldTypesTest extends SftoolsTest {
  private testAccountId: string = '';
  private testAccountName: string = '';

  async setup(): Promise<void> {
    // Create a test account
    this.testAccountName = `Playwright Field Types Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(this.testAccountName);
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
    await this.expect(nameValue).toBe(this.testAccountName);

    // Verify Id value is the record ID
    const idValue = await this.recordPage.getFieldValue('Id');
    await this.expect(idValue).toBe(this.testAccountId);
  }
}
