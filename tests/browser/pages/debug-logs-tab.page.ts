import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class DebugLogsTabPage extends BasePage {
    // Main elements
    readonly watchBtn: Locator;
    readonly refreshBtn: Locator;
    readonly settingsBtn: Locator;
    readonly filterInput: Locator;
    readonly editor: Locator;
    readonly table: Locator;
    readonly status: Locator;

    // Settings modal elements
    readonly settingsModal: Locator;
    readonly enableForMeBtn: Locator;
    readonly deleteLogsBtn: Locator;
    readonly deleteFlagsBtn: Locator;

    constructor(page: Page) {
        super(page);

        // Main elements - watchBtn is now a unified play/stop toggle
        this.watchBtn = page.locator('[data-testid="debug-logs-watch-btn"]');
        this.refreshBtn = page.locator('[data-testid="debug-logs-refresh-btn"]');
        this.settingsBtn = page.locator('[data-testid="debug-logs-settings-btn"]');
        this.filterInput = page.locator('[data-testid="debug-logs-filter-input"]');
        this.editor = page.locator('[data-testid="debug-logs-editor"]');
        this.table = page.locator('[data-testid="debug-logs-table"]');
        this.status = page.locator('[data-testid="debug-logs-status"]');

        // Settings modal elements
        this.settingsModal = page.locator('[data-testid="debug-logs-settings-modal"]');
        this.enableForMeBtn = page.locator('[data-testid="debug-logs-enable-for-me-btn"]');
        this.deleteLogsBtn = page.locator('[data-testid="debug-logs-delete-logs-btn"]');
        this.deleteFlagsBtn = page.locator('[data-testid="debug-logs-delete-flags-btn"]');
    }

    /**
     * Navigate to the Debug Logs tab
     */
    async navigateTo(): Promise<void> {
        const tabContent = this.page.locator('[data-testid="tab-content-logs"]');
        const isVisible = await tabContent.isVisible();
        if (isVisible) return;

        // Go home first if in a feature view
        const homeScreen = this.page.locator('[data-testid="home-screen"]');
        if (!(await homeScreen.isVisible())) {
            await this.slowClick(this.page.locator('[data-testid="back-to-home-btn"]'));
            await homeScreen.waitFor({ state: 'visible', timeout: 5000 });
        }
        // Click feature tile
        await this.slowClick(this.page.locator('[data-testid="tile-logs"]'));
        await this.page.waitForSelector('[data-testid="tab-content-logs"]', { timeout: 5000 });
        await this.afterNavigation();
    }

    /**
     * Start watching for debug logs (clicks the unified play/stop button)
     */
    async startWatching(): Promise<void> {
        await this.slowClick(this.watchBtn);
        // Wait for button title to change to "Stop watching" (indicates watching)
        await this.page.waitForFunction(
            () => {
                const btn = document.querySelector('[data-testid="debug-logs-watch-btn"]');
                return btn?.getAttribute('title') === 'Stop watching';
            },
            { timeout: 5000 }
        );
    }

    /**
     * Stop watching (clicks the unified play/stop button again)
     */
    async stopWatching(): Promise<void> {
        await this.slowClick(this.watchBtn);
        // Wait for button title to change to "Start watching" (indicates not watching)
        await this.page.waitForFunction(
            () => {
                const btn = document.querySelector('[data-testid="debug-logs-watch-btn"]');
                return btn?.getAttribute('title') === 'Start watching';
            },
            { timeout: 5000 }
        );
    }

    /**
     * Refresh logs
     */
    async refreshLogs(): Promise<void> {
        await this.slowClick(this.refreshBtn);
        // Wait for loading to complete
        await this.page.waitForTimeout(500);
    }

    /**
     * Open a log by index in the table
     */
    async openLog(index: number): Promise<void> {
        const rows = this.table.locator('tbody tr');
        const row = rows.nth(index);
        const openBtn = row.locator('button');
        await this.slowClick(openBtn);
        // Wait for loading to complete
        await this.page.waitForTimeout(500);
    }

    /**
     * Get the number of logs in the table
     */
    async getLogCount(): Promise<number> {
        const tableVisible = await this.table.isVisible();
        if (!tableVisible) return 0;
        return await this.table.locator('tbody tr').count();
    }

    /**
     * Open the settings modal
     */
    async openSettings(): Promise<void> {
        await this.slowClick(this.settingsBtn);
        await this.settingsModal.waitFor({ state: 'visible', timeout: 5000 });
    }

    /**
     * Close the settings modal
     */
    async closeSettings(): Promise<void> {
        // Use the close button with data-testid
        const closeBtn = this.page.locator('[data-testid="debug-logs-settings-close-btn"]');
        await this.slowClick(closeBtn);
        await this.settingsModal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Get status text
     */
    async getStatusText(): Promise<string> {
        const isVisible = await this.status.isVisible();
        if (!isVisible) return '';
        return (await this.status.textContent()) || '';
    }

    /**
     * Filter log content
     */
    async filterContent(text: string): Promise<void> {
        await this.slowFill(this.filterInput, text);
        // Wait for debounce
        await this.page.waitForTimeout(300);
    }

    /**
     * Check if watching is active (button title says "Stop watching")
     */
    async isWatching(): Promise<boolean> {
        const title = await this.watchBtn.getAttribute('title');
        return title === 'Stop watching';
    }

    /**
     * Get delete status text
     */
    async getDeleteStatusText(): Promise<string> {
        const toast = this.page.locator('[role="alert"][data-type="success"]').last();
        const isVisible = await toast.isVisible();
        if (!isVisible) return '';
        return (await toast.textContent()) || '';
    }

    /**
     * Wait for delete status to be visible
     */
    async waitForDeleteStatus(): Promise<void> {
        const toast = this.page.locator('[role="alert"][data-type="success"]').last();
        await toast.waitFor({ state: 'visible', timeout: 5000 });
    }
}
