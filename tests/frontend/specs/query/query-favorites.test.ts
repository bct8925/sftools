import { SftoolsTest } from '../../framework/base-test';

/**
 * Test query favorites functionality
 *
 * Test IDs: Q-F-019, Q-F-020, Q-F-021
 * - Q-F-019: Execute and save a query to favorites with a label
 * - Q-F-020: Load from favorites and verify it populates editor
 * - Q-F-021: Delete from favorites and verify removal
 */
export default class QueryFavoritesTest extends SftoolsTest {
  private testAccountId: string = '';
  private testQuery: string = '';
  private favoriteLabel: string = '';

  async setup(): Promise<void> {
    // Create a test account
    const uniqueName = `Playwright Favorite Test ${Date.now()}`;
    this.testAccountId = await this.salesforce.createAccount(uniqueName);
    this.testQuery = `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`;
    this.favoriteLabel = `Test Favorite ${Date.now()}`;
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

    // Execute the test query
    await this.queryTab.executeQuery(this.testQuery);

    // Verify query succeeded
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Save to favorites with a label (Q-F-019)
    await this.queryTab.saveToFavorites(this.favoriteLabel);

    // Clear the editor to verify loading works
    await this.queryTab.monaco.setValue('');
    const clearedValue = await this.queryTab.monaco.getValue();
    await this.expect(clearedValue).toBe('');

    // Load from favorites (Q-F-020)
    await this.queryTab.loadFromFavorites(0);

    // Verify editor is populated with the saved query
    const loadedQuery = await this.queryTab.monaco.getValue();
    await this.expect(loadedQuery).toBe(this.testQuery);

    // Delete from favorites (Q-F-021)
    await this.queryTab.deleteFromFavorites(0);

    // Verify favorites list is now empty by opening it and checking for "No favorites"
    await this.queryTab.openFavorites();
    const emptyMessage = await this.queryTab.page.locator('query-tab .query-favorites-list .query-empty-message').textContent();
    await this.expect(emptyMessage?.trim()).toBe('No favorites saved');
  }
}
