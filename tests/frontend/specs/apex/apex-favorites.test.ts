import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Apex favorites functionality
 *
 * Test IDs: A-F-011, A-F-012, A-F-013
 * - A-F-011: Execute and save an Apex script to favorites with a label
 * - A-F-012: Load from favorites and verify it populates editor
 * - A-F-013: Delete from favorites and verify removal
 */
export default class ApexFavoritesTest extends SftoolsTest {
  private testApex: string = '';
  private favoriteLabel: string = '';

  configureMocks() {
    const router = new MockRouter();

    // Mock successful Apex execution
    router.onApexExecute(
      true,
      true,
      'USER_DEBUG|[1]|DEBUG|Favorite Test\nUSER_DEBUG|[2]|DEBUG|x=42'
    );

    return router;
  }

  async test(): Promise<void> {
    // Create test Apex code
    this.testApex = `System.debug('Favorite Test ${Date.now()}');\nInteger x = 42;`;
    this.favoriteLabel = `Test Favorite ${Date.now()}`;

    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Execute the test Apex (will use mocked response)
    await this.apexTab.setCode(this.testApex);
    await this.apexTab.execute();

    // Verify execution succeeded
    const status = await this.apexTab.getStatus();
    await this.expect(status.success).toBe(true);

    // Save to favorites with a label (A-F-011)
    await this.apexTab.saveToFavorites(this.favoriteLabel);

    // Clear the editor to verify loading works
    await this.apexTab.codeEditor.setValue('');
    const clearedValue = await this.apexTab.codeEditor.getValue();
    await this.expect(clearedValue).toBe('');

    // Load from favorites (A-F-012)
    await this.apexTab.loadFromFavorites(0);

    // Verify editor is populated with the saved script
    const loadedApex = await this.apexTab.codeEditor.getValue();
    await this.expect(loadedApex).toBe(this.testApex);

    // Delete from favorites (A-F-013)
    await this.apexTab.deleteFromFavorites(0);

    // Close the modal after deletion
    await this.apexTab.closeHistory();

    // Verify favorites list is now empty by opening it and checking for "No favorites"
    await this.apexTab.openFavorites();
    const emptyMessage = await this.apexTab.page.locator('apex-tab .apex-favorites-list .script-empty').textContent();
    await this.expect(emptyMessage?.trim()).toContain('No favorites yet');
  }
}
