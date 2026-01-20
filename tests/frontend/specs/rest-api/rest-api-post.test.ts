import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API POST request
 *
 * Test ID: R-F-002
 * - POST creates Account record
 * - Response contains new record ID
 * - Status shows 201 Created
 */
export default class RestApiPostTest extends SftoolsTest {
  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to POST
    await this.restApiTab.setMethod('POST');

    // Set endpoint to create Account
    await this.restApiTab.setEndpoint('/services/data/v62.0/sobjects/Account');

    // Set request body
    const timestamp = Date.now();
    const requestBody = JSON.stringify({
      Name: `Test Account ${timestamp}`
    });
    await this.restApiTab.setRequestBody(requestBody);

    // Send request
    await this.restApiTab.send();

    // Verify success status (201 Created)
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('success');
    await this.expect(status.text).toContain('201');

    // Verify response contains ID
    const response = await this.restApiTab.getResponse();
    await this.expect(response).toContain('"id"');
    await this.expect(response).toContain('"success": true');
  }
}
