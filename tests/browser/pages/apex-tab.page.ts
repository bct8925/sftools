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
        this.codeEditor = new MonacoHelpers(page, '[data-testid="apex-editor"]');
        this.outputEditor = new MonacoHelpers(page, '[data-testid="apex-output-editor"]');

        this.executeBtn = page.locator('[data-testid="apex-execute-btn"]');
        this.historyBtn = page.locator('[data-testid="apex-history-btn"]');
        this.statusBadge = page.locator('[data-testid="apex-status"]');
        this.searchInput = page.locator('[data-testid="apex-search-input"]');
    }

    /**
     * Navigate to the Apex tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on apex tab (must be visible, not just in DOM)
        const tabContent = this.page.locator('[data-testid="tab-content-apex"]');
        const isVisible = await tabContent.isVisible();
        if (isVisible) return;

        // Open hamburger menu and wait for nav item to be visible and stable
        await this.slowClick(this.page.locator('[data-testid="hamburger-btn"]'));
        const navItem = this.page.locator('[data-testid="mobile-nav-apex"]');
        await navItem.waitFor({ state: 'visible', timeout: 5000 });

        // Click the nav item
        await this.slowClick(navItem);
        await this.page.waitForSelector('[data-testid="tab-content-apex"]', { timeout: 5000 });
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
                const status = document.querySelector('[data-testid="apex-status"]');
                if (!status) return false;
                // Execution is complete when status has success or error class (not loading)
                return (
                    status.classList.contains('status-error') ||
                    status.classList.contains('status-success')
                );
            },
            { timeout: 60000 } // Apex execution can take longer
        );

        // Wait for log output to be updated (debounced state updates)
        await this.page.waitForTimeout(500);
    }

    /**
     * Execute using Ctrl/Cmd+Enter shortcut
     */
    async executeWithShortcut(): Promise<void> {
        await this.codeEditor.pressExecuteShortcut();

        await this.page.waitForFunction(
            () => {
                const status = document.querySelector('[data-testid="apex-status"]');
                if (!status) return false;
                return (
                    status.classList.contains('status-error') ||
                    status.classList.contains('status-success')
                );
            },
            { timeout: 60000 }
        );

        // Wait for log output to be updated (debounced state updates)
        await this.page.waitForTimeout(500);
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
        await this.page.waitForSelector('[data-testid="apex-history-modal"]', {
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
        const historyTab = this.page.locator('[data-testid="apex-history-tab"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const historyItems = await this.page.$$(
            '[data-testid="apex-history-list"] [data-testid="script-item"]'
        );
        if (historyItems[index]) {
            await historyItems[index].click();
        } else {
            throw new Error(`History item ${index} not found`);
        }

        // Wait for modal to close
        await this.page.waitForSelector('[data-testid="apex-history-modal"]', {
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
        const historyTab = this.page.locator('[data-testid="apex-history-tab"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const deleteButtons = await this.page.$$(
            '[data-testid="apex-history-list"] [data-testid="script-action-delete"]'
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
        await this.page.waitForSelector('[data-testid="apex-history-modal"]', {
            state: 'visible',
            timeout: 5000,
        });

        // Switch to favorites tab
        const favoritesTab = this.page.locator('[data-testid="apex-favorites-tab"]');
        await this.slowClick(favoritesTab);

        // Wait for favorites list to be visible
        await this.page.waitForSelector('[data-testid="apex-favorites-list"]', {
            state: 'visible',
            timeout: 5000,
        });
    }

    /**
     * Save current Apex script to favorites with a label
     */
    async saveToFavorites(label: string): Promise<void> {
        await this.openHistory();

        // Click the favorite button on the first history item
        await this.delay('beforeClick');
        const favoriteBtn = this.page
            .locator('[data-testid="apex-history-list"] [data-testid="script-action-favorite"]')
            .first();
        await this.slowClick(favoriteBtn);

        // Wait for favorite modal to open
        await this.page.waitForSelector('[data-testid="apex-favorite-dialog"]', {
            state: 'visible',
            timeout: 5000,
        });

        // Enter label
        const labelInput = this.page.locator('[data-testid="apex-favorite-input"]');
        await labelInput.fill(label);

        // Click save
        const saveBtn = this.page.locator('[data-testid="apex-favorite-save"]');
        await this.slowClick(saveBtn);

        // Wait for modal to close
        await this.page.waitForSelector('[data-testid="apex-favorite-dialog"]', {
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
        const favoriteItems = await this.page.$$(
            '[data-testid="apex-favorites-list"] [data-testid="script-item"]'
        );
        if (favoriteItems[index]) {
            await favoriteItems[index].click();
        } else {
            throw new Error(`Favorite item ${index} not found`);
        }

        // Wait for modal to close
        await this.page.waitForSelector('[data-testid="apex-history-modal"]', {
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
            '[data-testid="apex-favorites-list"] [data-testid="script-action-delete"]'
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
        // Wait for modal to be removed from DOM
        await this.page.waitForSelector('[data-testid="apex-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Get the number of items in history
     */
    async getHistoryCount(): Promise<number> {
        // Make sure we're on the history tab
        const historyTab = this.page.locator('[data-testid="apex-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await this.slowClick(historyTab);
        }

        const count = await this.page.$$eval(
            '[data-testid="apex-history-list"] [data-testid="script-item"]',
            (items: Element[]) => items.length
        );

        return count;
    }

    /**
     * Get the text of all history items
     */
    async getHistoryItems(): Promise<string[]> {
        // Make sure we're on the history tab
        const historyTab = this.page.locator('[data-testid="apex-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await this.slowClick(historyTab);
        }

        const items = await this.page.$$eval(
            '[data-testid="apex-history-list"] [data-testid="script-preview"]',
            (previews: Element[]) => previews.map(p => p.textContent?.trim() || '')
        );

        return items;
    }
}
