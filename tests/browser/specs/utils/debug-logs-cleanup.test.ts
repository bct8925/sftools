import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Debug Logs cleanup operations
 * NOTE: These operations moved from Utils tab to Debug Logs tab Settings modal
 *
 * Test IDs: DL-F-005, DL-F-006
 * - DL-F-005: Delete all trace flags - confirmation, success
 * - DL-F-006: Delete all debug logs - confirmation, success
 */
describe('Debug Logs Cleanup', () => {
    beforeEach(async () => {
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

        // Handle browser dialogs for delete confirmations
        const { page } = getTestContext();
        page.on('dialog', async dialog => {
            await dialog.accept();
        });

        await setupMocks(router);
    });

    it('deletes all trace flags and debug logs with confirmation', async () => {
        const { page } = getTestContext();
        const { debugLogsTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // Navigate to Debug Logs tab
        await debugLogsTab.navigateTo();

        // Open settings modal
        await debugLogsTab.openSettings();

        // DL-F-005: Delete all trace flags - confirmation and success
        await debugLogsTab.deleteFlagsBtn.click();
        await page.waitForTimeout(500);

        // Check that status updated (button should still be visible after operation)
        const traceDeleteStatus = page.locator('[data-testid="debug-logs-delete-status-text"]');
        await traceDeleteStatus.waitFor({ state: 'visible', timeout: 5000 });

        // DL-F-006: Delete all debug logs - confirmation and success
        await debugLogsTab.deleteLogsBtn.click();
        await page.waitForTimeout(500);

        // Check that status updated
        await traceDeleteStatus.waitFor({ state: 'visible', timeout: 5000 });
        const statusText = await traceDeleteStatus.textContent();
        expect(statusText || '').toContain('Deleted');
    });
});
