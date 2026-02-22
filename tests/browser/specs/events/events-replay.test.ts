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
 * Test Events tab replay options
 *
 * Test IDs:
 * - E-F-007: Select replay option LATEST - default selected
 * - E-F-008: Select replay option EARLIEST - option changes
 * - E-F-009: Enter custom replay ID - input shown when CUSTOM selected
 */
describe('Events Replay Options', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.usePreset(EventsChannelsScenario);
        await setupMocks(router);
    });

    it('E-F-007, E-F-008, E-F-009: manages replay options correctly', async () => {
        const { page } = getTestContext();
        const { eventsTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to Events tab
        await eventsTab.navigateTo();

        // Wait for tab to load
        await page.waitForTimeout(1000);

        // Open settings modal where replay options live
        await eventsTab.openSettings();

        // Test E-F-007: Select replay option LATEST - default selected
        const replayOptions = await eventsTab.getReplayOptions();
        expect(replayOptions.length).toBeGreaterThanOrEqual(3);
        expect(replayOptions).toContain('LATEST');
        expect(replayOptions).toContain('EARLIEST');
        expect(replayOptions).toContain('CUSTOM');

        const defaultSelected = await eventsTab.getSelectedReplayOption();
        expect(defaultSelected).toBe('LATEST');

        // Test E-F-008: Select replay option EARLIEST - option changes
        await eventsTab.selectReplayOption('EARLIEST');
        const selectedEarliest = await eventsTab.getSelectedReplayOption();
        expect(selectedEarliest).toBe('EARLIEST');

        // Switch back to LATEST
        await eventsTab.selectReplayOption('LATEST');
        const selectedLatest = await eventsTab.getSelectedReplayOption();
        expect(selectedLatest).toBe('LATEST');

        // Test E-F-009: Enter custom replay ID - input shown when CUSTOM selected
        // Custom input should not be visible when LATEST is selected
        let isInputVisible = await eventsTab.isReplayIdInputVisible();
        expect(isInputVisible).toBe(false);

        // Select CUSTOM option
        await eventsTab.selectReplayOption('CUSTOM');
        const selectedCustom = await eventsTab.getSelectedReplayOption();
        expect(selectedCustom).toBe('CUSTOM');

        // Custom input should now be visible
        isInputVisible = await eventsTab.isReplayIdInputVisible();
        expect(isInputVisible).toBe(true);

        // Set a custom replay ID
        const customReplayId = '1234567890';
        await eventsTab.setReplayId(customReplayId);

        // Verify the input was set (read back value)
        const inputValue = await eventsTab.replayIdInput.inputValue();
        expect(inputValue).toBe(customReplayId);

        // Verify input disappears when switching away from CUSTOM
        await eventsTab.selectReplayOption('EARLIEST');
        isInputVisible = await eventsTab.isReplayIdInputVisible();
        expect(isInputVisible).toBe(false);
    });
});
