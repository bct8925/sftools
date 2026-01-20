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

  constructor(page: Page) {
    super(page);
    this.requestMonaco = new MonacoHelpers(page, 'rest-api-tab .rest-request-editor');
    this.responseMonaco = new MonacoHelpers(page, 'rest-api-tab .rest-response-editor');

    this.methodSelect = page.locator('rest-api-tab .rest-method-select');
    this.urlInput = page.locator('rest-api-tab .rest-api-url');
    this.sendBtn = page.locator('rest-api-tab .rest-send-btn');
    // Note: The element starts with class="rest-status status-badge" but updateStatusBadge
    // replaces className with "status-badge status-{type}", removing rest-status
    this.statusBadge = page.locator('rest-api-tab .status-badge');
    this.bodyContainer = page.locator('rest-api-tab .rest-body-container');
  }

  /**
   * Navigate to the REST API tab
   */
  async navigateTo(): Promise<void> {
    // Check if already on rest-api tab
    const isActive = await this.page.locator('rest-api-tab.active').count() > 0;
    if (isActive) return;

    // Open hamburger menu and wait for nav item to be visible and stable
    await this.slowClick(this.page.locator('.hamburger-btn'));
    const navItem = this.page.locator('.mobile-nav-item[data-tab="rest-api"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click the nav item
    await this.slowClick(navItem);
    await this.page.waitForSelector('rest-api-tab.active', { timeout: 5000 });
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

    // Wait for request to complete - status badge will have status-success or status-error class
    // Note: The element starts with class="rest-status status-badge" but updateStatusBadge
    // replaces className with "status-badge status-{type}", removing rest-status
    await this.page.waitForFunction(
      () => {
        const status = document.querySelector('rest-api-tab .status-badge');
        if (!status) return false;
        // Request is complete when status has success or error class (not loading)
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
        const status = document.querySelector('rest-api-tab .status-badge');
        if (!status) return false;
        // Request is complete when status has success or error class (not loading)
        return status.classList.contains('status-error') ||
               status.classList.contains('status-success');
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
}
