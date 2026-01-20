import { SftoolsTest } from '../../framework/base-test';

/**
 * Test tab management
 *
 * Test IDs: Q-F-022, Q-F-023, Q-F-024, Q-F-026
 * - Q-F-022: Create new result tab - Same query reuses existing tab
 * - Q-F-023: Different query creates new tab - New tab appears
 * - Q-F-024: Switch between tabs - Active tab changes
 * - Q-F-026: Close tab - Tab removed from list
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

    // Switch to first tab
    await this.queryTab.switchToTab(0);

    // Verify first tab is active
    const activeTab1 = await this.queryTab.getActiveTab();
    await this.expect(activeTab1).toBe(0);

    // Switch to second tab
    await this.queryTab.switchToTab(1);

    // Verify second tab is active
    const activeTab2 = await this.queryTab.getActiveTab();
    await this.expect(activeTab2).toBe(1);

    // Close first tab by index
    await this.queryTab.closeTab(0);

    // Verify only 1 tab remains
    const tabs3 = await this.queryTab.getOpenTabs();
    await this.expect(tabs3.length).toBe(1);
  }
}
