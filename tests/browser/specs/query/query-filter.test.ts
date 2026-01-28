/**
 * Test results filtering
 *
 * Test IDs: Q-F-014
 * - Q-F-014: Search/filter results - Table filters to matching rows
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-014: Query Results Filtering', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response with 3 accounts
        router.onQuery(
            /\/query/,
            [
                { Id: '001MOCKACCOUNT01', Name: 'QFT Alpha' },
                { Id: '001MOCKACCOUNT02', Name: 'QFT Beta' },
                { Id: '001MOCKACCOUNT03', Name: 'QFT Gamma' },
            ],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ]
        );

        await setupMocks(router);
    });

    it('filters results to matching rows and clears filter', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute query
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify 3 results
        const count = await queryTab.getResultsCount();
        expect(count).toBe(3);

        // Filter by 'Alpha'
        await queryTab.filterResults('Alpha');

        // Verify only 1 row visible
        const filteredCount = await queryTab.getResultsRowCount();
        expect(filteredCount).toBe(1);

        // Clear filter
        await queryTab.clearFilter();

        // Verify 3 rows visible again
        const clearedCount = await queryTab.getResultsRowCount();
        expect(clearedCount).toBe(3);
    });
});
