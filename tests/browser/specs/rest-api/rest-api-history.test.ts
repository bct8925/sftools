import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test REST API history functionality
 *
 * Test IDs: R-F-010, R-F-011, R-F-012
 * - R-F-010: Send a REST request and verify it appears in history
 * - R-F-011: Load a request from history and verify it restores the URL input
 * - R-F-012: Delete a request from history and verify removal
 */
describe('REST API History (R-F-010, R-F-011, R-F-012)', () => {
    const testEndpoint = '/services/data/v62.0/limits';

    beforeEach(async () => {
        const router = new MockRouter();

        router.onRestRequest('/limits$', 'GET', {
            status: 200,
            data: {
                ActiveScratchOrgs: { Max: 3, Remaining: 3 },
                DailyApiRequests: { Max: 15000, Remaining: 14999 },
            },
        });

        await setupMocks(router);
    });

    it('can save to, load from, and delete from history', async () => {
        const { page } = getTestContext();
        const { restApiTab } = createPageObjects(page);

        await navigateToExtension();
        await restApiTab.navigateTo();

        // Send a request to add it to history
        await restApiTab.setEndpoint(testEndpoint);
        await restApiTab.setMethod('GET');
        await restApiTab.send();

        const status = await restApiTab.getStatus();
        expect(status.type).toBe('success');

        // R-F-010: Verify request appears in history
        await restApiTab.openHistory();
        const historyCount = await restApiTab.getHistoryCount();
        expect(historyCount).toBeGreaterThan(0);

        const historyItems = await restApiTab.getHistoryItems();
        expect(historyItems[0]).toContain('/limits');

        await restApiTab.closeHistory();

        // Change endpoint to something different
        await restApiTab.setEndpoint('/services/data/v62.0/sobjects');

        // R-F-011: Load from history and verify URL is restored
        await restApiTab.loadFromHistory(0);

        const restoredEndpoint = await restApiTab.getEndpoint();
        expect(restoredEndpoint).toBe(testEndpoint);

        // R-F-012: Delete from history and verify removal
        await restApiTab.openHistory();
        const beforeDeleteCount = await restApiTab.getHistoryCount();

        await restApiTab.closeHistory();
        await restApiTab.deleteFromHistory(0);

        await restApiTab.closeHistory();
        await restApiTab.openHistory();
        const afterDeleteCount = await restApiTab.getHistoryCount();
        expect(afterDeleteCount).toBe(beforeDeleteCount - 1);

        await restApiTab.closeHistory();
    });
});
