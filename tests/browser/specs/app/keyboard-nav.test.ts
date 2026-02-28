/**
 * Global Keyboard Navigation Tests
 *
 * Test IDs: KN-F-001 through KN-F-006
 * - KN-F-001: Alt+1 navigates to Query tab from home screen
 * - KN-F-002: Alt+2 navigates to Apex tab from home screen
 * - KN-F-003: Alt+0 navigates to home from a feature tab
 * - KN-F-004: Alt+2 switches directly from Query tab to Apex tab
 * - KN-F-005: Alt+8 navigates to Settings tab
 * - KN-F-006: Shortcut is suppressed when an input is focused
 */

import { describe, it, beforeEach, expect } from 'vitest';
import { getTestContext, setupMocks, navigateToExtension, MockRouter } from '../../test-utils';

describe('Global Keyboard Navigation', () => {
    beforeEach(async () => {
        // Set up empty mock router — shortcuts don't make API calls,
        // but tab components may attempt requests on mount
        const router = new MockRouter();
        await setupMocks(router);
    });

    it('KN-F-001: Alt+1 navigates to Query tab from home screen', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        // Verify on home screen
        expect(await page.locator('[data-testid="home-screen"]').isVisible()).toBe(true);

        // Press Alt+1 to navigate to Query
        await page.keyboard.press('Alt+1');

        // Query tab content should become visible
        await page
            .locator('[data-testid="tab-content-query"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="tab-content-query"]').isVisible()).toBe(true);

        // Home screen should be gone
        expect(await page.locator('[data-testid="home-screen"]').isVisible()).toBe(false);
    });

    it('KN-F-002: Alt+2 navigates to Apex tab from home screen', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        await page.keyboard.press('Alt+2');

        await page
            .locator('[data-testid="tab-content-apex"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="tab-content-apex"]').isVisible()).toBe(true);
    });

    it('KN-F-003: Alt+0 navigates to home from a feature tab', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        // First navigate to Query via shortcut
        await page.keyboard.press('Alt+1');
        await page
            .locator('[data-testid="tab-content-query"]')
            .waitFor({ state: 'visible', timeout: 3000 });

        // Now press Alt+0 to go back home
        await page.keyboard.press('Alt+0');

        // Home screen should be visible again
        await page
            .locator('[data-testid="home-screen"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="home-screen"]').isVisible()).toBe(true);
    });

    it('KN-F-004: Alt+2 switches directly from Query tab to Apex tab', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        // Navigate to Query first
        await page.keyboard.press('Alt+1');
        await page
            .locator('[data-testid="tab-content-query"]')
            .waitFor({ state: 'visible', timeout: 3000 });

        // Now switch directly to Apex via shortcut (no need to go home first)
        await page.keyboard.press('Alt+2');

        await page
            .locator('[data-testid="tab-content-apex"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="tab-content-apex"]').isVisible()).toBe(true);
        expect(await page.locator('[data-testid="tab-content-query"]').isVisible()).toBe(false);
    });

    it('KN-F-005: Alt+8 navigates to Settings tab', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        await page.keyboard.press('Alt+8');

        await page
            .locator('[data-testid="tab-content-settings"]')
            .waitFor({ state: 'visible', timeout: 3000 });
        expect(await page.locator('[data-testid="tab-content-settings"]').isVisible()).toBe(true);
    });

    it('KN-F-006: shortcut is suppressed when an input is focused', async () => {
        const { page } = getTestContext();

        await navigateToExtension();

        // Navigate to Query tab first (it has input elements)
        await page.keyboard.press('Alt+1');
        await page
            .locator('[data-testid="tab-content-query"]')
            .waitFor({ state: 'visible', timeout: 3000 });

        // Focus the search input inside the query tab
        const searchInput = page.locator('[data-testid="query-search-input"]');
        if (await searchInput.isVisible()) {
            await searchInput.focus();

            // Press Alt+2 while input is focused — should NOT navigate
            await page.keyboard.press('Alt+2');

            // Query tab should still be visible (not switched to Apex)
            expect(await page.locator('[data-testid="tab-content-query"]').isVisible()).toBe(true);
            expect(await page.locator('[data-testid="tab-content-apex"]').isVisible()).toBe(false);
        }
    });
});
