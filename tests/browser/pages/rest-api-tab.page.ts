import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class RestApiTabPage extends BasePage {
    readonly requestMonaco: MonacoHelpers;
    readonly responseMonaco: MonacoHelpers;

    // Elements
    readonly methodSelect: Locator;
    readonly urlInput: Locator;
    readonly sendBtn: Locator;
    readonly statusBadge: Locator;
    readonly bodyContainer: Locator;
    readonly historyBtn: Locator;

    constructor(page: Page) {
        super(page);
        this.requestMonaco = new MonacoHelpers(page, '[data-testid="rest-request-editor"]');
        this.responseMonaco = new MonacoHelpers(page, '[data-testid="rest-response-editor"]');

        this.methodSelect = page.locator('[data-testid="rest-method-select"]');
        this.urlInput = page.locator('[data-testid="rest-api-url"]');
        this.sendBtn = page.locator('[data-testid="rest-send-btn"]');
        this.statusBadge = page.locator('[role="alert"]').first();
        this.bodyContainer = page.locator('[data-testid="rest-body-container"]');
        this.historyBtn = page.locator('[data-testid="rest-api-history-btn"]');
    }

    /**
     * Navigate to the REST API tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on rest-api tab (must be visible, not just in DOM)
        const tabContent = this.page.locator('[data-testid="tab-content-rest-api"]');
        const isVisible = await tabContent.isVisible();
        if (isVisible) return;

        // Go home first if in a feature view
        const homeScreen = this.page.locator('[data-testid="home-screen"]');
        if (!(await homeScreen.isVisible())) {
            await this.slowClick(this.page.locator('[data-testid="waffle-btn"]'));
            await homeScreen.waitFor({ state: 'visible', timeout: 5000 });
        }
        // Click feature tile
        await this.slowClick(this.page.locator('[data-testid="tile-rest-api"]'));
        await this.page.waitForSelector('[data-testid="tab-content-rest-api"]', { timeout: 5000 });
        await this.afterNavigation();
    }

    /**
     * Set the HTTP method
     */
    async setMethod(method: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<void> {
        await this.delay('beforeClick');
        await this.methodSelect.selectOption(method);
    }

    /**
     * Set the endpoint URL (relative to instance)
     */
    async setEndpoint(url: string): Promise<void> {
        await this.slowFill(this.urlInput, url);
    }

    /**
     * Set the request body (for POST/PATCH)
     */
    async setRequestBody(json: string): Promise<void> {
        await this.delay('beforeType');
        await this.requestMonaco.setValue(json);
    }

    /**
     * Send the request and wait for completion
     */
    async send(): Promise<void> {
        await this.slowClick(this.sendBtn);

        // Wait for request to complete - toast will have data-type="success" or "error"
        await this.page.waitForFunction(
            () => {
                const toast = document.querySelector(
                    '[role="alert"][data-type="success"], [role="alert"][data-type="error"]'
                );
                return toast !== null;
            },
            { timeout: 30000 }
        );
    }

    /**
     * Get the status text and type
     */
    async getStatus(): Promise<{
        text: string;
        type: 'success' | 'error' | 'loading' | 'default';
    }> {
        const toast = this.page.locator('[role="alert"]').first();
        const text = (await toast.textContent()) || '';
        const type = (await toast.getAttribute('data-type')) as
            | 'success'
            | 'error'
            | 'loading'
            | null;
        return { text: text.trim(), type: type ?? 'default' };
    }

    /**
     * Get the response value from the Monaco editor
     */
    async getResponse(): Promise<string> {
        return this.responseMonaco.getValue();
    }

    /**
     * Execute request via Ctrl/Cmd+Enter keyboard shortcut in the body editor
     */
    async executeWithShortcut(): Promise<void> {
        await this.requestMonaco.pressExecuteShortcut();

        await this.page.waitForFunction(
            () => {
                const toast = document.querySelector(
                    '[role="alert"][data-type="success"], [role="alert"][data-type="error"]'
                );
                return toast !== null;
            },
            { timeout: 30000 }
        );
    }

    /**
     * Check if the request body editor is currently visible
     */
    async isBodyEditorVisible(): Promise<boolean> {
        return this.bodyContainer.isVisible();
    }

    /**
     * Get the current endpoint URL value
     */
    async getEndpoint(): Promise<string> {
        return (await this.urlInput.inputValue()) || '';
    }

    /**
     * Get the current HTTP method value
     */
    async getMethod(): Promise<string> {
        return (await this.methodSelect.inputValue()) || '';
    }

    /**
     * Open the history modal
     */
    async openHistory(): Promise<void> {
        await this.slowClick(this.historyBtn);
        await this.page.waitForSelector('[data-testid="rest-api-history-modal"]', {
            state: 'visible',
            timeout: 5000,
        });
    }

    /**
     * Close the history modal
     */
    async closeHistory(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await this.page.waitForSelector('[data-testid="rest-api-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Get the number of items in history
     */
    async getHistoryCount(): Promise<number> {
        const historyTab = this.page.locator('[data-testid="rest-api-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await this.slowClick(historyTab);
        }

        return this.page.$$eval(
            '[data-testid="rest-api-history-list"] [data-testid="script-item"]',
            (items: Element[]) => items.length
        );
    }

    /**
     * Get the text of all history item previews
     */
    async getHistoryItems(): Promise<string[]> {
        const historyTab = this.page.locator('[data-testid="rest-api-history-tab"]');
        const isHistoryActive = await historyTab.evaluate(
            (el: Element) => el.classList.contains('active') || el.classList.contains('_active_')
        );
        if (!isHistoryActive) {
            await this.slowClick(historyTab);
        }

        return this.page.$$eval(
            '[data-testid="rest-api-history-list"] [data-testid="script-preview"]',
            (previews: Element[]) => previews.map(p => p.textContent?.trim() || '')
        );
    }

    /**
     * Load a request from history by index
     */
    async loadFromHistory(index: number): Promise<void> {
        await this.openHistory();

        const historyTab = this.page.locator('[data-testid="rest-api-history-tab"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const historyItems = await this.page.$$(
            '[data-testid="rest-api-history-list"] [data-testid="script-item"]'
        );
        if (historyItems[index]) {
            await historyItems[index].click();
        } else {
            throw new Error(`History item ${index} not found`);
        }

        await this.page.waitForSelector('[data-testid="rest-api-history-modal"]', {
            state: 'hidden',
            timeout: 5000,
        });
    }

    /**
     * Delete a request from history by index
     */
    async deleteFromHistory(index: number): Promise<void> {
        await this.openHistory();

        const historyTab = this.page.locator('[data-testid="rest-api-history-tab"]');
        await this.slowClick(historyTab);

        await this.delay('beforeClick');
        const deleteButtons = await this.page.$$(
            '[data-testid="rest-api-history-list"] [data-testid="script-action-delete"]'
        );
        if (deleteButtons[index]) {
            await deleteButtons[index].click();
        } else {
            throw new Error(`History item ${index} not found`);
        }
    }
}
