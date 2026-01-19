import { SftoolsTest } from '../../framework/base-test';

/**
 * Test tab management
 */
export default class QueryTabsTest extends SftoolsTest {
  private accountIds: string[] = [];

  async setup(): Promise<void> {
    // Create 2 test accounts with different names
    const timestamp = Date.now();
    const account1 = await this.salesforce.createAccount(`Tab Test Alpha ${timestamp}`);
    const account2 = await this.salesforce.createAccount(`Tab Test Beta ${timestamp}`);
    this.accountIds.push(account1, account2);
  }

  async teardown(): Promise<void> {
    // Delete both accounts
    for (const accountId of this.accountIds) {
      await this.salesforce.deleteRecord('Account', accountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute first query for account 1
    const query1 = `SELECT Id, Name FROM Account WHERE Id = '${this.accountIds[0]}'`;
    await this.queryTab.executeQuery(query1);

    // Verify success
    const status1 = await this.queryTab.getStatus();
    await this.expect(status1.type).toBe('success');

    // Verify 1 tab is open
    const tabs1 = await this.queryTab.getOpenTabs();
    await this.expect(tabs1.length).toBe(1);

    // Execute second query for account 2
    const query2 = `SELECT Id, Name FROM Account WHERE Id = '${this.accountIds[1]}'`;
    await this.queryTab.executeQuery(query2);

    // Verify success
    const status2 = await this.queryTab.getStatus();
    await this.expect(status2.type).toBe('success');

    // Verify 2 tabs are open
    const tabs2 = await this.queryTab.getOpenTabs();
    await this.expect(tabs2.length).toBe(2);

    // Close first tab by index
    await this.queryTab.closeTab(0);

    // Verify only 1 tab remains
    const tabs3 = await this.queryTab.getOpenTabs();
    await this.expect(tabs3.length).toBe(1);
  }
}
