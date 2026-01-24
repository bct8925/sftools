import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class ApexTabPage extends BasePage {
    readonly codeEditor: MonacoHelpers;
    readonly outputEditor: MonacoHelpers;

    // Elements
    readonly executeBtn: Locator;
    readonly historyBtn: Locator;
    readonly statusBadge: Locator;
    readonly searchInput: Locator;

    constructor(page: Page) {
        super(page);
        this.codeEditor = new MonacoHelpers(page, 'apex-tab .apex-editor');
        this.outputEditor = new MonacoHelpers(page, 'apex-tab .apex-output-editor');

        this.executeBtn = page.locator('apex-tab .apex-execute-btn');
        this.historyBtn = page.locator('apex-tab .apex-history-btn');
        // Note: The element starts with class="apex-status status-badge" but updateStatusBadge
        // replaces className with "status-badge status-{type}", removing apex-status
        this.statusBadge = page.locator('apex-tab .m-top_small .status-badge');
        this.searchInput = page.locator('apex-tab .search-input');
    }

    /**
     * Navigate to the Apex tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on apex tab
        const isActive = (await this.page.locator('apex-tab.active').count()) > 0;
        if (isActive) return;

        // Open hamburger menu and wait for nav item to be visible and stable
        await this.slowClick(this.page.locator('.hamburger-btn'));
        const navItem = this.page.locator('.mobile-nav-item[data-tab="apex"]');
        await navItem.waitFor({ state: 'visible', timeout: 5000 });

        // Click the nav item
        await this.slowClick(navItem);
        await this.page.waitForSelector('apex-tab.active', { timeout: 5000 });
        await this.afterNavigation();
    }

    /**
     * Set the Apex code
     */
    async setCode(code: string): Promise<void> {
        await this.delay('beforeType');
        await this.codeEditor.setValue(code);
    }

    /**
     * Get the current Apex code
     */
    async getCode(): Promise<string> {
        return this.codeEditor.getValue();
    }

    /**
     * Execute the Apex code
     */
    async execute(): Promise<void> {
        await this.slowClick(this.executeBtn);

        // Wait for execution to complete - status badge will have status-success or status-error class
        await this.page.waitForFunction(
            () => {
                const status = document.querySelector('apex-tab .m-top_small .status-badge');
                if (!status) return false;
                // Execution is complete when status has success or error class (not loading)
                return (
                    status.classList.contains('status-error') ||
                    status.classList.contains('status-success')
                );
            },
            { timeout: 60000 } // Apex execution can take longer
        );
    }

    /**
     * Execute using Ctrl/Cmd+Enter shortcut
     */
    async executeWithShortcut(): Promise<void> {
        await this.codeEditor.pressExecuteShortcut();

        await this.page.waitForFunction(
            () => {
                const status = document.querySelector('apex-tab .m-top_small .status-badge');
                if (!status) return false;
                return (
                    status.classList.contains('status-error') ||
                    status.classList.contains('status-success')
                );
            },
            { timeout: 60000 }
        );
    }

    /**
     * Get the status
     */
    async getStatus(): Promise<{ text: string; success: boolean }> {
        const text = (await this.statusBadge.textContent()) || '';
        const classList = await this.statusBadge.evaluate(el => Array.from(el.classList));

        const success = classList.includes('status-success');

        return { text: text.trim(), success };
    }

    /**
     * Get the debug log content
     */
    async getLogContent(): Promise<string> {
        return this.outputEditor.getValue();
    }

    /**
     * Check if there are compile error markers in the code editor
     */
    async hasCompileErrors(): Promise<boolean> {
        const markers = await this.codeEditor.getMarkers();
        return markers.some((m: any) => m.severity === 8); // 8 = Error
    }

    /**
     * Get compile error markers
     */
    async getErrorMarkers(): Promise<any[]> {
        const markers = await this.codeEditor.getMarkers();
        return markers.filter((m: any) => m.severity === 8);
    }

    /**
     * Filter the debug log
     */
    async filterLog(searchTerm: string): Promise<void> {
        await this.searchInput.fill(searchTerm);
        await this.page.waitForTimeout(300);
    }

    /**
     * Clear the log filter
     */
    async clearLogFilter(): Promise<void> {
        await this.searchInput.fill('');
        await this.page.waitForTimeout(300);
    }

    /**
     * Clear both code and output
     */
    async clear(): Promise<void> {
        await this.codeEditor.clear();
    }

    /**
     * Open history modal
     */
    async openHistory(): Promise<void> {
        await this.slowClick(this.historyBtn);
        await this.page.waitForSelector('apex-tab .apex-history-modal', {
            state: 'visible',
            timeout: 5000,
        });
    }

    /**
     * Load an Apex script from history by index
     */
    async loadFromHistory(index: number): Promise<void> {
        await this.openHistory();

        // Make sure we're on the history tab
        const historyTab = this.page.locator('apex-tab .dropdown-tab[data-tab="history"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const historyItems = await this.page.$$('apex-tab .apex-history-list .script-item');
        if (historyItems[index]) {
            await historyItems[index].click();
        } else {
            throw new Error(`History item ${index} not found`);
        }

        // Wait for modal to close
        await this.page.waitForSelector('apex-tab .apex-history-modal', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Delete an Apex script from history by index
     */
    async deleteFromHistory(index: number): Promise<void> {
        await this.openHistory();

        // Make sure we're on the history tab
        const historyTab = this.page.locator('apex-tab .dropdown-tab[data-tab="history"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const deleteButtons = await this.page.$$(
            'apex-tab .apex-history-list .script-item .script-action.delete'
        );
        if (deleteButtons[index]) {
            await deleteButtons[index].click();
        } else {
            throw new Error(`History item ${index} not found`);
        }
    }

    /**
     * Open favorites tab in history modal
     */
    async openFavorites(): Promise<void> {
        await this.slowClick(this.historyBtn);
        await this.page.waitForSelector('apex-tab .apex-history-modal', {
            state: 'visible',
            timeout: 5000,
        });

        // Switch to favorites tab
        const favoritesTab = this.page.locator('apex-tab .dropdown-tab[data-tab="favorites"]');
        await this.slowClick(favoritesTab);
    }

    /**
     * Save current Apex script to favorites with a label
     */
    async saveToFavorites(label: string): Promise<void> {
        await this.openHistory();

        // Click the favorite button on the first history item
        await this.delay('beforeClick');
        const favoriteBtn = this.page
            .locator('apex-tab .apex-history-list .script-item .script-action.favorite')
            .first();
        await this.slowClick(favoriteBtn);

        // Wait for favorite modal to open
        await this.page.waitForSelector('.apex-favorite-dialog', {
            state: 'visible',
            timeout: 5000,
        });

        // Enter label
        const labelInput = this.page.locator('.apex-favorite-input');
        await labelInput.fill(label);

        // Click save
        const saveBtn = this.page.locator('.apex-favorite-save');
        await this.slowClick(saveBtn);

        // Wait for modal to close
        await this.page.waitForSelector('.apex-favorite-dialog', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Load an Apex script from favorites by index
     */
    async loadFromFavorites(index: number): Promise<void> {
        await this.openFavorites();

        await this.delay('beforeClick');
        const favoriteItems = await this.page.$$('apex-tab .apex-favorites-list .script-item');
        if (favoriteItems[index]) {
            await favoriteItems[index].click();
        } else {
            throw new Error(`Favorite item ${index} not found`);
        }

        // Wait for modal to close
        await this.page.waitForSelector('apex-tab .apex-history-modal', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Delete an Apex script from favorites by index
     */
    async deleteFromFavorites(index: number): Promise<void> {
        await this.openFavorites();

        await this.delay('beforeClick');
        const deleteButtons = await this.page.$$(
            'apex-tab .apex-favorites-list .script-item .script-action.delete'
        );
        if (deleteButtons[index]) {
            await deleteButtons[index].click();
        } else {
            throw new Error(`Favorite item ${index} not found`);
        }
    }

    /**
     * Close the history modal
     */
    async closeHistory(): Promise<void> {
        // Press Escape to close modal
        await this.page.keyboard.press('Escape');
        // Wait for modal to close
        await this.page.waitForFunction(
            () => {
                const modal = document.querySelector('apex-tab .apex-history-modal');
                return modal && !modal.classList.contains('open');
            },
            { timeout: 5000 }
        );
    }
}
