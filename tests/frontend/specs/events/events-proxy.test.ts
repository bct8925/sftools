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
        // DO NOT mock proxy connection in setup() - this test needs proxy to be disconnected
        // The tab should show an overlay indicating the proxy is not connected
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Events tab
        await this.eventsTab.navigateTo();

        // Wait for tab to render and check for overlay
        await this.wait(1000);

        // Verify tab overlay is visible (feature gating overlay when proxy not connected)
        await this.expect(await this.eventsTab.isTabDisabled()).toBe(true);
    }
}
