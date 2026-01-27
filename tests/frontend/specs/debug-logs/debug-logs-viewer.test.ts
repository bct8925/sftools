import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';
import { DebugLogsTabPage } from '../../pages/debug-logs-tab.page';

/**
 * Test Debug Logs tab basic operations
 *
 * Test IDs: DL-F-001 through DL-F-004
 * - DL-F-001: Navigate to Debug Logs tab
 * - DL-F-002: Watch button starts watching
 * - DL-F-003: Refresh fetches logs and displays in table
 * - DL-F-004: Settings modal opens and closes
 */
export default class DebugLogsViewerTest extends SftoolsTest {
    debugLogsTab!: DebugLogsTabPage;

    configureMocks() {
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

        return router;
    }

    async setup(): Promise<void> {
        this.debugLogsTab = new DebugLogsTabPage(this.page);
        this.debugLogsTab.setConfig(this.config);
    }

    async test(): Promise<void> {
        // Navigate to extension
        await this.navigateToExtension();

        // DL-F-001: Navigate to Debug Logs tab
        await this.debugLogsTab.navigateTo();
        const watchBtnVisible = await this.debugLogsTab.watchBtn.isVisible();
        await this.expect(watchBtnVisible).toBe(true);

        // DL-F-002: Watch button starts watching
        await this.debugLogsTab.startWatching();
        const isWatching = await this.debugLogsTab.isWatching();
        await this.expect(isWatching).toBe(true);

        // DL-F-003: Refresh fetches logs and displays in table
        await this.debugLogsTab.refreshLogs();
        const logCount = await this.debugLogsTab.getLogCount();
        await this.expect(logCount).toBe(2);

        // Stop watching
        await this.debugLogsTab.stopWatching();
        const isStillWatching = await this.debugLogsTab.isWatching();
        await this.expect(isStillWatching).toBe(false);

        // DL-F-004: Settings modal opens and closes
        await this.debugLogsTab.openSettings();
        const enableBtnVisible = await this.debugLogsTab.enableForMeBtn.isVisible();
        await this.expect(enableBtnVisible).toBe(true);
        await this.debugLogsTab.closeSettings();
    }
}
