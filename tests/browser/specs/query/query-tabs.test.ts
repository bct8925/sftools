/**
 * Query Tab Management Test
 *
 * Test IDs: Q-F-022, Q-F-023, Q-F-024, Q-F-026
 * - Q-F-022: Create new result tab - Same query reuses existing tab
 * - Q-F-023: Different query creates new tab - New tab appears
 * - Q-F-024: Switch between tabs - Active tab changes
 * - Q-F-026: Close tab - Tab removed from list
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-022/023/024/026: Query Tab Management', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query responses for both queries
        router.onQuery(
            /\/query/,
            [{ Id: '001MOCKACCOUNT01', Name: 'Tab Test Alpha' }],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ]
        );

        await setupMocks(router);
    });

    it('creates, switches, and closes query tabs', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute first query
        const query1 = `SELECT Id, Name FROM Account WHERE Name LIKE 'Alpha%'`;
        await queryTab.executeQuery(query1);

        // Verify success
        const status1 = await queryTab.getStatus();
        expect(status1.type).toBe('success');

        // Verify 1 tab is open
        const tabs1 = await queryTab.getOpenTabs();
        expect(tabs1.length).toBe(1);

        // Execute second query
        const query2 = `SELECT Id, Name FROM Account WHERE Name LIKE 'Beta%'`;
        await queryTab.executeQuery(query2);

        // Verify success
        const status2 = await queryTab.getStatus();
        expect(status2.type).toBe('success');

        // Verify 2 tabs are open
        const tabs2 = await queryTab.getOpenTabs();
        expect(tabs2.length).toBe(2);

        // Switch to first tab
        await queryTab.switchToTab(0);

        // Verify first tab is active
        const activeTab1 = await queryTab.getActiveTab();
        expect(activeTab1).toBe(0);

        // Switch to second tab
        await queryTab.switchToTab(1);

        // Verify second tab is active
        const activeTab2 = await queryTab.getActiveTab();
        expect(activeTab2).toBe(1);

        // Close first tab by index
        await queryTab.closeTab(0);

        // Verify only 1 tab remains
        const tabs3 = await queryTab.getOpenTabs();
        expect(tabs3.length).toBe(1);
    });
});
