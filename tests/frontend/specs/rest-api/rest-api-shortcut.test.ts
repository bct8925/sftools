import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test REST API keyboard shortcut execution
 *
 * Test IDs: R-F-008
 * - R-F-008: Execute REST API request via Ctrl/Cmd+Enter
 * @test R-F-008
 */
export default class RestApiShortcutTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock POST to create Account
    router.onRestRequest('/sobjects/Account$', 'POST', {
      status: 201,
      data: {
        id: '001NEWRECORD0001',
        success: true,
        errors: []
      }
    });

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to REST API tab
    await this.restApiTab.navigateTo();

    // Set method to POST
    await this.restApiTab.setMethod('POST');

    // Set endpoint to sobjects/Account
    await this.restApiTab.setEndpoint('/services/data/v62.0/sobjects/Account');

    // Set request body with account data
    const requestBody = JSON.stringify({
      Name: 'Test Account'
    }, null, 2);
    await this.restApiTab.setRequestBody(requestBody);

    // Execute via Ctrl/Cmd+Enter keyboard shortcut
    await this.restApiTab.executeWithShortcut();

    // Verify request was successful
    const status = await this.restApiTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify response contains the created record ID
    const response = await this.restApiTab.getResponse();
    await this.expect(response).toContain('"id"');
    await this.expect(response).toContain('"success": true');
  }
}
