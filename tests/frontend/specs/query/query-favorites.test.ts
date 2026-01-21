import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test query favorites functionality
 *
 * Test IDs: Q-F-019, Q-F-020, Q-F-021
 * - Q-F-019: Execute and save a query to favorites with a label
 * - Q-F-020: Load from favorites and verify it populates editor
 * - Q-F-021: Delete from favorites and verify removal
 */
export default class QueryFavoritesTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock query response
    router.onQuery(
      /\/query/,
      [{ Id: '001MOCKACCOUNT01', Name: 'Test Account' }],
      [
        { columnName: 'Id', displayName: 'Id', aggregate: false },
        { columnName: 'Name', displayName: 'Name', aggregate: false }
      ]
    );

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute the test query
    const testQuery = `SELECT Id, Name FROM Account LIMIT 10`;
    await this.queryTab.executeQuery(testQuery);

    // Verify query succeeded
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Save to favorites with a label (Q-F-019)
    const favoriteLabel = `Test Favorite ${Date.now()}`;
    await this.queryTab.saveToFavorites(favoriteLabel);

    // Clear the editor to verify loading works
    await this.queryTab.monaco.setValue('');
    const clearedValue = await this.queryTab.monaco.getValue();
    await this.expect(clearedValue).toBe('');

    // Load from favorites (Q-F-020)
    await this.queryTab.loadFromFavorites(0);

    // Verify editor is populated with the saved query
    const loadedQuery = await this.queryTab.monaco.getValue();
    await this.expect(loadedQuery).toBe(testQuery);

    // Delete from favorites (Q-F-021)
    await this.queryTab.deleteFromFavorites(0);

    // Close the modal after deletion
    await this.queryTab.closeHistory();

    // Verify favorites list is now empty by opening it and checking for "No favorites"
    await this.queryTab.openFavorites();
    const emptyMessage = await this.queryTab.page.locator('query-tab .query-favorites-list .script-empty').textContent();
    await this.expect(emptyMessage?.trim()).toContain('No favorites yet');
  }
}
