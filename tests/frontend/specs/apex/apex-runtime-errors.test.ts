import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Apex runtime exception handling
 */
export default class ApexRuntimeErrorsTest extends SftoolsTest {
  // No setup/teardown needed

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Set code that causes runtime exception (divide by zero)
    const runtimeErrorCode = `Integer x = 1/0;`;
    await this.apexTab.setCode(runtimeErrorCode);

    // Execute
    await this.apexTab.execute();

    // Note: Compilation succeeds but runtime fails
    // Get log content to verify exception was logged
    const logContent = await this.apexTab.getLogContent();

    // Verify log contains the exception
    const containsMathException = logContent.includes('System.MathException') ||
                                   logContent.includes('Divide by 0');
    await this.expect(containsMathException).toBe(true);
  }
}
