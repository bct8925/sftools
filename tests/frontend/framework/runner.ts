import type { BrowserContext } from 'playwright';
import type { TestContext, TestResult, TestClass, TestConfig } from './types';
import { DEFAULT_CONFIG, SLOW_MODE_CONFIG } from './types';
import { loadExtension, injectConnection } from '../services/extension-loader';
import { SalesforceClient } from '../services/salesforce-client';

export class TestRunner {
  private browserContext!: BrowserContext;
  private extensionId!: string;
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
      // Create a fresh page for this test (isolated from other tests)
      page = await this.browserContext.newPage();

      // Inject connection into extension storage via this page
      await injectConnection(page, this.extensionId, this.salesforce);

      // Create test context with fresh page
      const testContext: TestContext = {
        context: this.browserContext,
        page,
        extensionId: this.extensionId,
        salesforce: this.salesforce,
        config: this.config,
      };

      const test = new TestClass(testContext);

      // Setup phase
      console.log('  ⏳ Setup...');
      await test.setup();

      // Test phase
      console.log('  ⏳ Running test...');
      await test.test();

      console.log('  ✅ Passed');

      // Teardown phase
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
    // Validate environment variables
    const accessToken = process.env.SF_ACCESS_TOKEN;
    const instanceUrl = process.env.SF_INSTANCE_URL;

    if (!accessToken || !instanceUrl) {
      throw new Error(
        'Missing required environment variables: SF_ACCESS_TOKEN and SF_INSTANCE_URL\n' +
        'Create a .env.test file or set them in your environment.'
      );
    }

    console.log('🚀 Initializing test context...');
    console.log(`   Instance URL: ${instanceUrl}`);

    // Load extension (browser context + extension ID)
    const { context, extensionId } = await loadExtension();
    this.browserContext = context;
    this.extensionId = extensionId;

    console.log(`   Extension ID: ${extensionId}`);

    // Initialize Salesforce client with env vars
    this.salesforce = new SalesforceClient();
    this.salesforce.setCredentials(accessToken, instanceUrl);

    console.log('   Browser ready, will inject connection per test');
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    await this.browserContext.close();
  }
}
