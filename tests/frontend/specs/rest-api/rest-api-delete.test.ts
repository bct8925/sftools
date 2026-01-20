import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API DELETE requests
 *
 * Test ID: R-F-004
 * - R-F-004: DELETE request - Record deleted successfully (204 status)
 */
export default class RestApiDeleteTest extends SftoolsTest {
  private accountId: string | null = null;

  async setup(): Promise<void> {
    // Create an Account via Salesforce client
    const result = await this.salesforce.createRecord('Account', {
      Name: 'REST API DELETE Test Account'
    });
    this.accountId = result.id;
  }

  async test(): Promise<void> {
    if (!this.accountId) {
      throw new Error('Account was not created in setup');
    }

    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to DELETE
    await this.restApiTab.setMethod('DELETE');

    // Set endpoint to the specific account
    await this.restApiTab.setEndpoint(`/services/data/v62.0/sobjects/Account/${this.accountId}`);

    // Send request
    await this.restApiTab.send();

    // Verify successful deletion (204 status)
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('success');
    await this.expect(status.text).toContain('204');
  }

  async teardown(): Promise<void> {
    // No cleanup needed - record is already deleted
  }
}
