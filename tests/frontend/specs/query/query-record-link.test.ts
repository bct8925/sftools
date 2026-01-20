import { SftoolsTest } from '../../framework/base-test';

/**
 * Test clicking record ID to open Record Viewer
 *
 * Test ID: Q-F-015
 * - Creates test Account
 * - Executes query that returns the account
 * - Clicks Id field in results
 * - Verifies Record Viewer opens with correct record
 */
export default class QueryRecordLinkTest extends SftoolsTest {
  private testAccountId: string = '';
  private testAccountName: string = '';

  async setup(): Promise<void> {
    // Create a test account for querying
    this.testAccountName = `Playwright Record Link Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(this.testAccountName);
  }

  async teardown(): Promise<void> {
    // Clean up test account
    if (this.testAccountId) {
      await this.salesforce.deleteRecord('Account', this.testAccountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query for our test account
    const query = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
    await this.queryTab.executeQuery(query);

    // Verify query succeeded
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Click the Id field in the first row
    await this.queryTab.clickRecordId(0);

    // Wait for new tab to open and switch to it
    await this.page.waitForTimeout(1000);
    const pages = this.browser.contexts()[0].pages();
    const recordPage = pages[pages.length - 1];
    await recordPage.bringToFront();

    // Initialize RecordPage for the new tab
    this.recordPage.page = recordPage;

    // Wait for record to load
    await this.recordPage.waitForLoad();

    // Verify correct record is displayed
    const displayedObjectType = await this.recordPage.getObjectName();
    await this.expect(displayedObjectType).toBe('Account');

    const displayedRecordId = await this.recordPage.getRecordId();
    await this.expect(displayedRecordId).toBe(this.testAccountId);

    // Verify Name field shows correct value
    const displayedName = await this.recordPage.getFieldValue('Name');
    await this.expect(displayedName).toBe(this.testAccountName);
  }
}
