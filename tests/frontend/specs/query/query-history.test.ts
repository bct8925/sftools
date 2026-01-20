import { SftoolsTest } from '../../framework/base-test';

/**
 * Test query history functionality
 *
 * Test IDs: Q-F-016, Q-F-017, Q-F-018
 * - Q-F-016: Execute a query and verify it appears in history
 * - Q-F-017: Load a query from history and verify it populates editor
 * - Q-F-018: Delete a query from history and verify removal
 */
export default class QueryHistoryTest extends SftoolsTest {
  private testQuery: string = 'SELECT Id, Name FROM Account LIMIT 1';

  async setup(): Promise<void> {
    // No setup needed - using simple query
  }

  async teardown(): Promise<void> {
    // No teardown needed
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute a query to add it to history
    await this.queryTab.executeQuery(this.testQuery);

    // Q-F-016: Verify query appears in history
    await this.queryTab.openHistory();
    const historyCount = await this.queryTab.getHistoryCount();
    await this.expect(historyCount).toBeGreaterThan(0);

    const historyItems = await this.queryTab.getHistoryItems();
    await this.expect(historyItems).toInclude(this.testQuery);

    await this.queryTab.closeHistory();

    // Clear the editor
    await this.queryTab.monaco.setValue('');

    // Q-F-017: Load from history and verify it populates editor
    await this.queryTab.loadFromHistory(0);

    const editorValue = await this.queryTab.monaco.getValue();
    await this.expect(editorValue.trim()).toBe(this.testQuery);

    // Q-F-018: Delete from history and verify removal
    await this.queryTab.openHistory();
    const beforeDeleteCount = await this.queryTab.getHistoryCount();

    // Delete the first item (deleteFromHistory already opens history)
    await this.queryTab.closeHistory();
    await this.queryTab.deleteFromHistory(0);

    // Reopen to check the count
    await this.queryTab.closeHistory();
    await this.queryTab.openHistory();
    const afterDeleteCount = await this.queryTab.getHistoryCount();
    await this.expect(afterDeleteCount).toBe(beforeDeleteCount - 1);

    await this.queryTab.closeHistory();
  }
}
