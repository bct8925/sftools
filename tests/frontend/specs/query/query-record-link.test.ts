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

    // Verify Id link is present and clickable
    const headers = await this.queryTab.getResultsHeaders();
    const idIndex = headers.indexOf('Id');
    await this.expect(idIndex).toBeGreaterThanOrEqual(0);

    // Get the Id link element
    const idLink = this.page.locator(
      `query-tab .query-results table tbody tr:nth-child(1) td:nth-child(${idIndex + 1}) .query-id-link`
    );
    await idLink.waitFor({ state: 'visible', timeout: 5000 });

    // Verify the link has the correct href structure
    const href = await idLink.getAttribute('href');
    await this.expect(href || '').toContain('record.html');
    await this.expect(href || '').toContain(`recordId=${this.testAccountId}`);

    // Wait for new tab to open when clicking the Id field
    const pagePromise = this.context.waitForEvent('page', { timeout: 10000 });
    await idLink.click();
    const recordPage = await pagePromise;

    // Wait for the page to navigate and load
    await recordPage.waitForLoadState('load', { timeout: 15000 });

    // Verify the URL contains the record ID and object type (Q-F-015: Click Id field opens Record Viewer)
    const url = recordPage.url();
    await this.expect(url).toContain('record.html');
    await this.expect(url).toContain(`objectType=Account`);
    await this.expect(url).toContain(`recordId=${this.testAccountId}`);

    // Close the record page
    await recordPage.close();
  }
}
