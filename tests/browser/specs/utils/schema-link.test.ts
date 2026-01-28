import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Schema Browser link in Utils tab
 *
 * Test ID: U-SB-F-001
 * - U-SB-F-001: Click link - opens Schema Browser in new tab
 */
describe('Schema Browser Link', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        await setupMocks(router);
    });

    it('opens Schema Browser in new tab when clicked', async () => {
        const { page, context } = getTestContext();
        const { utilsTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Utils tab
        await utilsTab.navigateTo();

        // Listen for popup window opening
        const popupPromise = context.waitForEvent('page');

        // Click the Schema Browser link
        await utilsTab.clickSchemaBrowserLink();

        // Wait for new page/tab to open
        const newPage = await popupPromise;
        await newPage.waitForLoadState('networkidle');

        // Verify the URL contains schema browser path and connectionId
        // In headless mode, URL is /pages/schema/schema.html (no /dist prefix)
        const url = newPage.url();
        expect(url).toContain('/pages/schema/schema.html');
        expect(url).toContain('connectionId=');

        // Close the new page
        await newPage.close();
    });
});
