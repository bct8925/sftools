import { SftoolsTest } from '../../framework/base-test';

/**
 * Test results filtering
 *
 * Test IDs: Q-F-014
 * - Q-F-014: Search/filter results - Table filters to matching rows
 */
export default class QueryFilterTest extends SftoolsTest {
  private accountIds: string[] = [];
  private testPrefix: string = '';

  async setup(): Promise<void> {
    // Create 3 accounts with unique prefix that includes timestamp
    const timestamp = Date.now();
    this.testPrefix = `QFT${timestamp}`;
    const account1 = await this.salesforce.createAccount(`${this.testPrefix} Alpha`);
    const account2 = await this.salesforce.createAccount(`${this.testPrefix} Beta`);
    const account3 = await this.salesforce.createAccount(`${this.testPrefix} Gamma`);
    this.accountIds.push(account1, account2, account3);
  }

  async teardown(): Promise<void> {
    // Delete the 3 accounts
    for (const accountId of this.accountIds) {
      await this.salesforce.deleteRecord('Account', accountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute query to get accounts with our unique prefix
    const query = `SELECT Id, Name FROM Account WHERE Name LIKE '${this.testPrefix}%' ORDER BY Name`;
    await this.queryTab.executeQuery(query);

    // Verify 3 results
    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(3);

    // Filter by 'Alpha'
    await this.queryTab.filterResults('Alpha');

    // Verify only 1 row visible
    const filteredCount = await this.queryTab.getResultsRowCount();
    await this.expect(filteredCount).toBe(1);

    // Clear filter
    await this.queryTab.clearFilter();

    // Verify 3 rows visible again
    const clearedCount = await this.queryTab.getResultsRowCount();
    await this.expect(clearedCount).toBe(3);
  }
}
