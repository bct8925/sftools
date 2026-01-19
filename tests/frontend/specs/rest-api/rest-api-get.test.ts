import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API GET requests
 */
export default class RestApiGetTest extends SftoolsTest {
  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to GET
    await this.restApiTab.setMethod('GET');

    // Set endpoint to sobjects endpoint
    await this.restApiTab.setEndpoint('/services/data/v62.0/sobjects/');

    // Send request
    await this.restApiTab.send();

    // Verify success status
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify response contains 'sobjects'
    const response = await this.restApiTab.getResponse();
    await this.expect(response).toContain('sobjects');
  }
}
