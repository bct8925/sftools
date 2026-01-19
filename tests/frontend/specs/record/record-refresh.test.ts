import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Record Viewer refresh functionality
 *
 * Test IDs: RV-F-016
 * - RV-F-016: Refresh record - Data reloaded
 */
export default class RecordRefreshTest extends SftoolsTest {
  private testAccountId: string = '';
  private originalName: string = '';

  async setup(): Promise<void> {
    // Create a test account with a specific name
    this.originalName = `Playwright Refresh Test ${Date.now()}`;
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

    // Wait for record to load
    await this.recordPage.waitForLoad();

    // Get original name value
    const initialValue = await this.recordPage.getFieldValue('Name');
    await this.expect(initialValue).toBe(this.originalName);

    // Set field value to a different name
    const modifiedName = `Modified ${Date.now()}`;
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
    await this.expect(revertedValue).toBe(this.originalName);

    // Verify field is no longer modified
    const isStillModified = await this.recordPage.isFieldModified('Name');
    await this.expect(isStillModified).toBe(false);
  }
}
