import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Anonymous Apex execution via keyboard shortcut
 *
 * @test A-F-002
 * Test ID: A-F-002
 * Description: Execute Apex via Ctrl/Cmd+Enter - Executes successfully
 */
export default class ApexShortcutTest extends SftoolsTest {
    configureMocks() {
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

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Apex tab
        await this.apexTab.navigateTo();

        // Set simple Apex code
        const apexCode = `
      System.debug('Executed via keyboard shortcut');
      Integer x = 100;
      System.debug('Result: ' + x);
    `;
        await this.apexTab.setCode(apexCode);

        // Execute using Ctrl/Cmd+Enter (will use mocked response)
        await this.apexTab.executeWithShortcut();

        // Verify success
        const status = await this.apexTab.getStatus();
        await this.expect(status.success).toBe(true);

        // Verify debug log contains our output
        const logContent = await this.apexTab.getLogContent();
        await this.expect(logContent).toContain('Executed via keyboard shortcut');
        await this.expect(logContent).toContain('Result: 100');
    }
}
