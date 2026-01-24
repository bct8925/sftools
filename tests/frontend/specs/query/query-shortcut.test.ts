import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test IDs: Q-F-002
 *
 * - Q-F-002: Execute query via Ctrl/Cmd+Enter
 */
export default class QueryShortcutTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Query tab
        await this.queryTab.navigateTo();

        // Set query in Monaco editor
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await this.queryTab.setQuery(query);

        // Execute via Ctrl/Cmd+Enter keyboard shortcut
        await this.queryTab.executeWithShortcut();

        // Verify success status
        const status = await this.queryTab.getStatus();
        await this.expect(status.type).toBe('success');

        // Verify record count
        const count = await this.queryTab.getResultsCount();
        await this.expect(count).toBe(1);

        // Verify column headers
        const headers = await this.queryTab.getResultsHeaders();
        await this.expect(headers).toInclude('Id');
        await this.expect(headers).toInclude('Name');
    }
}
