import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { DebugLogsTabPage } from '../../pages/debug-logs-tab.page';

/**
 * Test Debug Logs cleanup operations
 * NOTE: These operations moved from Utils tab to Debug Logs tab Settings modal
 *
 * Test IDs: DL-F-005, DL-F-006
 * - DL-F-005: Delete all trace flags - confirmation, success
 * - DL-F-006: Delete all debug logs - confirmation, success
 */
export default class DebugLogsCleanupTest extends SftoolsTest {
    debugLogsTab!: DebugLogsTabPage;

    configureMocks() {
        const router = new MockRouter();

        // Mock DELETE requests for trace flags - returns success
        router.addRoute(
            /\/tooling\/(composite\/sobjects|sobjects\/TraceFlag)/,
            { success: true },
            'DELETE'
        );

        // Mock DELETE requests for debug logs - returns success
        router.addRoute(
            /\/tooling\/(composite\/sobjects|sobjects\/ApexLog)/,
            { success: true },
            'DELETE'
        );

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

        // Mock query for existing debug logs - stats query
        router.addRoute(
            /\/tooling\/query.*ApexLog.*LogLength/,
            {
                totalSize: 5,
                done: true,
                records: [
                    { Id: '07lMOCKLOG00001', LogLength: 1024 },
                    { Id: '07lMOCKLOG00002', LogLength: 2048 },
                    { Id: '07lMOCKLOG00003', LogLength: 512 },
                    { Id: '07lMOCKLOG00004', LogLength: 4096 },
                    { Id: '07lMOCKLOG00005', LogLength: 1536 },
                ],
            },
            'GET'
        );

        // Mock query for debug logs - general
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
        this.debugLogsTab = new DebugLogsTabPage(this.page);
        this.debugLogsTab.setConfig(this.config);

        // Handle browser dialogs for delete confirmations
        this.page.on('dialog', async dialog => {
            await dialog.accept();
        });
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // Navigate to Debug Logs tab
        await this.debugLogsTab.navigateTo();

        // Open settings modal
        await this.debugLogsTab.openSettings();

        // DL-F-005: Delete all trace flags - confirmation and success
        await this.debugLogsTab.deleteFlagsBtn.click();
        await this.wait(500);

        // Check that status updated (button should still be visible after operation)
        const traceDeleteStatus = this.page.locator(
            '[data-testid="debug-logs-delete-status-text"]'
        );
        await traceDeleteStatus.waitFor({ state: 'visible', timeout: 5000 });

        // DL-F-006: Delete all debug logs - confirmation and success
        await this.debugLogsTab.deleteLogsBtn.click();
        await this.wait(500);

        // Check that status updated
        await traceDeleteStatus.waitFor({ state: 'visible', timeout: 5000 });
        const statusText = await traceDeleteStatus.textContent();
        await this.expect(statusText || '').toContain('Deleted');
    }
}
