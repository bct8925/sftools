import { SftoolsTest } from '../../framework/base-test';

/**
 * Test subquery expansion
 *
 * Test IDs: Q-F-004, Q-F-005, Q-F-006
 * - Q-F-004: Execute query with subquery - Nested records show as expandable "▶ N records"
 * - Q-F-005: Expand subquery results - Nested table displays inline
 * - Q-F-006: Collapse subquery results - Nested table is hidden
 */
export default class QuerySubqueryTest extends SftoolsTest {
  private accountId: string = '';
  private contactIds: string[] = [];

  async setup(): Promise<void> {
    // Create an Account
    const accountName = `Subquery Test ${Date.now()}`;
    this.accountId = await this.salesforce.createAccount(accountName);

    // Create 2 Contacts linked to the Account
    const contact1 = await this.salesforce.createContact({
      LastName: 'SubqueryContact1',
      FirstName: 'Test',
      AccountId: this.accountId
    });
    const contact2 = await this.salesforce.createContact({
      LastName: 'SubqueryContact2',
      FirstName: 'Demo',
      AccountId: this.accountId
    });
    this.contactIds.push(contact1, contact2);
  }

  async teardown(): Promise<void> {
    // Delete contacts first (children before parent)
    for (const contactId of this.contactIds) {
      await this.salesforce.deleteRecord('Contact', contactId);
    }

    // Delete account
    if (this.accountId) {
      await this.salesforce.deleteRecord('Account', this.accountId);
    }
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute subquery
    const query = `SELECT Id, Name, (SELECT Id, FirstName, LastName FROM Contacts) FROM Account WHERE Id = '${this.accountId}'`;
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
