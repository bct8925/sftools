import { SftoolsTest } from '../../framework/base-test';

/**
 * Test REST API error handling
 *
 * Test IDs: R-I-007
 * - R-I-007: HTTP 400 error - Error response displayed
 */
export default class RestApiErrorsTest extends SftoolsTest {
  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to GET
    await this.restApiTab.setMethod('GET');

    // Set endpoint to invalid endpoint
    await this.restApiTab.setEndpoint('/services/data/v62.0/invalid-endpoint-that-does-not-exist');

    // Send request
    await this.restApiTab.send();

    // Verify error status
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('error');
  }
}
