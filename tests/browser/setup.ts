/**
 * Vitest Browser Test Setup
 *
 * Manages Vite server and Playwright browser lifecycle for browser tests.
 * Tests run in Node.js and control the browser via Playwright.
 */

import { chromium, BrowserContext, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { injectChromeMocks } from './services/headless-loader';
import { SalesforceClient } from './services/salesforce-client';

// Module-level state (persists across all tests in worker)
let browserContext: BrowserContext | null = null;
let viteProcess: ChildProcess | null = null;
let salesforceClient: SalesforceClient | null = null;
let currentPage: Page | null = null;
let baseUrl: string = '';

const VITE_PORT = parseInt(process.env.VITE_PORT || '5174');

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
 * Start Vite dev server
 */
async function startViteServer(): Promise<void> {
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
            // Vite prints "ready in XXXms" when server is ready
            if (!serverReady && (output.includes('ready in') || output.includes('Local:'))) {
                serverReady = true;
                console.log('Vite dev server ready');
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

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!serverReady) {
                stopViteServer();
                reject(new Error('Vite server startup timed out after 30 seconds'));
            }
        }, 30000);
    });
}

/**
 * Stop Vite dev server
 */
function stopViteServer(): void {
    if (viteProcess) {
        console.log('Stopping Vite server...');
        viteProcess.kill('SIGTERM');
        viteProcess = null;
    }
}

/**
 * Global setup - runs once before all tests
 */
beforeAll(async () => {
    // Start Vite dev server
    await startViteServer();
    baseUrl = `http://localhost:${VITE_PORT}`;

    // Initialize Salesforce client with mock credentials
    salesforceClient = new SalesforceClient();
    salesforceClient.setCredentials('mock-access-token', 'https://test.salesforce.com');

    // Launch browser context
    console.log('Launching browser...');
    browserContext = await chromium.launchPersistentContext('', {
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

    // Set default timeout
    browserContext.setDefaultTimeout(5000);

    // Inject Chrome API mocks
    await injectChromeMocks(browserContext, salesforceClient);

    console.log('Browser ready');
});

/**
 * Global teardown - runs once after all tests
 */
afterAll(async () => {
    console.log('Cleaning up...');

    if (browserContext) {
        await browserContext.close();
        browserContext = null;
    }

    stopViteServer();
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
