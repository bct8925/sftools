import { SftoolsTest } from '../../framework/base-test';

/**
 * Test enabling trace flag for current user via Utils tab
 *
 * Test IDs: U-DL-F-001, U-DL-F-007
 * - U-DL-F-001: Enable trace flag for current user - Success status
 * - U-DL-F-007: Status indicator success - Green check
 */
export default class UtilsDebugLogsEnableTest extends SftoolsTest {
  async setup(): Promise<void> {
    // Delete any existing trace flags to ensure clean test
    await this.salesforce.deleteAllTraceFlags();
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Utils tab
    await this.utilsTab.navigateTo();

    // Enable trace flag for current user
    await this.utilsTab.enableTraceFlagForSelf();

    // Verify status indicates success
    const statusText = await this.utilsTab.getTraceStatus();
    const statusType = await this.utilsTab.getTraceStatusType();

    await this.expect(statusType).toBe('success');
    await this.expect(statusText).toContain('enabled');
  }
}
