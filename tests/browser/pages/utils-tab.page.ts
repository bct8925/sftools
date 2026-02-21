import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class UtilsTabPage extends BasePage {
    // Debug Logs elements
    readonly enableForMeBtn: Locator;
    readonly userSearchInput: Locator;
    readonly userResults: Locator;
    readonly traceStatus: Locator;
    readonly traceStatusIndicator: Locator;
    readonly traceStatusText: Locator;
    readonly deleteLogsBtn: Locator;
    readonly deleteFlagsBtn: Locator;
    readonly deleteStatus: Locator;
    readonly deleteStatusIndicator: Locator;
    readonly deleteStatusText: Locator;

    // Flow Cleanup elements
    readonly flowSearchInput: Locator;
    readonly flowSearchDropdown: Locator;
    readonly flowVersionsSection: Locator;
    readonly flowInfo: Locator;
    readonly deleteVersionsBtn: Locator;
    readonly flowCleanupStatus: Locator;
    readonly flowCleanupStatusIndicator: Locator;
    readonly flowCleanupStatusText: Locator;

    // Schema Browser Link
    readonly openSchemaBtn: Locator;

    constructor(page: Page) {
        super(page);

        // Debug Logs elements
        this.enableForMeBtn = page.locator('[data-testid="debug-logs-enable-for-me-btn"]');
        this.userSearchInput = page.locator('[data-testid="debug-logs-user-search"]');
        this.userResults = page.locator('[data-testid="debug-logs-user-results"]');
        this.traceStatus = page.locator('[data-testid="debug-logs-trace-status"]');
        this.traceStatusIndicator = page.locator(
            '[data-testid="debug-logs-trace-status"] .status-indicator'
        );
        this.traceStatusText = page.locator('[data-testid="debug-logs-trace-status-text"]');
        this.deleteLogsBtn = page.locator('[data-testid="debug-logs-delete-logs-btn"]');
        this.deleteFlagsBtn = page.locator('[data-testid="debug-logs-delete-flags-btn"]');
        this.deleteStatus = page.locator('[data-testid="debug-logs-delete-status"]');
        this.deleteStatusIndicator = page.locator(
            '[data-testid="debug-logs-delete-status"] .status-indicator'
        );
        this.deleteStatusText = page.locator('[data-testid="debug-logs-delete-status-text"]');

        // Flow Cleanup elements
        this.flowSearchInput = page.locator('[data-testid="flow-cleanup-search"]');
        this.flowSearchDropdown = page.locator('[data-testid="flow-cleanup-dropdown"]');
        this.flowVersionsSection = page.locator('[data-testid="flow-cleanup-versions"]');
        this.flowInfo = page.locator('[data-testid="flow-cleanup-info"]');
        this.deleteVersionsBtn = page.locator('[data-testid="flow-cleanup-delete-btn"]');
        this.flowCleanupStatus = page.locator('[data-testid="flow-cleanup-status"]');
        this.flowCleanupStatusIndicator = page.locator(
            '[data-testid="flow-cleanup-status"] .status-indicator'
        );
        this.flowCleanupStatusText = page.locator('[data-testid="flow-cleanup-status-text"]');

        // Schema Browser Link
        this.openSchemaBtn = page.locator('[data-testid="open-schema-btn"]');
    }

    /**
     * Navigate to the Utils tab
     */
    async navigateTo(): Promise<void> {
        // Check if already on utils tab (must be visible, not just in DOM)
        const tabContent = this.page.locator('[data-testid="tab-content-utils"]');
        const isVisible = await tabContent.isVisible();
        if (isVisible) return;

        // Go home first if in a feature view
        const homeScreen = this.page.locator('[data-testid="home-screen"]');
        if (!(await homeScreen.isVisible())) {
            await this.slowClick(this.page.locator('[data-testid="back-to-home-btn"]'));
            await homeScreen.waitFor({ state: 'visible', timeout: 5000 });
        }
        // Click feature tile
        await this.slowClick(this.page.locator('[data-testid="tile-utils"]'));
        await this.page.waitForSelector('[data-testid="tab-content-utils"]', { timeout: 5000 });
        await this.afterNavigation();
    }

    /**
     * Enable trace flag for current user
     */
    async enableTraceFlagForSelf(): Promise<void> {
        await this.slowClick(this.enableForMeBtn);

        // Wait for status to become visible and not be in loading state
        await this.traceStatus.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForFunction(
            () => {
                const indicator = document.querySelector(
                    '[data-testid="debug-logs-trace-status"] .status-indicator'
                );
                if (!indicator) return false;
                return (
                    indicator.classList.contains('status-success') ||
                    indicator.classList.contains('status-error')
                );
            },
            { timeout: 10000 }
        );
    }

    /**
     * Get the trace flag status text
     */
    async getTraceStatus(): Promise<string> {
        return (await this.traceStatusText.textContent()) || '';
    }

    /**
     * Get the trace flag status type
     */
    async getTraceStatusType(): Promise<'success' | 'error' | 'loading' | 'unknown'> {
        const classList = await this.traceStatusIndicator.evaluate(el => Array.from(el.classList));

        if (classList.includes('status-success')) return 'success';
        if (classList.includes('status-error')) return 'error';
        if (classList.includes('status-loading')) return 'loading';
        return 'unknown';
    }

    /**
     * Delete all debug logs
     */
    async deleteAllDebugLogs(): Promise<void> {
        await this.slowClick(this.deleteLogsBtn);
    }

    /**
     * Confirm delete dialog
     */
    async confirmDelete(): Promise<void> {
        this.page.once('dialog', async dialog => {
            await dialog.accept();
        });
    }

    /**
     * Get the delete operation status text
     */
    async getDeleteStatus(): Promise<string> {
        return (await this.deleteStatusText.textContent()) || '';
    }

    /**
     * Get the delete operation status type
     */
    async getDeleteStatusType(): Promise<'success' | 'error' | 'loading' | 'unknown'> {
        const classList = await this.deleteStatusIndicator.evaluate(el => Array.from(el.classList));

        if (classList.includes('status-success')) return 'success';
        if (classList.includes('status-error')) return 'error';
        if (classList.includes('status-loading')) return 'loading';
        return 'unknown';
    }

    // ============================================================
    // Debug Logs - User Search Methods
    // ============================================================

    /**
     * Search for users by name or username
     */
    async searchUsers(term: string): Promise<void> {
        await this.slowFill(this.userSearchInput, term);

        // Wait for search debounce and results to appear
        await this.page.waitForTimeout(400);
    }

    /**
     * Select a user from the search results
     */
    async selectUser(name: string): Promise<void> {
        // Wait for results to be visible
        await this.userResults.waitFor({ state: 'visible', timeout: 5000 });

        // Find and click the user by name
        const userItem = this.page.locator(
            '[data-testid="debug-logs-user-results"] .search-box-item',
            {
                has: this.page.locator('.search-box-item-name', { hasText: name }),
            }
        );
        await this.slowClick(userItem);

        // Wait for status to update
        await this.traceStatus.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForFunction(
            () => {
                const indicator = document.querySelector(
                    '[data-testid="debug-logs-trace-status"] .status-indicator'
                );
                if (!indicator) return false;
                return (
                    indicator.classList.contains('status-success') ||
                    indicator.classList.contains('status-error')
                );
            },
            { timeout: 10000 }
        );
    }

    /**
     * Enable trace flag for a specific user (after searching and selecting)
     */
    async enableTraceForUser(): Promise<void> {
        // This happens automatically when selecting a user via selectUser()
        // This method is kept for API consistency but doesn't need to do anything
    }

    /**
     * Delete all debug logs
     */
    async deleteAllLogs(): Promise<void> {
        await this.slowClick(this.deleteLogsBtn);

        // Wait for status to update
        await this.deleteStatus.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForFunction(
            () => {
                const indicator = document.querySelector(
                    '[data-testid="debug-logs-delete-status"] .status-indicator'
                );
                if (!indicator) return false;
                return (
                    indicator.classList.contains('status-success') ||
                    indicator.classList.contains('status-error')
                );
            },
            { timeout: 30000 } // Longer timeout for bulk delete
        );
    }

    /**
     * Delete all trace flags
     */
    async deleteAllTraceFlags(): Promise<void> {
        await this.slowClick(this.deleteFlagsBtn);

        // Wait for status to update
        await this.deleteStatus.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForFunction(
            () => {
                const indicator = document.querySelector(
                    '[data-testid="debug-logs-delete-status"] .status-indicator'
                );
                if (!indicator) return false;
                return (
                    indicator.classList.contains('status-success') ||
                    indicator.classList.contains('status-error')
                );
            },
            { timeout: 30000 } // Longer timeout for bulk delete
        );
    }

    /**
     * Get the debug logs status (trace flag or delete operation)
     */
    async getDebugLogsStatus(): Promise<{ text: string; type: string }> {
        // Check which status is visible and return that one
        const traceVisible = await this.traceStatus.isVisible();
        const deleteVisible = await this.deleteStatus.isVisible();

        if (traceVisible) {
            const text = (await this.traceStatusText.textContent()) || '';
            const type = await this.getTraceStatusType();
            return { text, type };
        } else if (deleteVisible) {
            const text = (await this.deleteStatusText.textContent()) || '';
            const type = await this.getDeleteStatusType();
            return { text, type };
        }

        return { text: '', type: 'unknown' };
    }

    // ============================================================
    // Flow Cleanup Methods
    // ============================================================

    /**
     * Search for flows by name
     */
    async searchFlows(term: string): Promise<void> {
        await this.slowFill(this.flowSearchInput, term);

        // Wait for search debounce and dropdown to appear
        await this.page.waitForTimeout(400);
        await this.flowSearchDropdown.waitFor({ state: 'visible', timeout: 5000 });
    }

    /**
     * Select a flow from the search results
     */
    async selectFlow(name: string): Promise<void> {
        // Wait for dropdown to be visible
        await this.flowSearchDropdown.waitFor({ state: 'visible', timeout: 5000 });

        // Find and click the flow by name
        const flowItem = this.page.locator(
            '[data-testid="flow-cleanup-dropdown"] .search-box-item',
            {
                has: this.page.locator('.search-box-item-name', { hasText: name }),
            }
        );
        await this.slowClick(flowItem);

        // Wait for versions section to appear or status to show
        await Promise.race([
            this.flowVersionsSection.waitFor({ state: 'visible', timeout: 10000 }),
            this.flowCleanupStatus.waitFor({ state: 'visible', timeout: 10000 }),
        ]);
    }

    /**
     * Get flow version information displayed
     */
    async getFlowVersions(): Promise<string[]> {
        // Wait for flow info to be visible
        await this.flowInfo.waitFor({ state: 'visible', timeout: 5000 });

        // Get the text content and parse it
        const infoText = (await this.flowInfo.textContent()) || '';

        // Return as array of lines for easy assertion
        return infoText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    /**
     * Delete inactive flow versions
     */
    async deleteInactiveVersions(): Promise<void> {
        await this.slowClick(this.deleteVersionsBtn);

        // Wait for status to update
        await this.flowCleanupStatus.waitFor({ state: 'visible', timeout: 10000 });
        await this.page.waitForFunction(
            () => {
                const indicator = document.querySelector(
                    '[data-testid="flow-cleanup-status"] .status-indicator'
                );
                if (!indicator) return false;
                return (
                    indicator.classList.contains('status-success') ||
                    indicator.classList.contains('status-error')
                );
            },
            { timeout: 30000 } // Longer timeout for bulk delete
        );
    }

    /**
     * Get the flow cleanup status
     */
    async getFlowCleanupStatus(): Promise<{ text: string; type: string }> {
        const text = (await this.flowCleanupStatusText.textContent()) || '';

        const classList = await this.flowCleanupStatusIndicator.evaluate(el =>
            Array.from(el.classList)
        );

        let type = 'unknown';
        if (classList.includes('status-success')) type = 'success';
        else if (classList.includes('status-error')) type = 'error';
        else if (classList.includes('status-loading')) type = 'loading';

        return { text, type };
    }

    // ============================================================
    // Schema Browser Link Methods
    // ============================================================

    /**
     * Click the Schema Browser link
     */
    async clickSchemaBrowserLink(): Promise<void> {
        await this.slowClick(this.openSchemaBtn);
    }
}
