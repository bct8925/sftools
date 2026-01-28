/**
 * Query Subquery Expansion Test
 *
 * Test IDs: Q-F-004, Q-F-005, Q-F-006
 * - Q-F-004: Execute query with subquery - Nested records show as expandable "▶ N records"
 * - Q-F-005: Expand subquery results - Nested table displays inline
 * - Q-F-006: Collapse subquery results - Nested table is hidden
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-004/005/006: Subquery Expansion', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response with subquery data
        router.onQuery(
            /\/query/,
            [
                {
                    Id: '001MOCKACCOUNT01',
                    Name: 'Test Account',
                    Contacts: {
                        totalSize: 2,
                        done: true,
                        records: [
                            {
                                Id: '003MOCKCONTACT01',
                                FirstName: 'Test',
                                LastName: 'SubqueryContact1',
                            },
                            {
                                Id: '003MOCKCONTACT02',
                                FirstName: 'Demo',
                                LastName: 'SubqueryContact2',
                            },
                        ],
                    },
                },
            ],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
                {
                    columnName: 'Contacts',
                    displayName: 'Contacts',
                    aggregate: true,
                    joinColumns: [
                        { columnName: 'Id', displayName: 'Id', aggregate: false },
                        { columnName: 'FirstName', displayName: 'FirstName', aggregate: false },
                        { columnName: 'LastName', displayName: 'LastName', aggregate: false },
                    ],
                },
            ]
        );

        await setupMocks(router);
    });

    it('expands and collapses subquery results', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute subquery
        const query = `SELECT Id, Name, (SELECT Id, FirstName, LastName FROM Contacts) FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify success status
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // Verify subquery results exist
        const hasSubquery = await queryTab.hasSubqueryResults();
        expect(hasSubquery).toBe(true);

        // Expand subquery at index 0
        await queryTab.expandSubquery(0);

        // Verify subquery text contains the contact names
        const subqueryText = await queryTab.getSubqueryText(0);
        expect(subqueryText).toContain('SubqueryContact1');
        expect(subqueryText).toContain('SubqueryContact2');

        // Collapse subquery at index 0
        await queryTab.collapseSubquery(0);

        // Verify subquery is no longer visible
        const isSubqueryVisible = await queryTab.isSubqueryVisible(0);
        expect(isSubqueryVisible).toBe(false);
    });
});
