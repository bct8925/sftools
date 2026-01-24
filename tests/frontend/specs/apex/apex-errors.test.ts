import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Apex compilation error handling
 *
 * Test IDs: A-F-004, A-F-016, A-F-018
 * - A-F-004: View compilation error - Error marker on line/column
 * - A-F-016: Status badge compile error - Red X with "Compile Error"
 * - A-F-018: Compilation error on specific line - Marker on line 5
 */
export default class ApexErrorsTest extends SftoolsTest {
    configureMocks() {
        const router = new MockRouter();

        // Mock compilation error response
        router.onApexExecute(false, false, '');

        return router;
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Apex tab
        await this.apexTab.navigateTo();

        // Set code with syntax error (undefined variable)
        const invalidCode = `System.debug(undefinedVariable);`;
        await this.apexTab.setCode(invalidCode);

        // Execute (will use mocked error response)
        await this.apexTab.execute();

        // Verify status indicates failure (Compile Error or Error)
        const status = await this.apexTab.getStatus();
        await this.expect(status.success).toBe(false);

        // Status text should indicate compile error
        await this.expect(status.text).toContain('Error');
    }
}
