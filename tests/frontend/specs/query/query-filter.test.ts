import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test results filtering
 *
 * Test IDs: Q-F-014
 * - Q-F-014: Search/filter results - Table filters to matching rows
 */
export default class QueryFilterTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock query response with 3 accounts
    router.onQuery(
      /\/query/,
      [
        { Id: '001MOCKACCOUNT01', Name: 'QFT Alpha' },
        { Id: '001MOCKACCOUNT02', Name: 'QFT Beta' },
        { Id: '001MOCKACCOUNT03', Name: 'QFT Gamma' }
      ],
      [
        { columnName: 'Id', displayName: 'Id', aggregate: false },
        { columnName: 'Name', displayName: 'Name', aggregate: false }
      ]
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

    // Verify 3 results
    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(3);

    // Filter by 'Alpha'
    await this.queryTab.filterResults('Alpha');

    // Verify only 1 row visible
    const filteredCount = await this.queryTab.getResultsRowCount();
    await this.expect(filteredCount).toBe(1);

    // Clear filter
    await this.queryTab.clearFilter();

    // Verify 3 rows visible again
    const clearedCount = await this.queryTab.getResultsRowCount();
    await this.expect(clearedCount).toBe(3);
  }
}
