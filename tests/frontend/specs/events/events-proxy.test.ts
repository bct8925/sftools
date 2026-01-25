import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { EventsChannelsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Events tab proxy connection status
 *
 * Test ID: E-F-014
 * - E-F-014: Proxy not connected - tab disabled with overlay
 */
export default class EventsProxyTest extends SftoolsTest {
    configureMocks() {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        return router;
    }

    async setup(): Promise<void> {
        // Set proxy status to disconnected for this test
        // This test verifies the "proxy not connected" overlay behavior
    }

    async test(): Promise<void> {
        // Set proxy to disconnected before navigation
        await this.page.addInitScript(() => {
            window.__testProxyConnected = false;
        });

        // Navigate to extension
        await this.navigateToExtension();

        // Open hamburger menu
        await this.page.locator('[data-testid="hamburger-btn"]').click();
        const navItem = this.page.locator('[data-testid="mobile-nav-events"]');
        await navItem.waitFor({ state: 'visible', timeout: 5000 });

        // Verify Events nav item is disabled when proxy is not connected
        const isDisabled = await navItem.isDisabled();
        await this.expect(isDisabled).toBe(true);
    }
}
