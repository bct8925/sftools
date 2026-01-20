import { SftoolsTest } from '../../framework/base-test';

/**
 * Test basic SOQL query execution
 *
 * Test IDs: Q-F-001, Q-F-033, Q-F-034, Q-F-035
 * - Q-F-001: Execute simple SOQL query - Results display in table with correct columns
 * - Q-F-033: Verify success status
 * - Q-F-034: Verify record count
 * - Q-F-035: Verify column headers
 */
export default class BasicQueryTest extends SftoolsTest {
  private testAccountId: string = '';

  async setup(): Promise<void> {
    // Create a test account for querying
    const uniqueName = `Playwright Query Test ${Date.now()}`;
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

    // Execute query for our test account
    const query = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
    await this.queryTab.executeQuery(query);

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
