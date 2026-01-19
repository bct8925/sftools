import type { Page, Locator } from 'playwright';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class QueryTabPage {
  private page: Page;
  readonly monaco: MonacoHelpers;

  // Elements
  readonly executeBtn: Locator;
  readonly historyBtn: Locator;
  readonly settingsBtn: Locator;
  readonly resultsBtn: Locator;
  readonly toolingCheckbox: Locator;
  readonly editingCheckbox: Locator;
  readonly tabsContainer: Locator;
  readonly resultsContainer: Locator;
  readonly statusBadge: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.monaco = new MonacoHelpers(page, 'query-tab monaco-editor');

    this.executeBtn = page.locator('query-tab .query-action-btn');
    this.historyBtn = page.locator('query-tab .query-history-btn');
    this.settingsBtn = page.locator('query-tab .query-settings-btn');
    this.resultsBtn = page.locator('query-tab .query-results-btn');
    this.toolingCheckbox = page.locator('query-tab .query-tooling-checkbox');
    this.editingCheckbox = page.locator('query-tab .query-editing-checkbox');
    this.tabsContainer = page.locator('query-tab .query-tabs');
    this.resultsContainer = page.locator('query-tab .query-results');
    // Note: The element starts with class="status-badge query-status" but updateStatusBadge
    // replaces className with "status-badge status-{type}", removing query-status
    this.statusBadge = page.locator('query-tab .query-footer .status-badge');
    this.searchInput = page.locator('query-tab .search-input');
  }

  /**
   * Navigate to the Query tab
   */
  async navigateTo(): Promise<void> {
    // Check if already on query tab
    const isActive = await this.page.locator('query-tab.active').count() > 0;
    if (isActive) return;

    // Open hamburger menu and wait for nav item to be visible and stable
    await this.page.click('.hamburger-btn');
    const navItem = this.page.locator('.mobile-nav-item[data-tab="query"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click the nav item
    await navItem.click();
    await this.page.waitForSelector('query-tab.active', { timeout: 5000 });
  }

  /**
   * Execute a SOQL query
   */
  async executeQuery(query: string): Promise<void> {
    await this.monaco.setValue(query);
    await this.executeBtn.click();

    // Wait for query to complete - status badge will have status-success or status-error class
    // Note: The selector uses .status-badge because the original .query-status class gets removed
    // when updateStatusBadge() replaces className
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('query-tab .query-footer .status-badge');
        if (!status) return false;
        // Query is complete when status has success or error class (not loading)
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
      },
      { timeout: 30000 }
    );
  }

  /**
   * Execute query using Ctrl/Cmd+Enter
   */
  async executeWithShortcut(): Promise<void> {
    await this.monaco.pressExecuteShortcut();

    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('query-tab .query-footer .status-badge');
        if (!status) return false;
        // Complete when status has success or error class (not loading)
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
      },
      { timeout: 30000 }
    );
  }

  /**
   * Get the status text and type
   */
  async getStatus(): Promise<{ text: string; type: 'success' | 'error' | 'loading' | 'default' }> {
    const text = (await this.statusBadge.textContent()) || '';
    const classList = await this.statusBadge.evaluate((el) =>
      Array.from(el.classList)
    );

    let type: 'success' | 'error' | 'loading' | 'default' = 'default';
    if (classList.includes('status-success')) type = 'success';
    else if (classList.includes('status-error')) type = 'error';
    else if (classList.includes('status-loading')) type = 'loading';

    return { text: text.trim(), type };
  }

  /**
   * Get the number of records returned
   */
  async getResultsCount(): Promise<number> {
    const status = await this.getStatus();
    const match = status.text.match(/(\d+) records?/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get the column headers from the results table
   */
  async getResultsHeaders(): Promise<string[]> {
    return this.page.$$eval(
      'query-tab .query-results table thead th',
      (cells) => cells.map((c) => c.textContent?.trim() || '')
    );
  }

  /**
   * Get the number of rows in the results table
   */
  async getResultsRowCount(): Promise<number> {
    return this.page.$$eval(
      'query-tab .query-results table tbody tr',
      (rows) => rows.length
    );
  }

  /**
   * Check if results contain a subquery toggle
   */
  async hasSubqueryResults(): Promise<boolean> {
    return this.page.isVisible('query-tab .query-results .subquery-toggle');
  }

  /**
   * Expand a subquery result at the given index
   */
  async expandSubquery(index: number): Promise<void> {
    const toggles = await this.page.$$('query-tab .query-results .subquery-toggle');
    if (toggles[index]) {
      await toggles[index].click();
    }
  }

  /**
   * Get text content of expanded subquery at index
   */
  async getSubqueryText(index: number): Promise<string> {
    const containers = await this.page.$$('query-tab .query-results .subquery-container');
    if (containers[index]) {
      return (await containers[index].textContent()) || '';
    }
    return '';
  }

  /**
   * Get the list of open query tabs
   */
  async getOpenTabs(): Promise<string[]> {
    return this.page.$$eval('query-tab .query-tab-label', (tabs) =>
      tabs.map((t) => t.textContent?.trim() || '')
    );
  }

  /**
   * Close a query tab by its label
   */
  async closeTab(label: string): Promise<void> {
    const tab = this.page.locator('.query-tab', { hasText: label });
    await tab.locator('.query-tab-close').click();
  }

  /**
   * Filter results using the search input
   */
  async filterResults(searchTerm: string): Promise<void> {
    await this.searchInput.fill(searchTerm);
    // Wait for debounce
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear the results filter
   */
  async clearFilter(): Promise<void> {
    await this.searchInput.fill('');
    await this.page.waitForTimeout(300);
  }

  /**
   * Enable or disable Tooling API mode
   */
  async setToolingMode(enabled: boolean): Promise<void> {
    const isChecked = await this.toolingCheckbox.isChecked();
    if (isChecked !== enabled) {
      await this.settingsBtn.click();
      await this.toolingCheckbox.click();
    }
  }

  /**
   * Get the error message if query failed
   */
  async getErrorMessage(): Promise<string> {
    // Error message is displayed in the results container, not status badge
    const errorDiv = this.page.locator('query-tab .query-results-error');
    if (await errorDiv.count() > 0) {
      return (await errorDiv.textContent()) || '';
    }
    return '';
  }
}
