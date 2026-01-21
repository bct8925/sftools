import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test SOQL query error handling
 *
 * Test IDs: Q-I-002, Q-F-029
 * - Q-I-002: Query with invalid SOQL - Error message with details
 * - Q-F-029: Status badge shows error - X icon with error message
 */
export default class QueryErrorsTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Mock query error response
    router.addRoute(
      /\/query/,
      {
        status: 400,
        data: [
          {
            message: 'ERROR at Row:1:Column:8\nline 1:7 mismatched input \'FROM\'',
            errorCode: 'MALFORMED_QUERY'
          }
        ]
      },
      'GET'
    );

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Execute an invalid query (missing FROM clause)
    const invalidQuery = 'SELECT FROM Account';
    await this.queryTab.executeQuery(invalidQuery);

    // Verify error status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('error');

    // Verify error message contains expected text (error is in results container)
    const errorMessage = await this.queryTab.getErrorMessage();
    await this.expect(errorMessage).toContain('ERROR at Row');
  }
}
