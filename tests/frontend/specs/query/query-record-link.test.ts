import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test clicking record ID to open Record Viewer
 *
 * Test ID: Q-F-015
 * - Creates test Account
 * - Executes query that returns the account
 * - Clicks Id field in results
 * - Verifies Record Viewer opens with correct record
 */
export default class QueryRecordLinkTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Query tab
        await this.queryTab.navigateTo();

        // Execute query
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await this.queryTab.executeQuery(query);

        // Verify query succeeded
        const status = await this.queryTab.getStatus();
        await this.expect(status.type).toBe('success');

        // Verify Id link is present and clickable
        const headers = await this.queryTab.getResultsHeaders();
        const idIndex = headers.indexOf('Id');
        await this.expect(idIndex).toBeGreaterThanOrEqual(0);

        // Get the Id link element
        const idLink = this.page.locator(
            `query-tab .query-results table tbody tr:nth-child(1) td:nth-child(${idIndex + 1}) .query-id-link`
        );
        await idLink.waitFor({ state: 'visible', timeout: 5000 });

        // Verify the link has the correct href structure
        const href = await idLink.getAttribute('href');
        await this.expect(href || '').toContain('record.html');
        await this.expect(href || '').toContain(`recordId=001MOCKACCOUNT01`);

        // Wait for new tab to open when clicking the Id field
        const pagePromise = this.context.waitForEvent('page', { timeout: 10000 });
        await idLink.click();
        const recordPage = await pagePromise;

        // Wait for the page to navigate and load
        await recordPage.waitForLoadState('load', { timeout: 15000 });

        // Verify the URL contains the record ID and object type (Q-F-015: Click Id field opens Record Viewer)
        const url = recordPage.url();
        await this.expect(url).toContain('record.html');
        await this.expect(url).toContain(`objectType=Account`);
        await this.expect(url).toContain(`recordId=001MOCKACCOUNT01`);

        // Close the record page
        await recordPage.close();
    }
}
