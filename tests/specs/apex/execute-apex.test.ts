import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Anonymous Apex execution
 */
export default class ExecuteApexTest extends SftoolsTest {
  // No setup/teardown needed - just executing Apex

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Set simple Apex code
    const apexCode = `
      System.debug('Hello from Playwright test');
      Integer x = 42;
      System.debug('The answer is: ' + x);
    `;
    await this.apexTab.setCode(apexCode);

    // Execute
    await this.apexTab.execute();

    // Verify success
    const status = await this.apexTab.getStatus();
    await this.expect(status.success).toBe(true);

    // Verify debug log contains our output
    const logContent = await this.apexTab.getLogContent();
    await this.expect(logContent).toContain('Hello from Playwright test');
    await this.expect(logContent).toContain('The answer is: 42');
  }
}
