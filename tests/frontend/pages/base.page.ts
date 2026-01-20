import type { Page, Locator } from 'playwright';
import type { TestConfig } from '../framework/types';
import { DEFAULT_CONFIG } from '../framework/types';

/**
 * Base page class with timing helpers for slow mode.
 * In slow mode, adds human-like delays before interactions.
 */
export class BasePage {
  protected page: Page;
  protected config: TestConfig = DEFAULT_CONFIG;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Set the test config (called by test framework)
   */
  setConfig(config: TestConfig): void {
    this.config = config;
  }

  /**
   * Wait helper that respects slow mode
   */
  protected async delay(type: keyof TestConfig['delays']): Promise<void> {
    const ms = this.config.delays[type];
    if (ms > 0) {
      await this.page.waitForTimeout(ms);
    }
  }

  /**
   * Click with optional slow mode delay
   */
  protected async slowClick(locator: Locator): Promise<void> {
    await this.delay('beforeClick');
    await locator.click();
    await this.delay('afterClick');
  }

  /**
   * Fill/type with optional slow mode delay
   */
  protected async slowFill(locator: Locator, text: string): Promise<void> {
    await this.delay('beforeType');
    await locator.fill(text);
  }

  /**
   * Wait after navigation
   */
  protected async afterNavigation(): Promise<void> {
    await this.delay('afterNavigation');
  }

  /**
   * Wait after page load
   */
  protected async afterPageLoad(): Promise<void> {
    await this.delay('afterPageLoad');
  }
}
