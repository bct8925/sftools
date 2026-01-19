import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class SettingsTabPage extends BasePage {
  // Theme elements
  readonly systemThemeRadio: Locator;
  readonly lightThemeRadio: Locator;
  readonly darkThemeRadio: Locator;

  // Connection list elements
  readonly connectionList: Locator;
  readonly connectionItems: Locator;
  readonly addConnectionBtn: Locator;

  // Edit modal elements
  readonly editModal: Locator;
  readonly editLabelInput: Locator;
  readonly editSaveBtn: Locator;

  constructor(page: Page) {
    super(page);

    // Theme radio buttons
    this.systemThemeRadio = page.locator('settings-tab .settings-theme-radio[value="system"]');
    this.lightThemeRadio = page.locator('settings-tab .settings-theme-radio[value="light"]');
    this.darkThemeRadio = page.locator('settings-tab .settings-theme-radio[value="dark"]');

    // Connection list
    this.connectionList = page.locator('settings-tab .settings-connection-list');
    this.connectionItems = page.locator('settings-tab .settings-connection-item');
    this.addConnectionBtn = page.locator('settings-tab .settings-add-connection-btn');

    // Edit modal
    this.editModal = page.locator('settings-tab .settings-edit-modal');
    this.editLabelInput = page.locator('settings-tab .settings-edit-label');
    this.editSaveBtn = page.locator('settings-tab .settings-edit-save-btn');
  }

  /**
   * Navigate to the Settings tab
   */
  async navigateTo(): Promise<void> {
    // Check if already on settings tab
    const isActive = await this.page.locator('settings-tab.active').count() > 0;
    if (isActive) return;

    // Open hamburger menu and wait for nav item to be visible
    await this.slowClick(this.page.locator('.hamburger-btn'));
    const navItem = this.page.locator('.mobile-nav-item[data-tab="settings"]');
    await navItem.waitFor({ state: 'visible', timeout: 5000 });

    // Click the nav item
    await this.slowClick(navItem);
    await this.page.waitForSelector('settings-tab.active', { timeout: 5000 });
    await this.afterNavigation();
  }

  /**
   * Set the theme
   */
  async setTheme(theme: 'system' | 'light' | 'dark'): Promise<void> {
    let radio: Locator;
    switch (theme) {
      case 'system':
        radio = this.systemThemeRadio;
        break;
      case 'light':
        radio = this.lightThemeRadio;
        break;
      case 'dark':
        radio = this.darkThemeRadio;
        break;
    }

    await this.slowClick(radio);
  }

  /**
   * Get the currently selected theme
   */
  async getSelectedTheme(): Promise<'system' | 'light' | 'dark' | null> {
    if (await this.systemThemeRadio.isChecked()) return 'system';
    if (await this.lightThemeRadio.isChecked()) return 'light';
    if (await this.darkThemeRadio.isChecked()) return 'dark';
    return null;
  }

  /**
   * Get the number of saved connections
   */
  async getConnectionCount(): Promise<number> {
    return await this.connectionItems.count();
  }

  /**
   * Get connection labels
   */
  async getConnectionLabels(): Promise<string[]> {
    return this.page.$$eval(
      'settings-tab .settings-connection-label',
      (labels) => labels.map((l) => l.textContent?.trim() || '')
    );
  }

  /**
   * Click edit button for a connection by label
   */
  async editConnection(label: string): Promise<void> {
    const item = this.page.locator('settings-tab .settings-connection-item', { hasText: label });
    await item.locator('.settings-connection-edit').click();
    await this.editModal.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Update connection label in edit modal
   */
  async updateConnectionLabel(newLabel: string): Promise<void> {
    await this.slowFill(this.editLabelInput, newLabel);
    await this.slowClick(this.editSaveBtn);
    await this.editModal.waitFor({ state: 'hidden', timeout: 5000 });
  }
}
