import { SftoolsTest } from '../../framework/base-test';

/**
 * Test SOQL query error handling
 */
export default class QueryErrorsTest extends SftoolsTest {
  // No setup/teardown needed - we're testing error cases

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
