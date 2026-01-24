import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { EventsChannelsScenario } from '../../../shared/mocks/mock-scenarios.js';

/**
 * Test Events tab replay options
 *
 * Test IDs:
 * - E-F-007: Select replay option LATEST - default selected
 * - E-F-008: Select replay option EARLIEST - option changes
 * - E-F-009: Enter custom replay ID - input shown when CUSTOM selected
 */
export default class EventsReplayTest extends SftoolsTest {
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

        // Wait for tab to load
        await this.wait(1000);

        // Test E-F-007: Select replay option LATEST - default selected
        const replayOptions = await this.eventsTab.getReplayOptions();
        await this.expect(replayOptions.length).toBeGreaterThanOrEqual(3);
        await this.expect(replayOptions).toInclude('LATEST');
        await this.expect(replayOptions).toInclude('EARLIEST');
        await this.expect(replayOptions).toInclude('CUSTOM');

        const defaultSelected = await this.eventsTab.getSelectedReplayOption();
        await this.expect(defaultSelected).toBe('LATEST');

        // Test E-F-008: Select replay option EARLIEST - option changes
        await this.eventsTab.selectReplayOption('EARLIEST');
        const selectedEarliest = await this.eventsTab.getSelectedReplayOption();
        await this.expect(selectedEarliest).toBe('EARLIEST');

        // Switch back to LATEST
        await this.eventsTab.selectReplayOption('LATEST');
        const selectedLatest = await this.eventsTab.getSelectedReplayOption();
        await this.expect(selectedLatest).toBe('LATEST');

        // Test E-F-009: Enter custom replay ID - input shown when CUSTOM selected
        // Custom input should not be visible when LATEST is selected
        let isInputVisible = await this.eventsTab.isReplayIdInputVisible();
        await this.expect(isInputVisible).toBe(false);

        // Select CUSTOM option
        await this.eventsTab.selectReplayOption('CUSTOM');
        const selectedCustom = await this.eventsTab.getSelectedReplayOption();
        await this.expect(selectedCustom).toBe('CUSTOM');

        // Custom input should now be visible
        isInputVisible = await this.eventsTab.isReplayIdInputVisible();
        await this.expect(isInputVisible).toBe(true);

        // Set a custom replay ID
        const customReplayId = '1234567890';
        await this.eventsTab.setReplayId(customReplayId);

        // Verify the input was set (read back value)
        const inputValue = await this.eventsTab.replayIdInput.inputValue();
        await this.expect(inputValue).toBe(customReplayId);

        // Verify input disappears when switching away from CUSTOM
        await this.eventsTab.selectReplayOption('EARLIEST');
        isInputVisible = await this.eventsTab.isReplayIdInputVisible();
        await this.expect(isInputVisible).toBe(false);
    }
}
