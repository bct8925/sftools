import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Apex compilation error handling
 */
export default class ApexErrorsTest extends SftoolsTest {
  // No setup/teardown needed

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Set code with syntax error (undefined variable)
    const invalidCode = `System.debug(undefinedVariable);`;
    await this.apexTab.setCode(invalidCode);

    // Execute
    await this.apexTab.execute();

    // Verify status indicates failure (Compile Error or Error)
    const status = await this.apexTab.getStatus();
    await this.expect(status.success).toBe(false);

    // Status text should indicate compile error
    await this.expect(status.text).toContain('Error');
  }
}
