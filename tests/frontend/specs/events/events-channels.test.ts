import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { EventsChannelsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Events tab channel list loading
 *
 * Test ID: E-F-001
 * - E-F-001: Load channel list - grouped dropdown with Platform Events, PushTopics, System Topics
 */
export default class EventsChannelsTest extends SftoolsTest {
    configureMocks() {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        return router;
    }

    async setup(): Promise<void> {
        // No proxy mock needed - tests use extensionFetch with mocked routes
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Events tab
        await this.eventsTab.navigateTo();

        // Wait for channels to load
        await this.wait(1000);

        // Get channel options
        const channels = await this.eventsTab.getChannelOptions();

        // Verify we have channels
        await this.expect(channels.length).toBeGreaterThan(0);

        // Verify platform events are in the list
        await this.expect(channels).toInclude('/event/Order_Event__e');
        await this.expect(channels).toInclude('/event/Notification_Event__e');

        // Verify push topics are in the list
        await this.expect(channels).toInclude('/topic/AccountUpdates');
    }
}
