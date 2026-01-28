import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Apex favorites functionality
 *
 * Test IDs: A-F-011, A-F-012, A-F-013
 * - A-F-011: Execute and save an Apex script to favorites with a label
 * - A-F-012: Load from favorites and verify it populates editor
 * - A-F-013: Delete from favorites and verify removal
 */
describe('Apex Favorites', () => {
    let testApex: string;
    let favoriteLabel: string;

    beforeEach(async () => {
        const router = new MockRouter();

        // Mock successful Apex execution
        router.onApexExecute(
            true,
            true,
            'USER_DEBUG|[1]|DEBUG|Favorite Test\nUSER_DEBUG|[2]|DEBUG|x=42'
        );

        await setupMocks(router);

        // Create test Apex code
        testApex = `System.debug('Favorite Test ${Date.now()}');\nInteger x = 42;`;
        favoriteLabel = `Test Favorite ${Date.now()}`;
    });

    it('can save, load, and delete favorites', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Apex tab
        await apexTab.navigateTo();

        // Execute the test Apex (will use mocked response)
        await apexTab.setCode(testApex);
        await apexTab.execute();

        // Verify execution succeeded
        const status = await apexTab.getStatus();
        expect(status.success).toBe(true);

        // Save to favorites with a label (A-F-011)
        await apexTab.saveToFavorites(favoriteLabel);

        // Clear the editor to verify loading works
        await apexTab.codeEditor.setValue('');
        const clearedValue = await apexTab.codeEditor.getValue();
        expect(clearedValue).toBe('');

        // Load from favorites (A-F-012)
        await apexTab.loadFromFavorites(0);

        // Verify editor is populated with the saved script
        const loadedApex = await apexTab.codeEditor.getValue();
        expect(loadedApex).toBe(testApex);

        // Delete from favorites (A-F-013)
        await apexTab.deleteFromFavorites(0);

        // Close the modal after deletion
        await apexTab.closeHistory();

        // Verify favorites list is now empty by opening it and checking for "No favorites"
        await apexTab.openFavorites();
        const emptyMessage = await page
            .locator('[data-testid="apex-favorites-list"]')
            .getByText('No favorites yet')
            .textContent();
        expect(emptyMessage?.trim()).toContain('No favorites yet');
    });
});
