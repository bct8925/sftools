import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
    wait,
} from '../../test-utils';

/**
 * Test debug log filtering
 *
 * Test IDs: A-F-006, A-F-007
 * - A-F-006: Filter debug log - Search filters visible lines
 * - A-F-007: Clear debug log filter - All lines visible again
 */
describe('Apex Log Filter', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock successful Apex execution with multi-line debug log
        const mockLog = `USER_DEBUG|[1]|DEBUG|First debug message
USER_DEBUG|[2]|DEBUG|Second debug message
USER_DEBUG|[3]|DEBUG|Third debug message with UNIQUE keyword
USER_DEBUG|[4]|DEBUG|Fourth debug message
USER_DEBUG|[6]|DEBUG|Calculation result: 30`;

        router.onApexExecute(true, true, mockLog);

        // Mock ApexLog query (returns the log record metadata)
        // Use pattern that matches the full tooling query path
        router.addRoute(
            /\/services\/data\/v[\d.]+\/tooling\/query.*ApexLog/,
            {
                done: true,
                totalSize: 1,
                records: [
                    {
                        Id: '07LMOCKLOG002',
                        LogLength: 500,
                        Status: 'Success',
                    },
                ],
            },
            'GET'
        );

        // Mock ApexLog body retrieval (returns the actual log content as plain text)
        // Use pattern that matches any ApexLog ID
        router.addRoute(
            /\/tooling\/sobjects\/ApexLog\/.*\/Body/,
            {
                data: mockLog,
                contentType: 'text/plain',
            },
            'GET'
        );

        await setupMocks(router);
    });

    it('can filter and clear log content', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Apex tab
        await apexTab.navigateTo();

        // Set Apex code with multiple distinct debug statements
        const apexCode = `
      System.debug('First debug message');
      System.debug('Second debug message');
      System.debug('Third debug message with UNIQUE keyword');
      System.debug('Fourth debug message');
      Integer result = 10 + 20;
      System.debug('Calculation result: ' + result);
    `;
        await apexTab.setCode(apexCode);

        // Execute (will use mocked response)
        await apexTab.execute();

        // Wait for log fetch to complete (state update may be async)
        await wait(1000);

        // Verify execution succeeded
        const status = await apexTab.getStatus();
        expect(status.success).toBe(true);

        // Get full debug log content
        const fullLogContent = await apexTab.getLogContent();

        // Verify all debug statements are in the log
        expect(fullLogContent).toContain('First debug message');
        expect(fullLogContent).toContain('Second debug message');
        expect(fullLogContent).toContain('UNIQUE keyword');
        expect(fullLogContent).toContain('Fourth debug message');
        expect(fullLogContent).toContain('Calculation result: 30');

        // Count total lines
        const totalLines = fullLogContent.split('\n').length;

        // Test A-F-006: Filter debug log
        // Filter by a unique keyword that appears in only one line
        await apexTab.filterLog('UNIQUE');

        // Get filtered content
        const filteredContent = await apexTab.getLogContent();
        const filteredLines = filteredContent.split('\n').length;

        // Verify filtered content contains the matching line
        expect(filteredContent).toContain('UNIQUE keyword');

        // Verify filtered content does NOT contain non-matching lines
        expect(filteredContent).not.toContain('First debug message');
        expect(filteredContent).not.toContain('Second debug message');
        expect(filteredContent).not.toContain('Fourth debug message');

        // Verify fewer lines after filtering
        expect(filteredLines).toBeLessThan(totalLines);

        // Test A-F-007: Clear debug log filter
        await apexTab.clearLogFilter();

        // Get content after clearing filter
        const clearedContent = await apexTab.getLogContent();

        // Verify all lines are visible again
        expect(clearedContent).toContain('First debug message');
        expect(clearedContent).toContain('Second debug message');
        expect(clearedContent).toContain('UNIQUE keyword');
        expect(clearedContent).toContain('Fourth debug message');
        expect(clearedContent).toContain('Calculation result: 30');

        // Verify total lines restored
        const restoredLines = clearedContent.split('\n').length;
        expect(restoredLines).toBe(totalLines);
    });
});
