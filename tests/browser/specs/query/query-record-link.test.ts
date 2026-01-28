/**
 * Query Record Link Test
 *
 * Test ID: Q-F-015
 * - Creates test Account
 * - Executes query that returns the account
 * - Clicks Id field in results
 * - Verifies Record Viewer opens with correct record
 */

import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('Q-F-015: Click Id Field Opens Record Viewer', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query response with entityName for ID link rendering
        router.onQuery(
            /\/query/,
            [
                {
                    Id: '001MOCKACCOUNT01',
                    Name: 'Test Account',
                    attributes: {
                        type: 'Account',
                        url: '/services/data/v59.0/sobjects/Account/001MOCKACCOUNT01',
                    },
                },
            ],
            [
                { columnName: 'Id', displayName: 'Id', aggregate: false },
                { columnName: 'Name', displayName: 'Name', aggregate: false },
            ],
            'Account'
        );

        await setupMocks(router);
    });

    it('opens Record Viewer when Id field is clicked', async () => {
        const { page, context } = getTestContext();
        const { queryTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Query tab
        await queryTab.navigateTo();

        // Execute query
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await queryTab.executeQuery(query);

        // Verify query succeeded
        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        // Verify Id link is present and clickable
        const headers = await queryTab.getResultsHeaders();
        const idIndex = headers.indexOf('Id');
        expect(idIndex).toBeGreaterThanOrEqual(0);

        // Get the Id link element
        const idLink = page.locator(
            `[data-testid="query-results"] table tbody tr:nth-child(1) td:nth-child(${idIndex + 1}) .query-id-link`
        );
        await idLink.waitFor({ state: 'visible', timeout: 5000 });

        // Verify the link has the correct href structure
        const href = await idLink.getAttribute('href');
        expect(href || '').toContain('record.html');
        expect(href || '').toContain(`recordId=001MOCKACCOUNT01`);

        // Wait for new tab to open when clicking the Id field
        const pagePromise = context.waitForEvent('page', { timeout: 10000 });
        await idLink.click();
        const recordPage = await pagePromise;

        // Wait for the page to navigate and load
        await recordPage.waitForLoadState('load', { timeout: 15000 });

        // Verify the URL contains the record ID and object type (Q-F-015: Click Id field opens Record Viewer)
        const url = recordPage.url();
        expect(url).toContain('record.html');
        expect(url).toContain(`objectType=Account`);
        expect(url).toContain(`recordId=001MOCKACCOUNT01`);

        // Close the record page
        await recordPage.close();
    });
});
