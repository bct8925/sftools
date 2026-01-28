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

        // Open hamburger menu
        await page.locator('[data-testid="hamburger-btn"]').click();
        const navItem = page.locator('[data-testid="mobile-nav-events"]');
        await navItem.waitFor({ state: 'visible', timeout: 5000 });

        // Verify Events nav item is disabled when proxy is not connected
        const isDisabled = await navItem.isDisabled();
        expect(isDisabled).toBe(true);
    });
});
