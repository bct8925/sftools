import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Tooling API mode
 */
export default class QueryToolingTest extends SftoolsTest {
  // No setup/teardown needed - querying system metadata

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Query tab
    await this.queryTab.navigateTo();

    // Enable Tooling API mode
    await this.queryTab.setToolingMode(true);

    // Execute query against Tooling API
    const query = 'SELECT Id, Name FROM ApexClass LIMIT 1';
    await this.queryTab.executeQuery(query);

    // Verify success status
    const status = await this.queryTab.getStatus();
    await this.expect(status.type).toBe('success');

    // Verify results count >= 1
    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBeGreaterThanOrEqual(1);
  }
}
