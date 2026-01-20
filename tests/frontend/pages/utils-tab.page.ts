import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class UtilsTabPage extends BasePage {
  // Debug Logs elements
  readonly enableForMeBtn: Locator;
  readonly traceStatus: Locator;
  readonly traceStatusIndicator: Locator;
  readonly traceStatusText: Locator;
  readonly deleteLogsBtn: Locator;
  readonly deleteFlagsBtn: Locator;
  readonly deleteStatus: Locator;
  readonly deleteStatusIndicator: Locator;
  readonly deleteStatusText: Locator;

  constructor(page: Page) {
    super(page);

    // Debug Logs elements
    this.enableForMeBtn = page.locator('debug-logs .enable-for-me-btn');
    this.traceStatus = page.locator('debug-logs .trace-status');
    this.traceStatusIndicator = page.locator('debug-logs .trace-status .status-indicator');
    this.traceStatusText = page.locator('debug-logs .trace-status .tool-status-text');
    this.deleteLogsBtn = page.locator('debug-logs .delete-logs-btn');
    this.deleteFlagsBtn = page.locator('debug-logs .delete-flags-btn');
    this.deleteStatus = page.locator('debug-logs .delete-status');
    this.deleteStatusIndicator = page.locator('debug-logs .delete-status .status-indicator');
    this.deleteStatusText = page.locator('debug-logs .delete-status .tool-status-text');
  }

  /**
   * Navigate to the Utils tab
   */
  async navigateTo(): Promise<void> {
    const isActive = await this.page.locator('utils-tab.active').count() > 0;
    if (isActive) return;

    await this.slowClick(this.page.locator('.hamburger-btn'));
    const navItem = this.page.locator('.mobile-nav-item[data-tab="utils"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    await this.slowClick(navItem);
    await this.page.waitForSelector('utils-tab.active', { timeout: 5000 });
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
        const indicator = document.querySelector('debug-logs .trace-status .status-indicator');
        if (!indicator) return false;
        return indicator.classList.contains('status-success') ||
               indicator.classList.contains('status-error');
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
    const classList = await this.traceStatusIndicator.evaluate((el) =>
      Array.from(el.classList)
    );

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
    this.page.once('dialog', async (dialog) => {
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
    const classList = await this.deleteStatusIndicator.evaluate((el) =>
      Array.from(el.classList)
    );

    if (classList.includes('status-success')) return 'success';
    if (classList.includes('status-error')) return 'error';
    if (classList.includes('status-loading')) return 'loading';
    return 'unknown';
  }
}
