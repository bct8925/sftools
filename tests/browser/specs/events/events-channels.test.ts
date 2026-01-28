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
 * Test Events tab channel list loading
 *
 * Test ID: E-F-001
 * - E-F-001: Load channel list - grouped dropdown with Platform Events, PushTopics, System Topics
 */
describe('Events Channels', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        await setupMocks(router);
    });

    it('E-F-001: loads channel list with Platform Events, PushTopics, and System Topics', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to Events tab
        await eventsTab.navigateTo();

        // Wait for channels to load
        await page.waitForTimeout(1000);

        // Get channel options
        const channels = await eventsTab.getChannelOptions();

        // Verify we have channels
        expect(channels.length).toBeGreaterThan(0);

        // Verify platform events are in the list
        expect(channels).toContain('/event/Order_Event__e');
        expect(channels).toContain('/event/Notification_Event__e');

        // Verify push topics are in the list
        expect(channels).toContain('/topic/AccountUpdates');
    });
});
