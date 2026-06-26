import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Apex debug log panel collapse behavior
 *
 * Test IDs: A-F-020
 * - A-F-020: Debug Log panel is collapsed by default and auto-expands on execution
 */
describe('Apex Debug Log Collapse (A-F-020)', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.onApexExecute(true, true, 'USER_DEBUG|[1]|DEBUG|Hello from Anonymous Apex!');
        await setupMocks(router);
    });

    it('A-F-020: debug log is collapsed by default and auto-expands on execution', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        await navigateToExtension();
        await apexTab.navigateTo();

        // Collapsed on first load for a clean view
        expect(await apexTab.isOutputCollapsed()).toBe(true);

        // Executing reveals the debug log panel
        await apexTab.setCode(`System.debug('Hello from Anonymous Apex!');`);
        await apexTab.execute();
        expect(await apexTab.isOutputCollapsed()).toBe(false);
    });
});
