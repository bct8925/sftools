import { SftoolsTest } from '../../framework/base-test';

/**
 * Test SOQL query execution via keyboard shortcut
 *
 * @test Q-F-002: Execute query via Ctrl/Cmd+Enter
 */
export default class QueryShortcutTest extends SftoolsTest {
  private testAccountId: string = '';

  async setup(): Promise<void> {
    // Create a test account for querying
    const uniqueName = `Playwright Query Shortcut Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(uniqueName);
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

    // Set query in Monaco editor
    const query = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
    await this.queryTab.setQuery(query);

    // Execute via Ctrl/Cmd+Enter keyboard shortcut
    await this.queryTab.executeWithShortcut();

    // Verify success status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify record count
    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(1);

    // Verify column headers
    const headers = await this.queryTab.getResultsHeaders();
    await this.expect(headers).toInclude('Id');
    await this.expect(headers).toInclude('Name');
  }
}
