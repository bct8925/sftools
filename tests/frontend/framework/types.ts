import type { Page, BrowserContext } from 'playwright';
import type { SalesforceClient } from '../services/salesforce-client';

export interface TestConfig {
  slowMode: boolean;
  // Delays in milliseconds (only applied in slow mode)
  delays: {
    beforeClick: number;
    afterClick: number;
    beforeType: number;
    afterNavigation: number;
    afterPageLoad: number;
    beforeClose: number;
  };
}

export const DEFAULT_CONFIG: TestConfig = {
  slowMode: false,
  delays: {
    beforeClick: 100,
    afterClick: 100,
    beforeType: 100,
    afterNavigation: 100,
    afterPageLoad: 100,
    beforeClose: 100,
  },
};

export const SLOW_MODE_CONFIG: TestConfig = {
  slowMode: true,
  delays: {
    beforeClick: 800,
    afterClick: 500,
    beforeType: 500,
    afterNavigation: 1000,
    afterPageLoad: 1200,
    beforeClose: 1000,
  },
};

export interface TestContext {
  page: Page;
  context: BrowserContext;
  extensionId: string;
  salesforce: SalesforceClient;
  config: TestConfig;
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
