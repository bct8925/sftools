import type { BrowserContext, Worker } from 'playwright';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import type { TestContext, TestResult, TestClass, TestConfig } from './types';
import { DEFAULT_CONFIG, SLOW_MODE_CONFIG } from './types';
import { loadExtension, injectConnectionViaServiceWorker } from '../services/extension-loader';
import { loadHeadless, injectChromeMocks } from '../services/headless-loader';
import { SalesforceClient } from '../services/salesforce-client';
import { MockRouter } from '../../shared/mocks/index.js';

export class TestRunner {
    private browserContext!: BrowserContext;
    private extensionId: string = '';
    private baseUrl: string = '';
    private serviceWorker!: Worker;
    private salesforce!: SalesforceClient;
    private results: TestResult[] = [];
    private config: TestConfig = DEFAULT_CONFIG;
    private headlessMode: boolean = true; // Default to headless
    private viteProcess: ChildProcess | null = null;

    setSlowMode(enabled: boolean): void {
        this.config = enabled ? SLOW_MODE_CONFIG : DEFAULT_CONFIG;
    }

    setHeadlessMode(enabled: boolean): void {
        this.headlessMode = enabled;
    }

    async runAll(testFiles: string[]): Promise<TestResult[]> {
        await this.initBrowser();

        for (const file of testFiles) {
            const result = await this.runTestFile(file);
            this.results.push(result);
        }

        await this.cleanup();
        return this.results;
    }

    private async runTestFile(file: string): Promise<TestResult> {
        const module = await import(file);
        const TestClass: TestClass = module.default;
        const testName = TestClass.name;

        console.log(`\n▶ Running: ${testName}`);

        const startTime = Date.now();
        let error: Error | null = null;
        let page = null;

        try {
            // Create a fresh page for this test (starts at about:blank)
            page = await this.browserContext.newPage();

            // Create test context with fresh page
            const testContext: TestContext = {
                context: this.browserContext,
                page,
                extensionId: this.extensionId,
                baseUrl: this.baseUrl,
                salesforce: this.salesforce,
                config: this.config,
            };

            const test = new TestClass(testContext);

            // Set up mock route interception at context level (to catch service worker requests)
            // Always create a MockRouter for headless mode to prevent CORS errors
            const mockRouter = test.configureMocks();
            if (mockRouter) {
                console.log('  Setting up mocks...');
                await mockRouter.setup(this.browserContext);
            } else if (this.headlessMode) {
                // Create default MockRouter to catch any API calls
                console.log('  Setting up default mocks...');
                const defaultRouter = new MockRouter();
                await defaultRouter.setup(this.browserContext);
            }

            // Inject connection (method depends on mode)
            if (!this.headlessMode) {
                // Extension mode: inject via service worker
                await injectConnectionViaServiceWorker(this.serviceWorker, this.salesforce);
            }
            // Headless mode: connection already injected via addInitScript

            // Setup phase (no longer makes real API calls - mocks are used)
            console.log('  Setup...');
            await test.setup();

            // Test phase (test navigates to its own start page)
            console.log('  Running test...');
            await test.test();

            console.log('  Passed');

            // In slow mode, pause before teardown so user can see final state
            if (this.config.delays.beforeClose > 0) {
                await page.waitForTimeout(this.config.delays.beforeClose);
            }

            // Navigate to blank before teardown to prevent any UI flashing
            await page.goto('about:blank');

            // Teardown phase (on blank page - just API calls)
            console.log('  Teardown...');
            await test.teardown();
        } catch (e) {
            error = e as Error;
            console.log(`  Failed: ${error.message}`);
            if (process.env.DEBUG) {
                console.log(error.stack);
            }
            // Take screenshot on failure
            try {
                const screenshotPath = `/tmp/test-failure-${testName}.png`;
                await page?.screenshot({ path: screenshotPath });
                console.log(`  Screenshot saved: ${screenshotPath}`);
                // Log current URL
                console.log(`  Current URL: ${page?.url()}`);
            } catch {
                // Ignore screenshot errors
            }
            // Still try teardown on error
            console.log('  Teardown...');
        } finally {
            // Always close the page for this test
            if (page) {
                try {
                    await page.close();
                } catch {
                    // Page may already be closed if it crashed
                }
            }
        }

        return {
            name: testName,
            file,
            duration: Date.now() - startTime,
            success: error === null,
            error,
        };
    }

    private async initBrowser(): Promise<void> {
        // Environment variables are now optional - mock credentials are fine
        const accessToken = process.env.SF_ACCESS_TOKEN || 'mock-access-token';
        const instanceUrl = process.env.SF_INSTANCE_URL || 'https://test.salesforce.com';

        console.log('Initializing test context...');
        console.log(`   Instance URL: ${instanceUrl}`);
        if (accessToken === 'mock-access-token') {
            console.log('   Using mock credentials (mocked API calls)');
        }

        // Initialize Salesforce client first (needed for mock injection)
        this.salesforce = new SalesforceClient();
        this.salesforce.setCredentials(accessToken, instanceUrl);

        if (this.headlessMode) {
            // Headless mode: load pages directly via Vite server
            const vitePort = process.env.VITE_PORT ? parseInt(process.env.VITE_PORT) : 5173;
            console.log(`   Mode: Headless (Vite server on port ${vitePort})`);

            // Start Vite dev server
            await this.startViteServer(vitePort);

            const { context, baseUrl } = await loadHeadless(vitePort);
            this.browserContext = context;
            this.baseUrl = baseUrl;
            this.extensionId = ''; // Not used in headless mode

            // Inject Chrome mocks with initial connection data
            await injectChromeMocks(context, this.salesforce);

            console.log('   Browser ready (headless)');
        } else {
            // Extension mode: load as Chrome extension
            console.log('   Mode: Extension');

            const { context, extensionId, serviceWorker } = await loadExtension();
            this.browserContext = context;
            this.extensionId = extensionId;
            this.baseUrl = ''; // Not used in extension mode
            this.serviceWorker = serviceWorker;

            console.log(`   Extension ID: ${extensionId}`);
            console.log('   Browser ready, will inject connection per test');
        }
    }

    private async cleanup(): Promise<void> {
        console.log('\nCleaning up...');
        await this.browserContext.close();
        await this.stopViteServer();
    }

    private async startViteServer(port: number): Promise<void> {
        console.log(`   Starting Vite dev server on port ${port}...`);

        return new Promise((resolve, reject) => {
            this.viteProcess = spawn('npx', ['vite', 'dev', '--port', String(port)], {
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
                    resolve();
                }
            };

            this.viteProcess.stdout?.on('data', handleOutput);
            this.viteProcess.stderr?.on('data', handleOutput);

            this.viteProcess.on('error', err => {
                reject(new Error(`Failed to start Vite server: ${err.message}`));
            });

            this.viteProcess.on('exit', code => {
                if (!serverReady) {
                    reject(new Error(`Vite server exited unexpectedly with code ${code}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!serverReady) {
                    this.stopViteServer();
                    reject(new Error('Vite server startup timed out after 30 seconds'));
                }
            }, 30000);
        });
    }

    private async stopViteServer(): Promise<void> {
        if (this.viteProcess) {
            console.log('   Stopping Vite server...');
            this.viteProcess.kill('SIGTERM');
            this.viteProcess = null;
        }
    }
}
