/**
 * Test query favorites functionality
 *
 * Test IDs: Q-F-019, Q-F-020, Q-F-021
 * - Q-F-019: Execute and save a query to favorites with a label
 * - Q-F-020: Load from favorites and verify it populates editor
 * - Q-F-021: Delete from favorites and verify removal
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-019-021: Query Favorites', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response
        router.onQuery(
            /\/query/,
            [{ Id: '001MOCKACCOUNT01', Name: 'Test Account' }],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ]
        );

        await setupMocks(router);
    });

    it('saves to favorites, loads from favorites, and deletes from favorites', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute the test query
        const testQuery = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.executeQuery(testQuery);

        // Verify query succeeded
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // Save to favorites with a label (Q-F-019)
        const favoriteLabel = `Test Favorite ${Date.now()}`;
        await queryTab.saveToFavorites(favoriteLabel);

        // Clear the editor to verify loading works
        await queryTab.monaco.setValue('');
        const clearedValue = await queryTab.monaco.getValue();
        expect(clearedValue).toBe('');

        // Load from favorites (Q-F-020)
        await queryTab.loadFromFavorites(0);

        // Verify editor is populated with the saved query
        const loadedQuery = await queryTab.monaco.getValue();
        expect(loadedQuery).toBe(testQuery);

        // Delete from favorites (Q-F-021)
        await queryTab.deleteFromFavorites(0);

        // Close the modal after deletion
        await queryTab.closeHistory();

        // Verify favorites list is now empty by opening it and checking for "No favorites"
        await queryTab.openFavorites();
        const emptyMessage = await page
            .locator('[data-testid="query-favorites-list"]')
            .getByText('No favorites yet')
            .textContent();
        expect(emptyMessage?.trim()).toContain('No favorites yet');
    });
});
