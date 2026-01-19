import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Record Viewer functionality
 */
export default class ViewRecordTest extends SftoolsTest {
  private testAccountId: string = '';
  private testAccountName: string = '';

  async setup(): Promise<void> {
    // Create a test account
    this.testAccountName = `Playwright Record Test ${Date.now()}`;
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

    // Verify object name is displayed
    const objectName = await this.recordPage.getObjectName();
    await this.expect(objectName).toContain('Account');

    // Verify record ID is displayed
    const recordId = await this.recordPage.getRecordId();
    await this.expect(recordId).toContain(this.testAccountId);

    // Verify Name field value
    const nameValue = await this.recordPage.getFieldValue('Name');
    await this.expect(nameValue).toBe(this.testAccountName);

    // Verify Id field is not editable (system field)
    const idEditable = await this.recordPage.isFieldEditable('Id');
    await this.expect(idEditable).toBe(false);

    // Verify Name field is editable
    const nameEditable = await this.recordPage.isFieldEditable('Name');
    await this.expect(nameEditable).toBe(true);
  }
}
