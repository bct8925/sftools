/**
 * Basic Query Test
 *
 * Test IDs: Q-F-001, Q-F-033, Q-F-034, Q-F-035, Q-F-036
 * - Q-F-001: Execute simple SOQL query - Results display in table with correct columns
 * - Q-F-033: Verify success status
 * - Q-F-034: Verify record count
 * - Q-F-035: Verify column headers
 * - Q-F-036: Results panel is collapsed by default and auto-expands on execution
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-001: Basic Query Execution', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response with column metadata
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

    it('executes simple SOQL query with correct results', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute query (will use mocked response)
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify success status
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // Verify record count matches mocked data
        const count = await queryTab.getResultsCount();
        expect(count).toBe(1);

        // Verify column headers match mocked metadata
        const headers = await queryTab.getResultsHeaders();
        expect(headers).toContain('Id');
        expect(headers).toContain('Name');
    });

    it('Q-F-036: results panel is collapsed by default and auto-expands on execution', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();

        // Collapsed on first load for a clean view
        expect(await queryTab.isResultsCollapsed()).toBe(true);

        // Running a query reveals the results panel
        await queryTab.executeQuery('SELECT Id, Name FROM Account LIMIT 10');
        expect(await queryTab.isResultsCollapsed()).toBe(false);
    });
});
