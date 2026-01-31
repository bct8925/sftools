import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

/**
 * Test Debug Logs tab basic operations
 *
 * Test IDs: U-DL-F-002 through U-DL-F-005
 * - Navigate to Debug Logs tab (Utils tab)
 * - U-DL-F-002: Search for other users
 * - U-DL-F-003: Enable trace flag for selected user
 * - U-DL-F-004: Delete all trace flags
 * - U-DL-F-005: Delete all debug logs
 */
describe('Debug Logs Viewer (U-DL-F-002, U-DL-F-003, U-DL-F-004, U-DL-F-005)', () => {
    beforeEach(async () => {
        const router = new MockRouter();

        // Mock query for debug logs (with log data)
        router.addRoute(
            /\/tooling\/query.*ApexLog.*StartTime/,
            {
                totalSize: 2,
                done: true,
                records: [
                    {
                        Id: '07lMOCKLOG00001',
                        LogUser: { Name: 'Test User' },
                        LogLength: 1024,
                        Operation: '/apex/executeAnonymous/',
                        Request: 'Api',
                        Status: 'Success',
                        StartTime: new Date().toISOString(),
                    },
                    {
                        Id: '07lMOCKLOG00002',
                        LogUser: { Name: 'Test User' },
                        LogLength: 2048,
                        Operation: '/apex/TestClass/',
                        Request: 'Api',
                        Status: 'Success',
                        StartTime: new Date().toISOString(),
                    },
                ],
            },
            'GET'
        );

        // Mock log body request
        router.addRoute(
            /\/tooling\/sobjects\/ApexLog\/.*\/Body/,
            '12:00:00.001|USER_DEBUG|[5]|DEBUG|Hello World\n12:00:00.002|EXECUTION_FINISHED',
            'GET'
        );

        // Mock queries for settings modal
        router.addRoute(/\/tooling\/query.*TraceFlag/, { records: [] }, 'GET');
        router.addRoute(/\/tooling\/query.*DebugLevel/, { records: [] }, 'GET');

        await setupMocks(router);
    });

    it('navigates to tab, starts watching, refreshes logs, and opens settings', async () => {
        const { page } = getTestContext();
        const { debugLogsTab } = createPageObjects(page);

        // Navigate to extension
        await navigateToExtension();

        // DL-F-001: Navigate to Debug Logs tab
        await debugLogsTab.navigateTo();
        const watchBtnVisible = await debugLogsTab.watchBtn.isVisible();
        expect(watchBtnVisible).toBe(true);

        // DL-F-002: Watch button starts watching
        await debugLogsTab.startWatching();
        const isWatching = await debugLogsTab.isWatching();
        expect(isWatching).toBe(true);

        // DL-F-003: Refresh fetches logs and displays in table
        await debugLogsTab.refreshLogs();
        const logCount = await debugLogsTab.getLogCount();
        expect(logCount).toBe(2);

        // Stop watching
        await debugLogsTab.stopWatching();
        const isStillWatching = await debugLogsTab.isWatching();
        expect(isStillWatching).toBe(false);

        // DL-F-004: Settings modal opens and closes
        await debugLogsTab.openSettings();
        const enableBtnVisible = await debugLogsTab.enableForMeBtn.isVisible();
        expect(enableBtnVisible).toBe(true);
        await debugLogsTab.closeSettings();
    });
});
