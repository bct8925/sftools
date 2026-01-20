import { SftoolsTest } from '../../framework/base-test';

/**
 * Test query tab refresh functionality
 *
 * Test IDs: Q-F-025
 * - Q-F-025: Refresh query tab - Results updated with latest data
 */
export default class QueryTabRefreshTest extends SftoolsTest {
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
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query for our test account
    const query = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
    await this.queryTab.executeQuery(query);

    // Verify success status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify original name appears in results
    const headers = await this.queryTab.getResultsHeaders();
    const nameIndex = headers.indexOf('Name');
    await this.expect(nameIndex).toBeGreaterThan(-1);

    // Get the name cell value
    const originalNameValue = await this.page.$$eval(
      'query-tab .query-results table tbody tr:nth-child(1) td',
      (cells, index) => cells[index]?.textContent?.trim() || '',
      nameIndex
    );
    await this.expect(originalNameValue).toBe(this.originalName);

    // Update the account name via API
    const modifiedName = `Modified ${Date.now()}`;
    await this.salesforce.updateRecord('Account', this.testAccountId, { Name: modifiedName });

    // Click refresh button on the tab
    await this.queryTab.refreshTab();

    // Verify success status after refresh
    const statusAfterRefresh = await this.queryTab.getStatus();
    await this.expect(statusAfterRefresh.type).toBe('success');

    // Verify updated name appears in results
    const updatedNameValue = await this.page.$$eval(
      'query-tab .query-results table tbody tr:nth-child(1) td',
      (cells, index) => cells[index]?.textContent?.trim() || '',
      nameIndex
    );
    await this.expect(updatedNameValue).toBe(modifiedName);
  }
}
