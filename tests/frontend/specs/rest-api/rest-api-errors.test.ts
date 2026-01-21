import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test REST API error handling
 *
 * Test IDs: R-F-009
 * - R-F-009: Error response received - Status badge shows error state
 */
export default class RestApiErrorsTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock error response for invalid endpoint
    router.onRestRequest('/invalid-endpoint', 'GET', {
      status: 404,
      data: [
        {
          message: 'The requested resource does not exist',
          errorCode: 'NOT_FOUND'
        }
      ]
    });

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to GET
    await this.restApiTab.setMethod('GET');

    // Set endpoint to invalid endpoint
    await this.restApiTab.setEndpoint('/services/data/v62.0/invalid-endpoint');

    // Send request
    await this.restApiTab.send();

    // Verify error status
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('error');
  }
}
