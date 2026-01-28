import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test REST API error handling
 *
 * Test IDs: R-F-009
 * - R-F-009: Error response received - Status badge shows error state
 */
describe('REST API Error Handling', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock error response for invalid endpoint
        router.onRestRequest('/invalid-endpoint', 'GET', {
            status: 404,
            data: [
                {
                    message: 'The requested resource does not exist',
                    errorCode: 'NOT_FOUND',
                },
            ],
        });

        await setupMocks(router);
    });

    it('R-F-009: displays error status when request fails', async () => {
        const { page } = getTestContext();
        const { restApiTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to REST API tab
        await restApiTab.navigateTo();

        // Set method to GET
        await restApiTab.setMethod('GET');

        // Set endpoint to invalid endpoint
        await restApiTab.setEndpoint('/services/data/v62.0/invalid-endpoint');

        // Send request
        await restApiTab.send();

        // Verify error status
        const status = await restApiTab.getStatus();
        expect(status.type).toBe('error');
    });
});
