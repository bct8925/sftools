import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import {
    DebugLogsUserSearchScenario,
    DebugLogsTraceSuccessScenario,
} from '../../../shared/mocks/mock-scenarios.js';
import { DebugLogsTabPage } from '../../pages/debug-logs-tab.page';

/**
 * Test Debug Logs user search and trace flag enablement
 * NOTE: These operations moved from Utils tab to Debug Logs tab Settings modal
 *
 * Test IDs: DL-F-007, DL-F-008
 * - DL-F-007: Search for other users - results dropdown shown
 * - DL-F-008: Enable trace flag for selected user - success status shown
 */
export default class DebugLogsSearchTest extends SftoolsTest {
    debugLogsTab!: DebugLogsTabPage;

    configureMocks() {
        const router = new MockRouter();
        router.usePreset(DebugLogsUserSearchScenario);
        router.usePreset(DebugLogsTraceSuccessScenario);
        return router;
    }

    async setup(): Promise<void> {
        this.debugLogsTab = new DebugLogsTabPage(this.page);
        this.debugLogsTab.setConfig(this.config);
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Debug Logs tab
        await this.debugLogsTab.navigateTo();

        // Open settings modal
        await this.debugLogsTab.openSettings();

        // Wait for modal to fully load
        await this.wait(500);

        // Search for user "john"
        const userSearchInput = this.page.locator('[data-testid="debug-logs-user-search"]');
        await userSearchInput.fill('john');
        await this.wait(300);

        // Wait for user results to become visible
        const userResults = this.page.locator('[data-testid="debug-logs-user-results"]');
        await userResults.waitFor({ state: 'visible', timeout: 5000 });

        // Verify specific user is in the results
        const userItem = this.page.locator(
            '[data-testid="debug-logs-user-results"] .search-box-item',
            {
                has: this.page.locator('.search-box-item-name', { hasText: 'John Developer' }),
            }
        );
        const userCount = await userItem.count();
        await this.expect(userCount).toBeGreaterThan(0);

        // Select the user
        await userItem.first().click();
        await this.wait(500);

        // Verify success status is shown
        const statusText = this.page.locator('[data-testid="debug-logs-trace-status-text"]');
        await statusText.waitFor({ state: 'visible', timeout: 5000 });
        const status = await statusText.textContent();
        await this.expect(status || '').toContain('enabled');
    }
}
