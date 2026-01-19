import type { Page, Locator } from 'playwright';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class ApexTabPage {
  private page: Page;
  readonly codeEditor: MonacoHelpers;
  readonly outputEditor: MonacoHelpers;

  // Elements
  readonly executeBtn: Locator;
  readonly historyBtn: Locator;
  readonly statusBadge: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
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
    const isActive = await this.page.locator('apex-tab.active').count() > 0;
    if (isActive) return;

    // Open hamburger menu and wait for nav item to be visible and stable
    await this.page.click('.hamburger-btn');
    const navItem = this.page.locator('.mobile-nav-item[data-tab="apex"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click the nav item
    await navItem.click();
    await this.page.waitForSelector('apex-tab.active', { timeout: 5000 });
  }

  /**
   * Set the Apex code
   */
  async setCode(code: string): Promise<void> {
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
    await this.executeBtn.click();

    // Wait for execution to complete - status badge will have status-success or status-error class
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('apex-tab .m-top_small .status-badge');
        if (!status) return false;
        // Execution is complete when status has success or error class (not loading)
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
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
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
      },
      { timeout: 60000 }
    );
  }

  /**
   * Get the status
   */
  async getStatus(): Promise<{ text: string; success: boolean }> {
    const text = (await this.statusBadge.textContent()) || '';
    const classList = await this.statusBadge.evaluate((el) =>
      Array.from(el.classList)
    );

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
}
