import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test theme switching in Settings tab
 *
 * Test IDs: S-F-001, S-F-002, S-F-003
 * - S-F-001: Select System theme - Theme follows OS
 * - S-F-002: Select Light theme - Light mode applied
 * - S-F-003: Select Dark theme - Dark mode applied
 */
describe('Settings Theme', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        await setupMocks(router);
    });

    it('S-F-001, S-F-002, S-F-003: switches between system, light, and dark themes', async () => {
        const { page } = getTestContext();
        const { settingsTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to Settings tab
        await settingsTab.navigateTo();

        // Set theme to dark
        await settingsTab.setTheme('dark');

        // Verify document has data-theme="dark" attribute
        const darkThemeSet = await page.evaluate(() => {
            return document.documentElement.getAttribute('data-theme') === 'dark';
        });
        expect(darkThemeSet).toBe(true);

        // Set theme to light
        await settingsTab.setTheme('light');

        // Verify data-theme attribute is not present or is 'light'
        const lightThemeSet = await page.evaluate(() => {
            const themeAttr = document.documentElement.getAttribute('data-theme');
            return themeAttr === null || themeAttr === 'light';
        });
        expect(lightThemeSet).toBe(true);

        // Set theme back to system (default)
        await settingsTab.setTheme('system');

        // Verify system theme is selected
        const selectedTheme = await settingsTab.getSelectedTheme();
        expect(selectedTheme).toBe('system');
    });
});
