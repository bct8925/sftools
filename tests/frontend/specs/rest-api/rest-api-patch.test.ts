import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API PATCH requests
 *
 * Test ID: R-F-003
 * - R-F-003: Execute PATCH request - Updates Salesforce record
 *
 * @test R-F-003
 */
export default class RestApiPatchTest extends SftoolsTest {
  private accountId: string = '';

  async setup(): Promise<void> {
    // Create a test account
    this.accountId = await this.salesforce.createAccount('REST API PATCH Test Account');
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to PATCH
    await this.restApiTab.setMethod('PATCH');

    // Set endpoint to update the account
    await this.restApiTab.setEndpoint(`/services/data/v62.0/sobjects/Account/${this.accountId}`);

    // Set request body with updated name
    const requestBody = JSON.stringify({
      Name: 'REST API PATCH Test Account - Updated'
    }, null, 2);
    await this.restApiTab.setRequestBody(requestBody);

    // Send request
    await this.restApiTab.send();

    // Verify success status
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify the account was updated
    const account = await this.salesforce.getRecord('Account', this.accountId, ['Name']);
    await this.expect((account as { Name: string }).Name).toBe('REST API PATCH Test Account - Updated');
  }

  async teardown(): Promise<void> {
    // Clean up test account
    if (this.accountId) {
      await this.salesforce.deleteRecord('Account', this.accountId);
    }
  }
}
