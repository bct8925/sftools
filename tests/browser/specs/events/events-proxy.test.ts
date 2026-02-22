import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';
import { EventsChannelsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Events tab proxy connection status
 *
 * Test ID: E-F-014
 * - E-F-014: Proxy not connected - tab disabled with overlay
 */
describe('Events Proxy Connection', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        await setupMocks(router);
    });

    it('E-F-014: disables Events tab when proxy is not connected', async () => {
        const { page } = getTestContext();

        // Set proxy to disconnected before navigation
        await page.addInitScript(() => {
            window.__testProxyConnected = false;
        });

        await navigateToExtension();

        // Verify Events tile is disabled on home screen when proxy is not connected
        const eventsTile = page.locator('[data-testid="tile-events"]');
        await eventsTile.waitFor({ state: 'visible', timeout: 5000 });
        const isDisabled = await eventsTile.isDisabled();
        expect(isDisabled).toBe(true);
    });
});
