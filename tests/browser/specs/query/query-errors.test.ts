/**
 * Test SOQL query error handling
 *
 * Test IDs: Q-F-029, Q-F-032
 * - Q-F-029: Status badge shows error - X icon with error message
 * - Q-F-032: Query with invalid SOQL - Error message with details
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-029/032: Query Error Handling', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query error response
        router.addRoute(
            /\/query/,
            {
                status: 400,
                data: [
                    {
                        message: "ERROR at Row:1:Column:8\nline 1:7 mismatched input 'FROM'",
                        errorCode: 'MALFORMED_QUERY',
                    },
                ],
            },
            'GET'
        );

        await setupMocks(router);
    });

    it('displays error status and message for invalid SOQL', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute an invalid query (missing FROM clause)
        const invalidQuery = 'SELECT FROM Account';
        await queryTab.executeQuery(invalidQuery);

        // Verify error status
        const status = await queryTab.getStatus();
        expect(status.type).toBe('error');

        // Verify error message contains expected text (error is in results container)
        const errorMessage = await queryTab.getErrorMessage();
        expect(errorMessage).toContain('ERROR at Row');
    });
});
