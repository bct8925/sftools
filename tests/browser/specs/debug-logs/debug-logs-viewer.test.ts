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
 * Test IDs: DL-F-001 through DL-F-004
 * - DL-F-001: Navigate to Debug Logs tab
 * - DL-F-002: Watch button starts watching
 * - DL-F-003: Refresh fetches logs and displays in table
 * - DL-F-004: Settings modal opens and closes
 */
describe('Debug Logs Viewer', () => {
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
