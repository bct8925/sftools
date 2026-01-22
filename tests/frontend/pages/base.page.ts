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
  private readonly STEP_TIMEOUT_MS = 5000;

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
   * Execute a test step with timeout enforcement.
   * Fails the test if the step takes longer than STEP_TIMEOUT_MS (5 seconds).
   */
  protected async step<T>(description: string, fn: () => Promise<T>): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      if (duration > this.STEP_TIMEOUT_MS) {
        throw new Error(
          `Step "${description}" took ${duration}ms (exceeded ${this.STEP_TIMEOUT_MS}ms limit)`
        );
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // If it's already a timeout error, re-throw it
      if (error instanceof Error && error.message.includes('exceeded')) {
        throw error;
      }

      // If the step failed AND took too long, mention both issues
      if (duration > this.STEP_TIMEOUT_MS) {
        throw new Error(
          `Step "${description}" failed after ${duration}ms (exceeded ${this.STEP_TIMEOUT_MS}ms limit): ${error}`
        );
      }

      // Otherwise, just re-throw the original error
      throw error;
    }
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
    await this.step(`click ${await this.getLocatorDescription(locator)}`, async () => {
      await this.delay('beforeClick');
      await locator.click();
      await this.delay('afterClick');
    });
  }

  /**
   * Fill/type with optional slow mode delay
   */
  protected async slowFill(locator: Locator, text: string): Promise<void> {
    await this.step(`fill ${await this.getLocatorDescription(locator)}`, async () => {
      await this.delay('beforeType');
      await locator.fill(text);
    });
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

  /**
   * Get a human-readable description of a locator for error messages
   */
  private async getLocatorDescription(locator: Locator): Promise<string> {
    try {
      // Try to get the selector string
      return locator.toString();
    } catch {
      return 'element';
    }
  }
}
