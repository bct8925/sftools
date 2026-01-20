import { SftoolsTest } from '../../framework/base-test';

/**
 * Test relationship field queries
 *
 * Test IDs: Q-F-003
 * - Q-F-003: Execute query with relationship fields - Columns show full path (e.g., Account.Owner.Name)
 */
export default class QueryRelationshipsTest extends SftoolsTest {
  private accountId: string = '';
  private contactId: string = '';

  async setup(): Promise<void> {
    // Create an Account
    const accountName = `Relationship Test ${Date.now()}`;
    this.accountId = await this.salesforce.createAccount(accountName);

    // Create a Contact with AccountId set
    this.contactId = await this.salesforce.createContact({
      LastName: 'RelationshipTest',
      FirstName: 'Demo',
      AccountId: this.accountId
    });
  }

  async teardown(): Promise<void> {
    // Delete contact first (child before parent)
    if (this.contactId) {
      await this.salesforce.deleteRecord('Contact', this.contactId);
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

    // Execute query with relationship field
    const query = `SELECT Id, FirstName, Account.Name FROM Contact WHERE Id = '${this.contactId}'`;
    await this.queryTab.executeQuery(query);

    // Verify success status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify headers include 'Account.Name'
    const headers = await this.queryTab.getResultsHeaders();
    await this.expect(headers).toInclude('Account.Name');

    // Verify results count is 1
    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(1);
  }
}
