import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';
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
describe('Flow Cleanup', () => {
    beforeEach(async () => {
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
                    { httpStatusCode: 204, referenceId: 'version2' },
                ],
            },
        });

        await setupMocks(router);
    });

    it('searches flows, selects flow, views version count, and deletes inactive versions', async () => {
        const { page } = getTestContext();
        const { utilsTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Utils tab
        await utilsTab.navigateTo();
        await page.waitForTimeout(500);

        // U-FC-F-001: Search flows by API name - results displayed
        await utilsTab.searchFlows('Order');

        // Verify dropdown is visible (indicates results are shown)
        const dropdownVisible = await utilsTab.flowSearchDropdown.isVisible();
        expect(dropdownVisible).toBe(true);

        // U-FC-F-002: Select flow - versions panel shows
        await utilsTab.selectFlow('Order_Approval_Flow');

        // Wait for versions section to load
        await page.waitForTimeout(1000);

        // Verify versions section is visible
        const versionsVisible = await utilsTab.flowVersionsSection.isVisible();
        expect(versionsVisible).toBe(true);

        // U-FC-F-003: View version count - total and inactive count shown
        const versions = await utilsTab.getFlowVersions();
        expect(versions.length).toBeGreaterThan(0);

        // Verify the info text contains version count information
        const infoText = versions.join(' ');
        expect(infoText).toContain('3'); // Total of 3 versions
        expect(infoText).toContain('version');
        expect(infoText).toContain('2'); // 2 inactive versions
        expect(infoText).toContain('Inactive');

        // U-FC-F-004: Active version highlighted - visual distinction
        // The active version (Version 3) should be mentioned in the info text
        expect(infoText).toContain('Active version: 3');

        // U-FC-F-005: Delete inactive versions - confirmation, deletion success
        // Set up dialog handler to accept the confirmation
        page.once('dialog', async dialog => {
            expect(dialog.type()).toBe('confirm');
            expect(dialog.message()).toContain('Delete');
            await dialog.accept();
        });

        await utilsTab.deleteInactiveVersions();

        // Wait for delete to complete
        await page.waitForTimeout(1000);

        // Verify success status
        const status = await utilsTab.getFlowCleanupStatus();
        expect(status.type).toBe('success');
        // The status text should contain "Deleted" and the count
        const statusLower = status.text.toLowerCase();
        const containsDeleted = statusLower.includes('deleted') || statusLower.includes('success');
        expect(containsDeleted).toBe(true);
    });
});
