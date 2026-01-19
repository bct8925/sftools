import type { TestContext, TestResult, TestClass, TestConfig } from './types';
import { DEFAULT_CONFIG, SLOW_MODE_CONFIG } from './types';
import { loadExtension, injectConnection } from '../services/extension-loader';
import { SalesforceClient } from '../services/salesforce-client';

export class TestRunner {
  private context!: TestContext;
  private results: TestResult[] = [];
  private config: TestConfig = DEFAULT_CONFIG;

  setSlowMode(enabled: boolean): void {
    this.config = enabled ? SLOW_MODE_CONFIG : DEFAULT_CONFIG;
  }

  async runAll(testFiles: string[]): Promise<TestResult[]> {
    await this.initContext();

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
    const test = new TestClass(this.context);
    const testName = TestClass.name;

    console.log(`\n▶ Running: ${testName}`);

    const startTime = Date.now();
    let error: Error | null = null;

    try {
      // Setup phase
      console.log('  ⏳ Setup...');
      await test.setup();

      // Test phase
      console.log('  ⏳ Running test...');
      await test.test();

      console.log('  ✅ Passed');
    } catch (e) {
      error = e as Error;
      console.log(`  ❌ Failed: ${error.message}`);
      if (process.env.DEBUG) {
        console.log(error.stack);
      }
    } finally {
      // Teardown phase - ALWAYS runs
      console.log('  ⏳ Teardown...');
      try {
        await test.teardown();
      } catch (teardownError) {
        console.log(`  ⚠️ Teardown error: ${(teardownError as Error).message}`);
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

  private async initContext(): Promise<void> {
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

    // Load extension
    const { context, extensionId } = await loadExtension();
    const page = await context.newPage();

    console.log(`   Extension ID: ${extensionId}`);

    // Initialize Salesforce client with env vars
    const salesforce = new SalesforceClient();
    salesforce.setCredentials(accessToken, instanceUrl);

    // Inject connection into extension storage
    await injectConnection(page, extensionId, salesforce);

    console.log('   Connection injected into extension storage');

    this.context = { context, page, extensionId, salesforce, config: this.config };
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up...');
    await this.context.context.close();
  }
}
