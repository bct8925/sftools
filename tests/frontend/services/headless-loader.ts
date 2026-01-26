/**
 * Headless Test Loader
 *
 * Launches a headless browser context for testing pages directly
 * without loading them as a Chrome extension.
 */

import { chromium, BrowserContext } from 'playwright';
import {
    createChromeMockScript,
    ChromeMockInitialState,
} from '../../shared/mocks/chrome-browser-mock';
import type { SalesforceClient } from './salesforce-client';

export interface HeadlessLoadResult {
    context: BrowserContext;
    baseUrl: string;
}

/**
 * Launch a headless browser context for testing.
 * Unlike extension mode, this can run without a visible window.
 *
 * @param vitePort - Port where Vite preview server is running
 * @returns Browser context and base URL for navigation
 */
export async function loadHeadless(vitePort: number = 5173): Promise<HeadlessLoadResult> {
    const context = await chromium.launchPersistentContext('', {
        headless: true,
        args: [
            '--no-first-run',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-background-timer-throttling',
            '--disable-hang-monitor',
            '--disable-popup-blocking',
            '--disable-prompt-on-repost',
            '--disable-sync',
            '--no-default-browser-check',
        ],
        viewport: { width: 1280, height: 720 },
    });

    // Set default timeout to 5 seconds for all operations
    context.setDefaultTimeout(5000);

    return {
        context,
        baseUrl: `http://localhost:${vitePort}`,
    };
}

/**
 * Inject Chrome API mocks into browser context.
 * Uses addInitScript to ensure mocks are available before any page code runs.
 *
 * @param context - Playwright browser context
 * @param salesforce - Salesforce client with credentials to inject
 */
export async function injectChromeMocks(
    context: BrowserContext,
    salesforce: SalesforceClient
): Promise<void> {
    // Build connection object matching SalesforceConnection interface
    const connection = {
        id: salesforce.getConnectionId(),
        label: 'Test Connection',
        instanceUrl: salesforce.getInstanceUrl(),
        loginDomain: 'https://login.salesforce.com',
        accessToken: salesforce.getAccessToken(),
        refreshToken: null,
        clientId: null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    };

    const initialState: ChromeMockInitialState = {
        storage: {
            connections: [connection],
            theme: 'light',
        },
    };

    // addInitScript runs before any page script on every navigation
    await context.addInitScript(createChromeMockScript(initialState));
}

/**
 * Update connection in mock storage via page.evaluate.
 * Use this when you need to change the connection after initial injection.
 *
 * @param context - Playwright browser context
 * @param salesforce - Salesforce client with updated credentials
 */
export async function updateMockConnection(
    context: BrowserContext,
    salesforce: SalesforceClient
): Promise<void> {
    const connection = {
        id: salesforce.getConnectionId(),
        label: 'Test Connection',
        instanceUrl: salesforce.getInstanceUrl(),
        loginDomain: 'https://login.salesforce.com',
        accessToken: salesforce.getAccessToken(),
        refreshToken: null,
        clientId: null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    };

    // Get all pages in context and update storage
    const pages = context.pages();
    for (const page of pages) {
        await page.evaluate(conn => {
            if (window.__chromeMock) {
                window.__chromeMock.setStorage({ connections: [conn] });
                // Trigger storage change to notify listeners
                window.__chromeMock.triggerStorageChange({
                    connections: {
                        oldValue: undefined,
                        newValue: [conn],
                    },
                });
            }
        }, connection);
    }
}
