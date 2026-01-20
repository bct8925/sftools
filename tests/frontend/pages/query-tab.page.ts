import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class QueryTabPage extends BasePage {
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
    super(page);
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
    await this.slowClick(this.page.locator('.hamburger-btn'));
    const navItem = this.page.locator('.mobile-nav-item[data-tab="query"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click the nav item
    await this.slowClick(navItem);
    await this.page.waitForSelector('query-tab.active', { timeout: 5000 });
    await this.afterNavigation();
  }

  /**
   * Set a SOQL query without executing
   */
  async setQuery(query: string): Promise<void> {
    await this.delay('beforeType');
    await this.monaco.setValue(query);
  }

  /**
   * Execute a SOQL query
   */
  async executeQuery(query: string): Promise<void> {
    await this.delay('beforeType');
    await this.monaco.setValue(query);
    await this.slowClick(this.executeBtn);

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
   * Get the number of visible rows in the results table
   */
  async getResultsRowCount(): Promise<number> {
    return this.page.$$eval(
      'query-tab .query-results table tbody tr',
      (rows) => rows.filter((r) => {
        const style = window.getComputedStyle(r);
        return style.display !== 'none';
      }).length
    );
  }

  /**
   * Check if results contain a subquery toggle
   */
  async hasSubqueryResults(): Promise<boolean> {
    return this.page.isVisible('query-tab .query-results .query-subquery-toggle');
  }

  /**
   * Expand a subquery result at the given index
   */
  async expandSubquery(index: number): Promise<void> {
    const toggles = await this.page.$$('query-tab .query-results .query-subquery-toggle');
    if (toggles[index]) {
      await toggles[index].click();
    }
  }

  /**
   * Get text content of expanded subquery at index
   */
  async getSubqueryText(index: number): Promise<string> {
    // Subquery rows appear immediately after the parent row with the toggle
    const rows = await this.page.$$('query-tab .query-results tbody tr');
    // The subquery content is in a nested table inside a colspan cell
    const subqueryTables = await this.page.$$('query-tab .query-results .query-subquery-table');
    if (subqueryTables[index]) {
      return (await subqueryTables[index].textContent()) || '';
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
   * Close a query tab by index (0-based)
   */
  async closeTab(index: number): Promise<void> {
    const closeButtons = await this.page.$$('query-tab .query-tab-close');
    if (closeButtons[index]) {
      await closeButtons[index].click();
    }
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

  /**
   * Enable edit mode by checking the editing checkbox
   */
  async enableEditMode(): Promise<void> {
    const isChecked = await this.editingCheckbox.isChecked();
    if (!isChecked) {
      await this.resultsBtn.click();
      await this.delay('beforeClick');
      await this.editingCheckbox.click();
      await this.delay('afterClick');
    }
  }

  /**
   * Disable edit mode by unchecking the editing checkbox
   */
  async disableEditMode(): Promise<void> {
    const isChecked = await this.editingCheckbox.isChecked();
    if (isChecked) {
      await this.resultsBtn.click();
      await this.delay('beforeClick');
      await this.editingCheckbox.click();
      await this.delay('afterClick');
    }
  }

  /**
   * Edit a cell in the results table
   */
  async editCell(rowIndex: number, fieldName: string, value: string): Promise<void> {
    await this.delay('beforeType');

    // Find the field index by matching header
    const headers = await this.getResultsHeaders();
    const fieldIndex = headers.indexOf(fieldName);
    if (fieldIndex === -1) {
      throw new Error(`Field ${fieldName} not found in results headers`);
    }

    // Get the input element for this cell
    const input = this.page.locator(
      `query-tab .query-results table tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${fieldIndex + 1}) .query-field-input`
    );

    // Check if it's a checkbox or text input
    const inputType = await input.getAttribute('type');

    if (inputType === 'checkbox') {
      const shouldCheck = value.toLowerCase() === 'true';
      const isChecked = await input.isChecked();
      if (shouldCheck !== isChecked) {
        await this.slowClick(input);
      }
    } else {
      await input.fill(value);
      await this.delay('afterType');
    }
  }

  /**
   * Save changes to edited records
   */
  async saveChanges(): Promise<void> {
    const saveBtn = this.page.locator('query-tab .query-save-btn');

    // Wait for save button to be enabled (indicates changes are tracked)
    await this.page.waitForFunction(
      () => {
        const btn = document.querySelector('query-tab .query-save-btn');
        return btn && !(btn as HTMLButtonElement).disabled;
      },
      { timeout: 5000 }
    );

    await this.slowClick(saveBtn);

    // Wait for save to complete
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('query-tab .query-footer .status-badge');
        if (!status) return false;
        return status.classList.contains('status-success') ||
               status.classList.contains('status-error');
      },
      { timeout: 15000 }
    );
  }

  /**
   * Clear all pending changes
   */
  async clearChanges(): Promise<void> {
    await this.resultsBtn.click();
    await this.delay('beforeClick');
    const clearBtn = this.page.locator('query-tab .query-clear-btn');
    await this.slowClick(clearBtn);
  }

  /**
   * Get the number of pending changes
   */
  async getChangesCount(): Promise<number> {
    return this.page.$$eval(
      'query-tab .query-results table tbody td.modified',
      (cells) => {
        const recordIds = new Set();
        cells.forEach((cell) => {
          const row = cell.closest('tr');
          if (row) {
            const recordId = row.getAttribute('data-record-id');
            if (recordId) recordIds.add(recordId);
          }
        });
        return recordIds.size;
      }
    );
  }

  /**
   * Export results as CSV
   */
  async exportCsv(): Promise<void> {
    await this.resultsBtn.click();
    await this.delay('beforeClick');
    const exportBtn = this.page.locator('query-tab .query-export-btn');
    await this.slowClick(exportBtn);
  }

  /**
   * Bulk export using Salesforce Bulk API v2
   */
  async bulkExport(): Promise<void> {
    await this.resultsBtn.click();
    await this.delay('beforeClick');
    const bulkExportBtn = this.page.locator('query-tab .query-bulk-export-btn');
    await this.slowClick(bulkExportBtn);

    // Wait for bulk export to complete (status will show "Export complete" or error)
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('query-tab .query-footer .status-badge');
        if (!status) return false;
        const text = status.textContent || '';
        return (text.includes('Export complete') && status.classList.contains('status-success')) ||
               status.classList.contains('status-error');
      },
      { timeout: 120000 } // 2 min timeout for bulk jobs
    );
  }

  /**
   * Open history dropdown
   */
  async openHistory(): Promise<void> {
    await this.slowClick(this.historyBtn);
    await this.page.waitForSelector('query-tab .query-history-modal', { state: 'visible', timeout: 5000 });
  }

  /**
   * Load a query from history by index
   */
  async loadFromHistory(index: number): Promise<void> {
    await this.openHistory();

    // Make sure we're on the history tab
    const historyTab = this.page.locator('query-tab .dropdown-tab[data-tab="history"]');
    await this.slowClick(historyTab);

    await this.delay('beforeClick');
    const historyItems = await this.page.$$('query-tab .query-history-list .script-item');
    if (historyItems[index]) {
      await historyItems[index].click();
    } else {
      throw new Error(`History item ${index} not found`);
    }

    // Wait for modal to close
    await this.page.waitForSelector('query-tab .query-history-modal', { state: 'hidden', timeout: 5000 });
  }

  /**
   * Delete a query from history by index
   */
  async deleteFromHistory(index: number): Promise<void> {
    await this.openHistory();

    // Make sure we're on the history tab
    const historyTab = this.page.locator('query-tab .dropdown-tab[data-tab="history"]');
    await this.slowClick(historyTab);

    await this.delay('beforeClick');
    const deleteButtons = await this.page.$$('query-tab .query-history-list .script-item .script-action.delete');
    if (deleteButtons[index]) {
      await deleteButtons[index].click();
    } else {
      throw new Error(`History item ${index} not found`);
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
        const modal = document.querySelector('query-tab .query-history-modal');
        return modal && !modal.classList.contains('open');
      },
      { timeout: 5000 }
    );
  }

  /**
   * Get the number of items in history
   */
  async getHistoryCount(): Promise<number> {
    // Make sure we're on the history tab
    const historyTab = this.page.locator('query-tab .dropdown-tab[data-tab="history"]');
    const isHistoryActive = await historyTab.evaluate((el) => el.classList.contains('active'));
    if (!isHistoryActive) {
      await this.slowClick(historyTab);
    }

    const count = await this.page.$$eval('query-tab .query-history-list .script-item', (items) => items.length);

    return count;
  }

  /**
   * Get the text of all history items
   */
  async getHistoryItems(): Promise<string[]> {
    // Make sure we're on the history tab
    const historyTab = this.page.locator('query-tab .dropdown-tab[data-tab="history"]');
    const isHistoryActive = await historyTab.evaluate((el) => el.classList.contains('active'));
    if (!isHistoryActive) {
      await this.slowClick(historyTab);
    }

    const items = await this.page.$$eval(
      'query-tab .query-history-list .script-item .script-preview',
      (previews) => previews.map((p) => p.textContent?.trim() || '')
    );

    return items;
  }

  /**
   * Open favorites dropdown
   */
  async openFavorites(): Promise<void> {
    await this.slowClick(this.historyBtn);
    await this.page.waitForSelector('query-tab .query-history-modal', { state: 'visible', timeout: 5000 });

    // Switch to favorites tab
    const favoritesTab = this.page.locator('query-tab .dropdown-tab[data-tab="favorites"]');
    await this.slowClick(favoritesTab);
  }

  /**
   * Save current query to favorites with a label
   */
  async saveToFavorites(label: string): Promise<void> {
    await this.openHistory();

    // Click the favorite button on the first history item
    await this.delay('beforeClick');
    const favoriteBtn = this.page.locator('query-tab .query-history-list .script-item .script-action.favorite').first();
    await this.slowClick(favoriteBtn);

    // Wait for favorite modal to open
    await this.page.waitForSelector('query-tab .query-favorite-modal', { state: 'visible', timeout: 5000 });

    // Enter label
    const labelInput = this.page.locator('query-tab .query-favorite-input');
    await labelInput.fill(label);

    // Click save
    const saveBtn = this.page.locator('query-tab .query-favorite-save');
    await this.slowClick(saveBtn);

    // Wait for modal to close
    await this.page.waitForSelector('query-tab .query-favorite-modal', { state: 'hidden', timeout: 5000 });
  }

  /**
   * Load a query from favorites by index
   */
  async loadFromFavorites(index: number): Promise<void> {
    await this.openFavorites();

    await this.delay('beforeClick');
    const favoriteItems = await this.page.$$('query-tab .query-favorites-list .script-item');
    if (favoriteItems[index]) {
      await favoriteItems[index].click();
    } else {
      throw new Error(`Favorite item ${index} not found`);
    }

    // Wait for modal to close
    await this.page.waitForSelector('query-tab .query-history-modal', { state: 'hidden', timeout: 5000 });
  }

  /**
   * Delete a query from favorites by index
   */
  async deleteFromFavorites(index: number): Promise<void> {
    await this.openFavorites();

    await this.delay('beforeClick');
    const deleteButtons = await this.page.$$('query-tab .query-favorites-list .script-item .script-action.delete');
    if (deleteButtons[index]) {
      await deleteButtons[index].click();
    } else {
      throw new Error(`Favorite item ${index} not found`);
    }
  }

  /**
   * Refresh the current tab
   */
  async refreshTab(): Promise<void> {
    const refreshBtn = this.page.locator('query-tab .query-tab.active .query-tab-refresh');
    await this.slowClick(refreshBtn);

    // Wait for refresh to complete
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('query-tab .query-footer .status-badge');
        if (!status) return false;
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
      },
      { timeout: 30000 }
    );
  }

  /**
   * Click a record ID field to open Record Viewer
   */
  async clickRecordId(rowIndex: number): Promise<void> {
    // Find the Id column (should be first column)
    const headers = await this.getResultsHeaders();
    const idIndex = headers.indexOf('Id');
    if (idIndex === -1) {
      throw new Error('Id field not found in results headers');
    }

    const idLink = this.page.locator(
      `query-tab .query-results table tbody tr:nth-child(${rowIndex + 1}) td:nth-child(${idIndex + 1}) .query-id-link`
    );

    await this.slowClick(idLink);
  }

  /**
   * Switch to a specific result tab by index
   */
  async switchToTab(index: number): Promise<void> {
    const tabLabels = await this.page.$$('query-tab .query-tab-label');
    if (tabLabels[index]) {
      await this.slowClick(tabLabels[index]);
      await this.delay('afterClick');
    } else {
      throw new Error(`Tab ${index} not found`);
    }
  }

  /**
   * Collapse an expanded subquery
   */
  async collapseSubquery(index: number): Promise<void> {
    const toggles = await this.page.$$('query-tab .query-results .query-subquery-toggle');
    if (toggles[index]) {
      // Check if already expanded
      const expanded = await toggles[index].evaluate((el) => el.getAttribute('data-expanded') === 'true');
      if (expanded) {
        await this.slowClick(toggles[index]);
      }
    } else {
      throw new Error(`Subquery toggle ${index} not found`);
    }
  }

  /**
   * Get the index of the currently active result tab
   */
  async getActiveTab(): Promise<number> {
    const tabs = await this.page.$$('query-tab .query-tab');
    for (let i = 0; i < tabs.length; i++) {
      const isActive = await tabs[i].evaluate((el) => el.classList.contains('active'));
      if (isActive) return i;
    }
    return -1;
  }

  /**
   * Check if a subquery is visible (expanded)
   */
  async isSubqueryVisible(index: number): Promise<boolean> {
    const subqueryTables = await this.page.$$('query-tab .query-results .query-subquery-table');
    if (subqueryTables[index]) {
      const isVisible = await subqueryTables[index].isVisible();
      return isVisible;
    }
    return false;
  }
}
