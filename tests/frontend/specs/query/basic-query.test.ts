import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test basic SOQL query execution
 *
 * Test IDs: Q-F-001, Q-F-033, Q-F-034, Q-F-035
 * - Q-F-001: Execute simple SOQL query - Results display in table with correct columns
 * - Q-F-033: Verify success status
 * - Q-F-034: Verify record count
 * - Q-F-035: Verify column headers
 */
export default class BasicQueryTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Query tab
        await this.queryTab.navigateTo();

        // Execute query (will use mocked response)
        const query = `SELECT Id, Name FROM Account LIMIT 10`;
        await this.queryTab.executeQuery(query);

        // Verify success status
        const status = await this.queryTab.getStatus();
        await this.expect(status.type).toBe('success');

        // Verify record count matches mocked data
        const count = await this.queryTab.getResultsCount();
        await this.expect(count).toBe(1);

        // Verify column headers match mocked metadata
        const headers = await this.queryTab.getResultsHeaders();
        await this.expect(headers).toInclude('Id');
        await this.expect(headers).toInclude('Name');
    }
}
