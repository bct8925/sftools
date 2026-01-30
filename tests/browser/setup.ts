/**
 * Vitest Browser Test Setup
 *
 * Connects to the shared browser server (started by global-setup.ts)
 * and manages per-file browser context and per-test page lifecycle.
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { injectChromeMocks } from './services/headless-loader';
import { SalesforceClient } from './services/salesforce-client';

// Module-level state (persists across all tests in this worker/file)
let browser: Browser | null = null;
let browserContext: BrowserContext | null = null;
let salesforceClient: SalesforceClient | null = null;
let currentPage: Page | null = null;
let baseUrl: string = '';

/**
 * Test context available to tests
 */
export interface BrowserTestContext {
    page: Page;
    context: BrowserContext;
    baseUrl: string;
    salesforce: SalesforceClient;
}

/**
 * Get the current test context. Must be called within a test.
 */
export function getTestContext(): BrowserTestContext {
    if (!currentPage || !browserContext || !salesforceClient) {
        throw new Error('Test context not initialized. Are you inside a test?');
    }
    return {
        page: currentPage,
        context: browserContext,
        baseUrl,
        salesforce: salesforceClient,
    };
}

/**
 * Get the browser context (for MockRouter setup)
 */
export function getBrowserContext(): BrowserContext {
    if (!browserContext) {
        throw new Error('Browser context not initialized');
    }
    return browserContext;
}

/**
 * Per-file setup — connect to shared browser, create context
 */
beforeAll(async () => {
    const wsEndpoint = process.env.BROWSER_WS_ENDPOINT;
    if (!wsEndpoint) {
        throw new Error(
            'BROWSER_WS_ENDPOINT not set. Is globalSetup configured in vitest.config.browser.ts?'
        );
    }

    baseUrl = process.env.VITE_BASE_URL || 'http://localhost:5174';

    // Connect to the shared browser server
    browser = await chromium.connect(wsEndpoint);

    // Initialize Salesforce client with mock credentials
    salesforceClient = new SalesforceClient();
    salesforceClient.setCredentials('mock-access-token', 'https://test.salesforce.com');

    // Create a fresh context for this test file
    browserContext = await browser.newContext({
        viewport: { width: 1280, height: 720 },
    });
    browserContext.setDefaultTimeout(5000);

    // Inject Chrome API mocks
    await injectChromeMocks(browserContext, salesforceClient);
});

/**
 * Per-file teardown — close context (not browser)
 */
afterAll(async () => {
    if (browserContext) {
        await browserContext.close();
        browserContext = null;
    }
    if (browser) {
        browser.close();
        browser = null;
    }
});

/**
 * Per-test setup - creates fresh page
 */
beforeEach(async () => {
    if (!browserContext) {
        throw new Error('Browser context not initialized');
    }

    // Create fresh page for this test
    currentPage = await browserContext.newPage();
});

/**
 * Per-test teardown - closes page
 */
afterEach(async () => {
    if (currentPage) {
        try {
            await currentPage.close();
        } catch {
            // Page may already be closed
        }
        currentPage = null;
    }

    // Clear any routes set up by the test
    if (browserContext) {
        await browserContext.unrouteAll({ behavior: 'ignoreErrors' });
        // Re-setup default empty route handler
        await browserContext.route(/.*salesforce\.com\/.*/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ records: [], totalSize: 0 }),
            });
        });
    }
});
