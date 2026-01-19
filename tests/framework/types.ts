import type { Page, BrowserContext } from 'playwright';
import type { SalesforceClient } from '../services/salesforce-client';

export interface TestContext {
  page: Page;
  context: BrowserContext;
  extensionId: string;
  salesforce: SalesforceClient;
}

export interface TestResult {
  name: string;
  file: string;
  duration: number;
  success: boolean;
  error: Error | null;
}

export interface TestClass {
  new (ctx: TestContext): SftoolsTestInstance;
}

export interface SftoolsTestInstance {
  setup(): Promise<void>;
  test(): Promise<void>;
  teardown(): Promise<void>;
}
