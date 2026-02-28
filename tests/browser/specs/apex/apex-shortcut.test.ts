import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Anonymous Apex execution via keyboard shortcut
 *
 * @test A-F-002
 * Test ID: A-F-002
 * Description: Execute Apex via Ctrl/Cmd+Enter - Executes successfully
 */
describe('Apex Keyboard Shortcut', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock successful Apex execution
        router.onApexExecute(
            true,
            true,
            'USER_DEBUG|[1]|DEBUG|Executed via keyboard shortcut\nUSER_DEBUG|[3]|DEBUG|Result: 100'
        );

        // Mock ApexLog query (returns the log record metadata)
        router.addRoute(
            /\/services\/data\/v[\d.]+\/tooling\/query.*ApexLog/,
            {
                done: true,
                totalSize: 1,
                records: [
                    {
                        Id: '07LMOCKLOG001',
                        LogLength: 500,
                        Status: 'Success',
                    },
                ],
            },
            'GET'
        );

        // Mock ApexLog body retrieval (returns the actual log content as plain text)
        router.addRoute(
            /\/tooling\/sobjects\/ApexLog\/.*\/Body/,
            {
                data: 'USER_DEBUG|[1]|DEBUG|Executed via keyboard shortcut\nUSER_DEBUG|[3]|DEBUG|Result: 100',
                contentType: 'text/plain',
            },
            'GET'
        );

        await setupMocks(router);
    });

    it('executes Apex via Ctrl/Cmd+Enter shortcut', async () => {
        const { page } = getTestContext();
        const { apexTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Apex tab
        await apexTab.navigateTo();

        // Set simple Apex code
        const apexCode = `
      System.debug('Executed via keyboard shortcut');
      Integer x = 100;
      System.debug('Result: ' + x);
    `;
        await apexTab.setCode(apexCode);

        // Execute using Ctrl/Cmd+Enter (will use mocked response)
        await apexTab.executeWithShortcut();

        // Verify success
        const status = await apexTab.getStatus();
        expect(status.type).toBe('success');

        // Verify debug log contains our output
        const logContent = await apexTab.getLogContent();
        expect(logContent).toContain('Executed via keyboard shortcut');
        expect(logContent).toContain('Result: 100');
    });
});
