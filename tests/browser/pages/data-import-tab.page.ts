import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class DataImportTabPage extends BasePage {
    readonly tabContent: Locator;
    readonly operationSection: Locator;
    readonly operationSelect: Locator;
    readonly csvSection: Locator;
    readonly browseBtn: Locator;
    readonly executeBtn: Locator;

    constructor(page: Page) {
        super(page);

        this.tabContent = page.locator('[data-testid="tab-content-data-import"]');
        this.operationSection = page.locator('[data-testid="data-import-operation-section"]');
        this.operationSelect = page.locator('[data-testid="data-import-operation-select"]');
        this.csvSection = page.locator('[data-testid="data-import-csv-section"]');
        this.browseBtn = page.locator('[data-testid="data-import-browse-btn"]');
        this.executeBtn = page.locator('[data-testid="data-import-execute-btn"]');
    }

    /**
     * Navigate to the Data Import tab from the home screen
     */
    async navigateTo(): Promise<void> {
        if (await this.tabContent.isVisible()) return;

        const homeScreen = this.page.locator('[data-testid="home-screen"]');
        if (!(await homeScreen.isVisible())) {
            await this.slowClick(this.page.locator('[data-testid="waffle-btn"]'));
            await homeScreen.waitFor({ state: 'visible', timeout: 5000 });
        }
        await this.slowClick(this.page.locator('[data-testid="tile-data-import"]'));
        // Wait for the operation section (rendered child) rather than the tab wrapper,
        // since the wrapper has height:100% which Playwright may see as hidden during
        // the first lazy-load Suspense cycle.
        await this.operationSection.waitFor({ state: 'visible', timeout: 10000 });
        await this.afterNavigation();
    }

    /**
     * Get the currently selected operation value
     */
    async getSelectedOperation(): Promise<string> {
        return this.operationSelect.inputValue();
    }

    /**
     * Check if the execute button is disabled
     */
    async isExecuteButtonDisabled(): Promise<boolean> {
        return this.executeBtn.isDisabled();
    }
}
