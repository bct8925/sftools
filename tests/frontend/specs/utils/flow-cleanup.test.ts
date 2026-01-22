import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { FlowSearchScenario, FlowVersionsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Flow Cleanup utility in Utils tab
 *
 * Test IDs:
 * - U-FC-F-001: Search flows by API name - results displayed
 * - U-FC-F-002: Select flow - versions panel shows
 * - U-FC-F-003: View version count - total and inactive count shown
 * - U-FC-F-004: Active version highlighted - visual distinction
 * - U-FC-F-005: Delete inactive versions - confirmation, deletion success
 */
export default class FlowCleanupTest extends SftoolsTest {
  configureMocks() {
    const router = new MockRouter();

    // Load flow search and versions scenarios
    router.usePreset(FlowSearchScenario);
    router.usePreset(FlowVersionsScenario);

    // Add mock for delete operation
    router.addRoute({
      pattern: /\/tooling\/composite/,
      method: 'POST',
      response: {
        compositeResponse: [
          { httpStatusCode: 204, referenceId: 'version1' },
          { httpStatusCode: 204, referenceId: 'version2' }
        ]
      }
    });

    return router;
  }

  async test(): Promise<void> {
    // Navigate to extension
    await this.navigateToExtension();

    // Navigate to Utils tab
    await this.utilsTab.navigateTo();
    await this.wait(500);

    // U-FC-F-001: Search flows by API name - results displayed
    await this.utilsTab.searchFlows('Order');

    // Verify dropdown is visible (indicates results are shown)
    const dropdownVisible = await this.utilsTab.flowSearchDropdown.isVisible();
    await this.expect(dropdownVisible).toBe(true);

    // U-FC-F-002: Select flow - versions panel shows
    await this.utilsTab.selectFlow('Order_Approval_Flow');

    // Verify versions section is visible
    const versionsVisible = await this.utilsTab.flowVersionsSection.isVisible();
    await this.expect(versionsVisible).toBe(true);

    // U-FC-F-003: View version count - total and inactive count shown
    const versions = await this.utilsTab.getFlowVersions();
    await this.expect(versions.length).toBeGreaterThan(0);

    // Verify the info text contains version count information
    const infoText = versions.join(' ');
    await this.expect(infoText).toContain('3'); // Total of 3 versions
    await this.expect(infoText).toContain('version');
    await this.expect(infoText).toContain('2'); // 2 inactive versions
    await this.expect(infoText).toContain('Inactive');

    // U-FC-F-004: Active version highlighted - visual distinction
    // The active version (Version 3) should be mentioned in the info text
    await this.expect(infoText).toContain('Active version: 3');

    // U-FC-F-005: Delete inactive versions - confirmation, deletion success
    // Set up dialog handler to accept the confirmation
    this.page.once('dialog', async (dialog) => {
      await this.expect(dialog.type()).toBe('confirm');
      await this.expect(dialog.message()).toContain('Delete');
      await dialog.accept();
    });

    await this.utilsTab.deleteInactiveVersions();

    // Wait for delete to complete
    await this.wait(1000);

    // Verify success status
    const status = await this.utilsTab.getFlowCleanupStatus();
    await this.expect(status.type).toBe('success');
    // The status text should contain "Deleted" and the count
    const statusLower = status.text.toLowerCase();
    const containsDeleted = statusLower.includes('deleted') || statusLower.includes('success');
    await this.expect(containsDeleted).toBe(true);
  }
}
