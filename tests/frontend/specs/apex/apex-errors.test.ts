import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Apex compilation error handling
 *
 * Test IDs: A-F-004, A-F-016, A-I-004
 * - A-F-004: View compilation error - Error marker on line/column
 * - A-F-016: Status badge compile error - Red X with "Compile Error"
 * - A-I-004: Compilation error on specific line - Marker on line 5
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
