import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test REST API keyboard shortcut execution
 *
 * Test IDs: R-F-008
 * - R-F-008: Execute REST API request via Ctrl/Cmd+Enter
 * @test R-F-008
 */
describe('REST API Keyboard Shortcut', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock POST to create Account
        router.onRestRequest('/sobjects/Account$', 'POST', {
            status: 201,
            data: {
                id: '001NEWRECORD0001',
                success: true,
                errors: [],
            },
        });

        await setupMocks(router);
    });

    it('R-F-008: executes REST API request via Ctrl/Cmd+Enter', async () => {
        const { page } = getTestContext();
        const { restApiTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to REST API tab
        await restApiTab.navigateTo();

        // Set method to POST
        await restApiTab.setMethod('POST');

        // Set endpoint to sobjects/Account
        await restApiTab.setEndpoint('/services/data/v62.0/sobjects/Account');

        // Set request body with account data
        const requestBody = JSON.stringify(
            {
                Name: 'Test Account',
            },
            null,
            2
        );
        await restApiTab.setRequestBody(requestBody);

        // Execute via Ctrl/Cmd+Enter keyboard shortcut
        await restApiTab.executeWithShortcut();

        // Verify request was successful
        const status = await restApiTab.getStatus();
        expect(status.type).toBe('success');

        // Verify response contains the created record ID
        const response = await restApiTab.getResponse();
        expect(response).toContain('"id"');
        expect(response).toContain('"success": true');
    });
});
