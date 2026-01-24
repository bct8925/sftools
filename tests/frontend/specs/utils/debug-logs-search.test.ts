import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import {
    DebugLogsUserSearchScenario,
    DebugLogsTraceSuccessScenario,
} from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Debug Logs user search and trace flag enablement
 *
 * Test IDs: U-DL-F-002, U-DL-F-003
 * - U-DL-F-002: Search for other users - results dropdown shown
 * - U-DL-F-003: Enable trace flag for selected user - success status shown
 */
export default class DebugLogsSearchTest extends SftoolsTest {
    configureMocks() {
        const router = new MockRouter();
        router.usePreset(DebugLogsUserSearchScenario);
        router.usePreset(DebugLogsTraceSuccessScenario);
        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Utils tab
        await this.utilsTab.navigateTo();

        // Wait for tab to fully load
        await this.wait(500);

        // Search for user "john"
        await this.utilsTab.searchUsers('john');

        // Wait for user results to become visible
        await this.utilsTab.userResults.waitFor({ state: 'visible', timeout: 5000 });

        // Verify specific user is in the results
        const userItem = this.page.locator('debug-logs .tool-result-item', {
            has: this.page.locator('.tool-result-name', { hasText: 'John Developer' }),
        });
        await this.expect(await userItem.count()).toBeGreaterThan(0);

        // Select the user
        await this.utilsTab.selectUser('John Developer');

        // Get status after selection
        const status = await this.utilsTab.getDebugLogsStatus();

        // Verify success status is shown
        await this.expect(status.type).toBe('success');
        await this.expect(status.text).toContain('enabled');
    }
}
