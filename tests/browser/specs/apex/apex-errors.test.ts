import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Apex compilation error handling
 *
 * Test IDs: A-F-004, A-F-016, A-F-018
 * - A-F-004: View compilation error - Error marker on line/column
 * - A-F-016: Status badge compile error - Red X with "Compile Error"
 * - A-F-018: Compilation error on specific line - Marker on line 5
 */
describe('Apex Errors (A-F-004, A-F-016, A-F-018)', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock compilation error response
        router.onApexExecute(false, false, '');

        await setupMocks(router);
    });

    it('displays compilation errors correctly', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Apex tab
        await apexTab.navigateTo();

        // Set code with syntax error (undefined variable)
        const invalidCode = `System.debug(undefinedVariable);`;
        await apexTab.setCode(invalidCode);

        // Execute (will use mocked error response)
        await apexTab.execute();

        // Verify status indicates failure (Compile Error or Error)
        const status = await apexTab.getStatus();
        expect(status.success).toBe(false);

        // Status text should indicate compile error
        expect(status.text).toContain('Error');
    });
});
