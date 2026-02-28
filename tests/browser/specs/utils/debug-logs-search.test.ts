import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';
import {
    DebugLogsUserSearchScenario,
    DebugLogsTraceSuccessScenario,
} from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Debug Logs user search and trace flag enablement
 * NOTE: These operations moved from Utils tab to Debug Logs tab Settings modal
 *
 * Test IDs: DL-F-007, DL-F-008
 * - DL-F-007: Search for other users - results dropdown shown
 * - DL-F-008: Enable trace flag for selected user - success status shown
 */
describe('Debug Logs User Search', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.usePreset(DebugLogsUserSearchScenario);
        router.usePreset(DebugLogsTraceSuccessScenario);
        await setupMocks(router);
    });

    it('searches for users and enables trace flag', async () => {
        const { page } = getTestContext();
        const { debugLogsTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Debug Logs tab
        await debugLogsTab.navigateTo();

        // Open settings modal
        await debugLogsTab.openSettings();

        // Wait for modal to fully load
        await page.waitForTimeout(500);

        // Search for user "john"
        const userSearchInput = page.locator('[data-testid="debug-logs-user-search"]');
        await userSearchInput.fill('john');
        await page.waitForTimeout(300);

        // Wait for user results to become visible
        const userResults = page.locator('[data-testid="debug-logs-user-results"]');
        await userResults.waitFor({ state: 'visible', timeout: 5000 });

        // Verify specific user is in the results
        const userItem = page.locator('[data-testid="debug-logs-user-results"] .search-box-item', {
            has: page.locator('.search-box-item-name', { hasText: 'John Developer' }),
        });
        const userCount = await userItem.count();
        expect(userCount).toBeGreaterThan(0);

        // Select the user
        await userItem.first().click();
        await page.waitForTimeout(500);

        // Verify success status is shown
        const statusText = page.locator('[role="alert"][data-type="success"]');
        await statusText.waitFor({ state: 'visible', timeout: 5000 });
        const status = await statusText.textContent();
        expect(status || '').toContain('enabled');
    });
});
