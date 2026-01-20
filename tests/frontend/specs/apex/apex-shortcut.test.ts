import { SftoolsTest } from '../../framework/base-test';

/**
 * Test Anonymous Apex execution via keyboard shortcut
 *
 * @test A-F-002
 * Test ID: A-F-002
 * Description: Execute Apex via Ctrl/Cmd+Enter - Executes successfully
 */
export default class ApexShortcutTest extends SftoolsTest {
  // No setup/teardown needed - just executing Apex

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Apex tab
    await this.apexTab.navigateTo();

    // Set simple Apex code
    const apexCode = `
      System.debug('Executed via keyboard shortcut');
      Integer x = 100;
      System.debug('Result: ' + x);
    `;
    await this.apexTab.setCode(apexCode);

    // Execute using Ctrl/Cmd+Enter
    await this.apexTab.executeWithShortcut();

    // Verify success
    const status = await this.apexTab.getStatus();
    await this.expect(status.success).toBe(true);

    // Verify debug log contains our output
    const logContent = await this.apexTab.getLogContent();
    await this.expect(logContent).toContain('Executed via keyboard shortcut');
    await this.expect(logContent).toContain('Result: 100');
  }
}
