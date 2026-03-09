/**
 * Screenshot Script
 *
 * Captures 1280x800 screenshots of every page in light and dark mode.
 * Output: screenshots/light/*.png and screenshots/dark/*.png
 *
 * Run: npm run screenshots
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { mkdir } from 'fs/promises';

import { injectChromeMocks } from '../tests/browser/services/headless-loader';
import { SalesforceClient } from '../tests/browser/services/salesforce-client';
import { MockRouter } from '../tests/shared/mocks/playwright-adapter.js';
import {
    QueryEditableResultsScenario,
    ApexSuccessScenario,
    GlobalDescribeScenario,
    AccountDescribeScenario,
    RestApiGetScenario,
    EventsChannelsScenario,
} from '../tests/shared/mocks/mock-scenarios.js';

// When debug=true, executeAnonymousApex calls /chatter/users/me and
// /tooling/query?...TraceFlag which aren't in ApexSuccessScenario.
// Return a mock user and an existing trace flag so ensureTraceFlag() exits early.
const APEX_DEBUG_ADDON_SCENARIO = {
    routes: [
        {
            pattern: /\/chatter\/users\/me/,
            method: 'GET',
            response: { id: '005MOCKUSERID01', name: 'Test User' },
        },
        {
            pattern: /\/tooling\/query.*TraceFlag/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 1,
                records: [
                    {
                        Id: '07tMOCKTRACE001',
                        DebugLevelId: '7dlMOCKDEBUG01',
                        DebugLevel: { DeveloperName: 'SFTOOLS_DEBUG' },
                        ExpirationDate: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                    },
                ],
            },
        },
    ],
};

// RecordPage fetches via SOQL (GET /query/?q=SELECT...FROM Account WHERE Id=...),
// not via the direct sobject endpoint. Define routes with the correct pattern here.
const RECORD_SCREENSHOT_SCENARIO = {
    routes: [
        {
            pattern: /\/sobjects\/Account\/describe/,
            method: 'GET',
            response: {
                name: 'Account',
                label: 'Account',
                keyPrefix: '001',
                queryable: true,
                updateable: true,
                fields: [
                    {
                        name: 'Id',
                        label: 'Record ID',
                        type: 'id',
                        updateable: false,
                        nillable: false,
                    },
                    {
                        name: 'Name',
                        label: 'Account Name',
                        type: 'string',
                        updateable: true,
                        nillable: false,
                    },
                    {
                        name: 'Phone',
                        label: 'Phone',
                        type: 'phone',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'AnnualRevenue',
                        label: 'Annual Revenue',
                        type: 'currency',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'NumberOfEmployees',
                        label: 'Employees',
                        type: 'int',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'Active__c',
                        label: 'Active',
                        type: 'boolean',
                        updateable: true,
                        nillable: false,
                    },
                    {
                        name: 'CreatedDate',
                        label: 'Created Date',
                        type: 'datetime',
                        updateable: false,
                        nillable: false,
                    },
                    {
                        name: 'LastModifiedDate',
                        label: 'Last Modified',
                        type: 'datetime',
                        updateable: false,
                        nillable: false,
                    },
                    {
                        name: 'Type',
                        label: 'Account Type',
                        type: 'picklist',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'Industry',
                        label: 'Industry',
                        type: 'picklist',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'Description',
                        label: 'Description',
                        type: 'textarea',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'Website',
                        label: 'Website',
                        type: 'url',
                        updateable: true,
                        nillable: true,
                    },
                    {
                        name: 'BillingAddress',
                        label: 'Billing Address',
                        type: 'address',
                        updateable: true,
                        nillable: true,
                    },
                ],
            },
        },
        {
            pattern: /\/query\/?\?q=.*FROM%20Account%20WHERE%20Id/,
            method: 'GET',
            response: {
                totalSize: 1,
                done: true,
                records: [
                    {
                        attributes: {
                            type: 'Account',
                            url: '/services/data/v62.0/sobjects/Account/001MOCKACCOUNT01',
                        },
                        Id: '001MOCKACCOUNT01',
                        Name: 'Acme Corporation',
                        Phone: '555-1234',
                        AnnualRevenue: 1000000,
                        NumberOfEmployees: 50,
                        Active__c: true,
                        CreatedDate: '2024-01-15T10:30:00.000+0000',
                        LastModifiedDate: '2024-12-20T14:45:00.000+0000',
                        Type: 'Customer - Direct',
                        Industry: 'Technology',
                        Description: 'Leading provider of innovative solutions',
                        Website: 'https://www.acme.com',
                        BillingAddress: {
                            street: '123 Main St',
                            city: 'San Francisco',
                            state: 'CA',
                            postalCode: '94105',
                            country: 'USA',
                        },
                    },
                ],
            },
        },
    ],
};

import { QueryTabPage } from '../tests/browser/pages/query-tab.page';
import { ApexTabPage } from '../tests/browser/pages/apex-tab.page';
import { SchemaPage } from '../tests/browser/pages/schema.page';
import { RestApiTabPage } from '../tests/browser/pages/rest-api-tab.page';
import { EventsTabPage } from '../tests/browser/pages/events-tab.page';
import { DebugLogsTabPage } from '../tests/browser/pages/debug-logs-tab.page';
import { UtilsTabPage } from '../tests/browser/pages/utils-tab.page';
import { SettingsTabPage } from '../tests/browser/pages/settings-tab.page';
import { RecordPage } from '../tests/browser/pages/record.page';
import { DEFAULT_CONFIG } from '../tests/browser/types';

// --- Constants ---

const VITE_PORT = 5175;
const BASE_URL = `http://localhost:${VITE_PORT}`;
const APP_URL = `${BASE_URL}/pages/app/app.html`;
const RECORD_URL = (connectionId: string) =>
    `${BASE_URL}/pages/record/record.html?objectType=Account&recordId=001MOCKACCOUNT01&connectionId=${connectionId}`;

// --- Types ---

interface PageDef {
    name: string;
    scenarios: object[];
    interact: (page: Page, connectionId: string) => Promise<void>;
}

// --- Page definitions ---

function buildPageDefs(): PageDef[] {
    return [
        {
            name: 'home',
            scenarios: [],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                await page.waitForSelector('[data-testid="home-screen"]');
            },
        },
        {
            name: 'query',
            scenarios: [QueryEditableResultsScenario],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const queryTab = new QueryTabPage(page);
                queryTab.setConfig(DEFAULT_CONFIG);
                await queryTab.navigateTo();
                await queryTab.executeQuery(
                    'SELECT Id, Name, Phone, AnnualRevenue, Type FROM Account'
                );
            },
        },
        {
            name: 'apex',
            scenarios: [ApexSuccessScenario, APEX_DEBUG_ADDON_SCENARIO],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                // Set debug=true after the chrome mock is live but before ApexTab mounts (lazy-loaded)
                await page.evaluate(() => {
                    chrome.storage.local.set({ apexEditorSettings: { debug: true } });
                });
                const apexTab = new ApexTabPage(page);
                apexTab.setConfig(DEFAULT_CONFIG);
                await apexTab.navigateTo();
                await apexTab.setCode(
                    "System.debug('Hello from Apex');\nSystem.debug('Execution complete');"
                );
                await apexTab.execute();
            },
        },
        {
            name: 'logs',
            scenarios: [],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const debugLogsTab = new DebugLogsTabPage(page);
                debugLogsTab.setConfig(DEFAULT_CONFIG);
                await debugLogsTab.navigateTo();
            },
        },
        {
            name: 'rest-api',
            scenarios: [RestApiGetScenario],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const restApiTab = new RestApiTabPage(page);
                restApiTab.setConfig(DEFAULT_CONFIG);
                await restApiTab.navigateTo();
                await restApiTab.setEndpoint('/services/data/v62.0/sobjects');
                await restApiTab.send();
            },
        },
        {
            name: 'schema',
            scenarios: [GlobalDescribeScenario, AccountDescribeScenario],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const schemaPage = new SchemaPage(page);
                schemaPage.setConfig(DEFAULT_CONFIG);
                await schemaPage.navigateTo();
                await schemaPage.waitForLoad();
                await schemaPage.selectObject('Account');
            },
        },
        {
            name: 'events',
            scenarios: [EventsChannelsScenario],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const eventsTab = new EventsTabPage(page);
                eventsTab.setConfig(DEFAULT_CONFIG);
                await eventsTab.navigateTo();
                await eventsTab.waitForChannelsLoaded();
            },
        },
        {
            name: 'utils',
            scenarios: [],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const utilsTab = new UtilsTabPage(page);
                utilsTab.setConfig(DEFAULT_CONFIG);
                await utilsTab.navigateTo();
            },
        },
        {
            name: 'settings',
            scenarios: [],
            interact: async page => {
                await page.goto(APP_URL);
                await page.waitForLoadState('networkidle');
                const settingsTab = new SettingsTabPage(page);
                settingsTab.setConfig(DEFAULT_CONFIG);
                await settingsTab.navigateTo();
            },
        },
        {
            name: 'record',
            scenarios: [RECORD_SCREENSHOT_SCENARIO],
            interact: async (page, connectionId) => {
                await page.goto(RECORD_URL(connectionId));
                await page.waitForLoadState('networkidle');
                const recordPage = new RecordPage(page);
                recordPage.setConfig(DEFAULT_CONFIG);
                await recordPage.waitForLoad();
            },
        },
    ];
}

// --- Vite server lifecycle ---

let viteProcess: ChildProcess | null = null;

function startViteServer(): Promise<void> {
    console.log(`Starting Vite dev server on port ${VITE_PORT}...`);

    return new Promise((resolve, reject) => {
        viteProcess = spawn('npx', ['vite', 'dev', '--port', String(VITE_PORT)], {
            cwd: process.cwd(),
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true,
        });

        let serverReady = false;

        const handleOutput = (data: Buffer) => {
            const output = data.toString();
            if (!serverReady && (output.includes('ready in') || output.includes('Local:'))) {
                serverReady = true;
                console.log('Vite server ready');
                resolve();
            }
        };

        viteProcess.stdout?.on('data', handleOutput);
        viteProcess.stderr?.on('data', handleOutput);

        viteProcess.on('error', err => {
            reject(new Error(`Failed to start Vite server: ${err.message}`));
        });

        viteProcess.on('exit', code => {
            if (!serverReady) {
                reject(new Error(`Vite server exited unexpectedly with code ${code}`));
            }
        });

        setTimeout(() => {
            if (!serverReady) {
                stopViteServer();
                reject(new Error('Vite server startup timed out after 30 seconds'));
            }
        }, 30000);
    });
}

function stopViteServer(): void {
    if (viteProcess) {
        viteProcess.kill('SIGTERM');
        viteProcess = null;
    }
}

// --- Browser lifecycle ---

async function launchBrowser(
    salesforce: SalesforceClient
): Promise<{ browser: Browser; context: BrowserContext }> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await injectChromeMocks(context, salesforce);
    return { browser, context };
}

// --- Screenshot capture ---

async function ensureOutputDirs(): Promise<void> {
    await mkdir('screenshots/light', { recursive: true });
    await mkdir('screenshots/dark', { recursive: true });
}

async function capturePageScreenshots(
    context: BrowserContext,
    pageDef: PageDef,
    connectionId: string
): Promise<void> {
    // Use context-level routing so all requests (including service worker) are intercepted.
    // Clear previous page's routes first.
    await context.unrouteAll({ behavior: 'ignoreErrors' });
    const router = new MockRouter();
    for (const scenario of pageDef.scenarios) {
        router.usePreset(scenario);
    }
    await router.setup(context);

    const page = await context.newPage();
    try {
        await pageDef.interact(page, connectionId);

        // Light mode
        await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `screenshots/light/${pageDef.name}.png` });
        console.log(`  ✓ light/${pageDef.name}.png`);

        // Dark mode
        await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
        await page.waitForTimeout(300);
        await page.screenshot({ path: `screenshots/dark/${pageDef.name}.png` });
        console.log(`  ✓ dark/${pageDef.name}.png`);
    } finally {
        await page.close();
    }
}

async function captureAllScreenshots(context: BrowserContext, connectionId: string): Promise<void> {
    await ensureOutputDirs();

    const pageDefs = buildPageDefs();
    for (const pageDef of pageDefs) {
        console.log(`\nCapturing ${pageDef.name}...`);
        await capturePageScreenshots(context, pageDef, connectionId);
    }

    console.log('\nDone! 20 screenshots saved to screenshots/');
}

// --- Entry point ---

async function main(): Promise<void> {
    console.log('Starting screenshot capture...');
    await startViteServer();

    const salesforce = new SalesforceClient();
    salesforce.setCredentials('mock-access-token', 'https://test.salesforce.com');
    const connectionId = salesforce.getConnectionId();

    const { browser, context } = await launchBrowser(salesforce);

    try {
        await captureAllScreenshots(context, connectionId);
    } finally {
        await browser.close();
        stopViteServer();
    }
}

main().catch(err => {
    console.error('Screenshot capture failed:', err);
    stopViteServer();
    process.exit(1);
});
