import type { Page, BrowserContext } from 'playwright';
import type { TestContext, TestConfig } from './types';
import type { SalesforceClient } from '../services/salesforce-client';
import { Assertion } from './assertions';

// Forward declarations for page objects (lazy loaded)
import type { QueryTabPage } from '../pages/query-tab.page';
import type { ApexTabPage } from '../pages/apex-tab.page';
import type { RecordPage } from '../pages/record.page';
import type { SchemaPage } from '../pages/schema.page';
import type { UtilsTabPage } from '../pages/utils-tab.page';
import type { SettingsTabPage } from '../pages/settings-tab.page';
import type { RestApiTabPage } from '../pages/rest-api-tab.page';
import type { EventsTabPage } from '../pages/events-tab.page';

export abstract class SftoolsTest {
    protected page: Page;
    protected context: BrowserContext;
    protected extensionId: string;
    /** Base URL for headless mode (e.g., "http://localhost:5173"). Empty string in extension mode. */
    protected baseUrl: string;
    protected salesforce: SalesforceClient;
    protected config: TestConfig;

    // Page objects (lazy-loaded)
    private _queryTab?: QueryTabPage;
    private _apexTab?: ApexTabPage;
    private _recordPage?: RecordPage;
    private _schemaPage?: SchemaPage;
    private _utilsTab?: UtilsTabPage;
    private _settingsTab?: SettingsTabPage;
    private _restApiTab?: RestApiTabPage;
    private _eventsTab?: EventsTabPage;

    constructor(ctx: TestContext) {
        this.page = ctx.page;
        this.context = ctx.context;
        this.extensionId = ctx.extensionId;
        this.baseUrl = ctx.baseUrl;
        this.salesforce = ctx.salesforce;
        this.config = ctx.config;
    }

    /**
     * Check if running in headless mode (pages loaded from Vite server).
     */
    protected isHeadlessMode(): boolean {
        return this.baseUrl !== '';
    }

    /**
     * Build URL for navigation, handling both extension and headless modes.
     */
    private buildUrl(path: string): string {
        if (this.baseUrl) {
            // Headless mode - use Vite server
            return `${this.baseUrl}${path}`;
        } else {
            // Extension mode - use chrome-extension:// URL
            return `chrome-extension://${this.extensionId}${path}`;
        }
    }

    // Lifecycle methods - override in subclasses
    async setup(): Promise<void> {}
    async teardown(): Promise<void> {}
    abstract test(): Promise<void>;

    /**
     * Configure mock responses for this test.
     * Override this method to set up custom mock routes.
     * The MockRouter will be set up before the test runs.
     *
     * @returns MockRouter instance or null if no custom mocks needed
     */
    configureMocks(): any | null {
        return null;
    }

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

    get utilsTab(): UtilsTabPage {
        if (!this._utilsTab) {
            const { UtilsTabPage } = require('../pages/utils-tab.page');
            this._utilsTab = new UtilsTabPage(this.page);
            this._utilsTab.setConfig(this.config);
        }
        return this._utilsTab!;
    }

    get settingsTab(): SettingsTabPage {
        if (!this._settingsTab) {
            const { SettingsTabPage } = require('../pages/settings-tab.page');
            this._settingsTab = new SettingsTabPage(this.page);
            this._settingsTab.setConfig(this.config);
        }
        return this._settingsTab!;
    }

    get restApiTab(): RestApiTabPage {
        if (!this._restApiTab) {
            const { RestApiTabPage } = require('../pages/rest-api-tab.page');
            this._restApiTab = new RestApiTabPage(this.page);
            this._restApiTab.setConfig(this.config);
        }
        return this._restApiTab!;
    }

    get eventsTab(): EventsTabPage {
        if (!this._eventsTab) {
            const { EventsTabPage } = require('../pages/events-tab.page');
            this._eventsTab = new EventsTabPage(this.page);
            this._eventsTab.setConfig(this.config);
        }
        return this._eventsTab!;
    }

    // Navigation helpers
    async navigateToExtension(): Promise<void> {
        // In headless mode, server serves from dist, so no /dist prefix needed
        // In extension mode, we need /dist prefix
        const targetPath = this.baseUrl ? '/pages/app/app.html' : '/dist/pages/app/app.html';
        const currentUrl = this.page.url();

        // Skip if already on the app page
        if (currentUrl.includes('pages/app/app')) {
            return;
        }

        await this.page.goto(this.buildUrl(targetPath));
        await this.page.waitForLoadState('networkidle');
    }

    async navigateToRecord(objectType: string, recordId: string): Promise<void> {
        const connectionId = this.salesforce.getConnectionId();
        // In headless mode, server serves from dist, so no /dist prefix needed
        const basePath = this.baseUrl ? '/pages/record/record.html' : '/dist/pages/record/record.html';
        const path = `${basePath}?objectType=${objectType}&recordId=${recordId}&connectionId=${connectionId}`;
        await this.page.goto(this.buildUrl(path));
        await this.page.waitForLoadState('networkidle');
    }

    async navigateToSchema(): Promise<void> {
        const connectionId = this.salesforce.getConnectionId();
        // In headless mode, server serves from dist, so no /dist prefix needed
        const basePath = this.baseUrl ? '/pages/schema/schema.html' : '/dist/pages/schema/schema.html';
        const path = `${basePath}?connectionId=${connectionId}`;
        await this.page.goto(this.buildUrl(path));
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
