import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

/**
 * Test Debug Logs cleanup operations
 *
 * Test IDs: U-DL-F-004, U-DL-F-005
 * - U-DL-F-004: Delete all trace flags - confirmation, success
 * - U-DL-F-005: Delete all debug logs - confirmation, success
 */
export default class DebugLogsCleanupTest extends SftoolsTest {
    configureMocks() {
        const router = new MockRouter();

        // Mock DELETE requests for trace flags - returns success
        router.addRoute(/\/tooling\/sobjects\/TraceFlag/, { success: true }, 'DELETE');

        // Mock DELETE requests for debug logs - returns success
        router.addRoute(/\/tooling\/sobjects\/ApexLog/, { success: true }, 'DELETE');

        // Mock query for existing trace flags
        router.addRoute(
            /\/tooling\/query.*TraceFlag/,
            {
                totalSize: 1,
                done: true,
                records: [
                    {
                        Id: '7tfMOCKTRACE0001',
                        TracedEntityId: '005CURRENTUSER001',
                        DebugLevelId: '7dlMOCKDEBUG0001',
                    },
                ],
            },
            'GET'
        );

        // Mock query for existing debug logs
        router.addRoute(
            /\/tooling\/query.*ApexLog/,
            {
                totalSize: 5,
                done: true,
                records: [
                    { Id: '07lMOCKLOG00001' },
                    { Id: '07lMOCKLOG00002' },
                    { Id: '07lMOCKLOG00003' },
                    { Id: '07lMOCKLOG00004' },
                    { Id: '07lMOCKLOG00005' },
                ],
            },
            'GET'
        );

        return router;
    }

    async setup(): Promise<void> {
        // Handle browser dialogs for delete confirmations
        this.page.on('dialog', async dialog => {
            await dialog.accept();
        });
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Utils tab
        await this.utilsTab.navigateTo();

        // U-DL-F-004: Delete all trace flags - confirmation and success
        await this.utilsTab.deleteAllTraceFlags();

        // Verify delete operation completed successfully
        const traceDeleteStatus = await this.utilsTab.getDebugLogsStatus();
        await this.expect(traceDeleteStatus.type).toBe('success');

        // U-DL-F-005: Delete all debug logs - confirmation and success
        await this.utilsTab.deleteAllLogs();

        // Verify delete operation completed successfully
        const logsDeleteStatus = await this.utilsTab.getDebugLogsStatus();
        await this.expect(logsDeleteStatus.type).toBe('success');
    }
}
