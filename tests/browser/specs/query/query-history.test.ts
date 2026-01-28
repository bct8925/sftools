/**
 * Query History Test
 *
 * Test IDs: Q-F-016, Q-F-017, Q-F-018
 * - Q-F-016: Execute a query and verify it appears in history
 * - Q-F-017: Load a query from history and verify it populates editor
 * - Q-F-018: Delete a query from history and verify removal
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-016/017/018: Query History Functionality', () => {
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

    it('manages query history (add, load, delete)', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute a query to add it to history
        const testQuery = 'SELECT Id, Name FROM Account LIMIT 1';
        await queryTab.executeQuery(testQuery);

        // Q-F-016: Verify query appears in history
        await queryTab.openHistory();
        const historyCount = await queryTab.getHistoryCount();
        expect(historyCount).toBeGreaterThan(0);

        const historyItems = await queryTab.getHistoryItems();
        expect(historyItems).toContain(testQuery);

        await queryTab.closeHistory();

        // Clear the editor
        await queryTab.monaco.setValue('');

        // Q-F-017: Load from history and verify it populates editor
        await queryTab.loadFromHistory(0);

        const editorValue = await queryTab.monaco.getValue();
        expect(editorValue.trim()).toBe(testQuery);

        // Q-F-018: Delete from history and verify removal
        await queryTab.openHistory();
        const beforeDeleteCount = await queryTab.getHistoryCount();
        await queryTab.closeHistory();

        // Delete the first item (deleteFromHistory opens history internally)
        await queryTab.deleteFromHistory(0);

        // Check the count (modal is still open from deleteFromHistory)
        const afterDeleteCount = await queryTab.getHistoryCount();
        expect(afterDeleteCount).toBe(beforeDeleteCount - 1);

        await queryTab.closeHistory();
    });
});
