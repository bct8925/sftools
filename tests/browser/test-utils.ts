/**
 * Test Utilities for Browser Tests
 *
 * Provides page object factories, navigation helpers, and mock setup utilities.
 */

import type { Page, BrowserContext } from 'playwright';
import { getTestContext, getBrowserContext, BrowserTestContext } from './setup';
import { MockRouter } from '../shared/mocks/index.js';
import { DEFAULT_CONFIG } from './types';

// Page object imports
import { QueryTabPage } from './pages/query-tab.page';
import { ApexTabPage } from './pages/apex-tab.page';
import { RecordPage } from './pages/record.page';
import { SchemaPage } from './pages/schema.page';
import { UtilsTabPage } from './pages/utils-tab.page';
import { SettingsTabPage } from './pages/settings-tab.page';
import { RestApiTabPage } from './pages/rest-api-tab.page';
import { EventsTabPage } from './pages/events-tab.page';
import { DebugLogsTabPage } from './pages/debug-logs-tab.page';

/**
 * Collection of all page objects for a test
 */
export interface TestPageObjects {
    queryTab: QueryTabPage;
    apexTab: ApexTabPage;
    recordPage: RecordPage;
    schemaPage: SchemaPage;
    utilsTab: UtilsTabPage;
    settingsTab: SettingsTabPage;
    restApiTab: RestApiTabPage;
    eventsTab: EventsTabPage;
    debugLogsTab: DebugLogsTabPage;
}

/**
 * Create all page objects for the current test page
 */
export function createPageObjects(page: Page): TestPageObjects {
    const config = DEFAULT_CONFIG;

    const queryTab = new QueryTabPage(page);
    queryTab.setConfig(config);

    const apexTab = new ApexTabPage(page);
    apexTab.setConfig(config);

    const recordPage = new RecordPage(page);
    recordPage.setConfig(config);

    const schemaPage = new SchemaPage(page);
    schemaPage.setConfig(config);

    const utilsTab = new UtilsTabPage(page);
    utilsTab.setConfig(config);

    const settingsTab = new SettingsTabPage(page);
    settingsTab.setConfig(config);

    const restApiTab = new RestApiTabPage(page);
    restApiTab.setConfig(config);

    const eventsTab = new EventsTabPage(page);
    eventsTab.setConfig(config);

    const debugLogsTab = new DebugLogsTabPage(page);
    debugLogsTab.setConfig(config);

    return {
        queryTab,
        apexTab,
        recordPage,
        schemaPage,
        utilsTab,
        settingsTab,
        restApiTab,
        eventsTab,
        debugLogsTab,
    };
}

/**
 * Set up mock routes on the browser context.
 * Call this in beforeEach before navigating.
 */
export async function setupMocks(router: MockRouter): Promise<void> {
    const context = getBrowserContext();
    await router.setup(context);
}

/**
 * Navigate to the main extension app page
 */
export async function navigateToExtension(): Promise<void> {
    const { page, baseUrl } = getTestContext();
    const url = `${baseUrl}/pages/app/app.html`;

    // Skip if already on the app page
    if (page.url().includes('pages/app/app')) {
        return;
    }

    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate to the record viewer page
 */
export async function navigateToRecord(objectType: string, recordId: string): Promise<void> {
    const { page, baseUrl, salesforce } = getTestContext();
    const connectionId = salesforce.getConnectionId();
    const url = `${baseUrl}/pages/record/record.html?objectType=${objectType}&recordId=${recordId}&connectionId=${connectionId}`;

    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

/**
 * Navigate to the schema browser page
 */
export async function navigateToSchema(): Promise<void> {
    const { page, baseUrl, salesforce } = getTestContext();
    const connectionId = salesforce.getConnectionId();
    const url = `${baseUrl}/pages/schema/schema.html?connectionId=${connectionId}`;

    await page.goto(url);
    await page.waitForLoadState('networkidle');
}

/**
 * Wait helper for tests
 */
export async function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Take a screenshot for debugging
 */
export async function takeScreenshot(name: string): Promise<void> {
    const { page } = getTestContext();
    const path = `/tmp/browser-test-${name}-${Date.now()}.png`;
    await page.screenshot({ path });
    console.log(`Screenshot saved: ${path}`);
}

/**
 * Re-export for convenience
 */
export { getTestContext, getBrowserContext, MockRouter };
export type { BrowserTestContext };
