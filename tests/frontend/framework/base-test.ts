import type { Page, BrowserContext } from 'playwright';
import type { TestContext, TestConfig } from './types';
import type { SalesforceClient } from '../services/salesforce-client';
import { Assertion } from './assertions';

// Forward declarations for page objects (lazy loaded)
import type { QueryTabPage } from '../pages/query-tab.page';
import type { ApexTabPage } from '../pages/apex-tab.page';
import type { RecordPage } from '../pages/record.page';
import type { SchemaPage } from '../pages/schema.page';

export abstract class SftoolsTest {
  protected page: Page;
  protected context: BrowserContext;
  protected extensionId: string;
  protected salesforce: SalesforceClient;
  protected config: TestConfig;

  // Page objects (lazy-loaded)
  private _queryTab?: QueryTabPage;
  private _apexTab?: ApexTabPage;
  private _recordPage?: RecordPage;
  private _schemaPage?: SchemaPage;

  constructor(ctx: TestContext) {
    this.page = ctx.page;
    this.context = ctx.context;
    this.extensionId = ctx.extensionId;
    this.salesforce = ctx.salesforce;
    this.config = ctx.config;
  }

  // Lifecycle methods - override in subclasses
  async setup(): Promise<void> {}
  async teardown(): Promise<void> {}
  abstract test(): Promise<void>;

  // Page object getters (lazy loaded to avoid circular imports)
  get queryTab(): QueryTabPage {
    if (!this._queryTab) {
      const { QueryTabPage } = require('../pages/query-tab.page');
      this._queryTab = new QueryTabPage(this.page);
      this._queryTab.setConfig(this.config);
    }
    return this._queryTab!;
  }

  get apexTab(): ApexTabPage {
    if (!this._apexTab) {
      const { ApexTabPage } = require('../pages/apex-tab.page');
      this._apexTab = new ApexTabPage(this.page);
      this._apexTab.setConfig(this.config);
    }
    return this._apexTab!;
  }

  get recordPage(): RecordPage {
    if (!this._recordPage) {
      const { RecordPage } = require('../pages/record.page');
      this._recordPage = new RecordPage(this.page);
      this._recordPage.setConfig(this.config);
    }
    return this._recordPage!;
  }

  get schemaPage(): SchemaPage {
    if (!this._schemaPage) {
      const { SchemaPage } = require('../pages/schema.page');
      this._schemaPage = new SchemaPage(this.page);
      this._schemaPage.setConfig(this.config);
    }
    return this._schemaPage!;
  }

  // Navigation helpers
  async navigateToExtension(): Promise<void> {
    await this.page.goto(
      `chrome-extension://${this.extensionId}/dist/pages/app/app.html`
    );
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToRecord(objectType: string, recordId: string): Promise<void> {
    const connectionId = this.salesforce.getConnectionId();
    await this.page.goto(
      `chrome-extension://${this.extensionId}/dist/pages/record/record.html` +
      `?objectType=${objectType}&recordId=${recordId}&connectionId=${connectionId}`
    );
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToSchema(): Promise<void> {
    const connectionId = this.salesforce.getConnectionId();
    await this.page.goto(
      `chrome-extension://${this.extensionId}/dist/pages/schema/schema.html` +
      `?connectionId=${connectionId}`
    );
    await this.page.waitForLoadState('networkidle');
  }

  // Assertion helper
  expect<T>(actual: T | Promise<T>): Assertion<T> {
    return new Assertion(actual);
  }

  // Wait helper
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
