import type { BrowserContext, Worker } from 'playwright';
import type { TestContext, TestResult, TestClass, TestConfig } from './types';
import { DEFAULT_CONFIG, SLOW_MODE_CONFIG } from './types';
import { loadExtension, injectConnectionViaServiceWorker } from '../services/extension-loader';
import { SalesforceClient } from '../services/salesforce-client';
import { MockRouter } from '../../shared/mocks/index.js';

export class TestRunner {
  private browserContext!: BrowserContext;
  private extensionId!: string;
  private serviceWorker!: Worker;
  private salesforce!: SalesforceClient;
  private results: TestResult[] = [];
  private config: TestConfig = DEFAULT_CONFIG;

  setSlowMode(enabled: boolean): void {
    this.config = enabled ? SLOW_MODE_CONFIG : DEFAULT_CONFIG;
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
        salesforce: this.salesforce,
        config: this.config,
      };

      const test = new TestClass(testContext);

      // Set up mock route interception at context level (to catch service worker requests)
      const mockRouter = test.configureMocks();
      if (mockRouter) {
        console.log('  🎭 Setting up mocks...');
        await mockRouter.setup(this.browserContext);
      }

      // Inject connection via service worker (before any navigation)
      await injectConnectionViaServiceWorker(this.serviceWorker, this.salesforce);

      // Setup phase (no longer makes real API calls - mocks are used)
      console.log('  ⏳ Setup...');
      await test.setup();

      // Test phase (test navigates to its own start page)
      console.log('  ⏳ Running test...');
      await test.test();

      console.log('  ✅ Passed');

      // In slow mode, pause before teardown so user can see final state
      if (this.config.delays.beforeClose > 0) {
        await page.waitForTimeout(this.config.delays.beforeClose);
      }

      // Navigate to blank before teardown to prevent any UI flashing
      await page.goto('about:blank');

      // Teardown phase (on blank page - just API calls)
      console.log('  ⏳ Teardown...');
      await test.teardown();
    } catch (e) {
      error = e as Error;
      console.log(`  ❌ Failed: ${error.message}`);
      if (process.env.DEBUG) {
        console.log(error.stack);
      }
      // Still try teardown on error
      console.log('  ⏳ Teardown...');
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

    console.log('🚀 Initializing test context...');
    console.log(`   Instance URL: ${instanceUrl}`);
    if (accessToken === 'mock-access-token') {
      console.log('   ⚠️  Using mock credentials (mocked API calls)');
    }

    // Load extension (browser context + extension ID + service worker)
    const { context, extensionId, serviceWorker } = await loadExtension();
    this.browserContext = context;
    this.extensionId = extensionId;
    this.serviceWorker = serviceWorker;

    console.log(`   Extension ID: ${extensionId}`);

    // Initialize Salesforce client (real or mock credentials)
    this.salesforce = new SalesforceClient();
    this.salesforce.setCredentials(accessToken, instanceUrl);

    console.log('   Browser ready, will inject connection per test');
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    await this.browserContext.close();
  }
}
