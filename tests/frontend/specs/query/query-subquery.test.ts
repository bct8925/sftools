import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test subquery expansion
 *
 * Test IDs: Q-F-004, Q-F-005, Q-F-006
 * - Q-F-004: Execute query with subquery - Nested records show as expandable "▶ N records"
 * - Q-F-005: Expand subquery results - Nested table displays inline
 * - Q-F-006: Collapse subquery results - Nested table is hidden
 */
export default class QuerySubqueryTest extends SftoolsTest {
  configureMocks() {
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
              { Id: '003MOCKCONTACT01', FirstName: 'Test', LastName: 'SubqueryContact1' },
              { Id: '003MOCKCONTACT02', FirstName: 'Demo', LastName: 'SubqueryContact2' }
            ]
          }
        }
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
            { columnName: 'LastName', displayName: 'LastName', aggregate: false }
          ]
        }
      ]
    );

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute subquery
    const query = `SELECT Id, Name, (SELECT Id, FirstName, LastName FROM Contacts) FROM Account LIMIT 10`;
    await this.queryTab.executeQuery(query);

    // Verify success status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify subquery results exist
    const hasSubquery = await this.queryTab.hasSubqueryResults();
    await this.expect(hasSubquery).toBe(true);

    // Expand subquery at index 0
    await this.queryTab.expandSubquery(0);

    // Verify subquery text contains the contact names
    const subqueryText = await this.queryTab.getSubqueryText(0);
    await this.expect(subqueryText).toContain('SubqueryContact1');
    await this.expect(subqueryText).toContain('SubqueryContact2');

    // Collapse subquery at index 0
    await this.queryTab.collapseSubquery(0);

    // Verify subquery is no longer visible
    const isSubqueryVisible = await this.queryTab.isSubqueryVisible(0);
    await this.expect(isSubqueryVisible).toBe(false);
  }
}
