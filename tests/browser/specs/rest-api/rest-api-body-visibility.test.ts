import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test REST API body editor visibility based on HTTP method
 *
 * Test IDs: R-F-006, R-F-007
 * - R-F-006: Body editor visible for POST/PATCH/PUT
 * - R-F-007: Body editor hidden for GET/DELETE
 */
describe('REST API Body Visibility', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        await setupMocks(router);
    });

    it('R-F-006, R-F-007: shows/hides body editor based on HTTP method', async () => {
        const { page } = getTestContext();
        const { restApiTab } = createPageObjects(page);

        await navigateToExtension();

        // Navigate to REST API tab
        await restApiTab.navigateTo();

        // Test R-F-006: Body editor visible for POST/PATCH/PUT
        await restApiTab.setMethod('POST');
        let isVisible = await restApiTab.isBodyEditorVisible();
        expect(isVisible).toBe(true);

        await restApiTab.setMethod('PATCH');
        isVisible = await restApiTab.isBodyEditorVisible();
        expect(isVisible).toBe(true);

        // Test R-F-007: Body editor hidden for GET/DELETE
        await restApiTab.setMethod('GET');
        isVisible = await restApiTab.isBodyEditorVisible();
        expect(isVisible).toBe(false);

        await restApiTab.setMethod('DELETE');
        isVisible = await restApiTab.isBodyEditorVisible();
        expect(isVisible).toBe(false);
    });
});
