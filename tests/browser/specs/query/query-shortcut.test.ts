/**
 * Query Keyboard Shortcut Test
 *
 * Test ID: Q-F-002
 * - Q-F-002: Execute query via Ctrl/Cmd+Enter
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-002: Execute Query Via Keyboard Shortcut', () => {
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

    it('executes query using Ctrl/Cmd+Enter shortcut', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Set query in Monaco editor
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.setQuery(query);

        // Execute via Ctrl/Cmd+Enter keyboard shortcut
        await queryTab.executeWithShortcut();

        // Verify success status
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // Verify record count
        const count = await queryTab.getResultsCount();
        expect(count).toBe(1);

        // Verify column headers
        const headers = await queryTab.getResultsHeaders();
        expect(headers).toContain('Id');
        expect(headers).toContain('Name');
    });
});
