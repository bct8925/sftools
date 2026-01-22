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
   * Execute a test step with active timeout enforcement.
   * Uses Promise.race to abort if the step exceeds the timeout.
   *
   * @param description - Human-readable step description for error messages
   * @param fn - Async function to execute
   * @param timeoutMs - Optional custom timeout (default: 5000ms)
   */
  protected async step<T>(
    description: string,
    fn: () => Promise<T>,
    timeoutMs: number = this.STEP_TIMEOUT_MS
  ): Promise<T> {
    const startTime = Date.now();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          `Step "${description}" timed out after ${timeoutMs}ms`
        ));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // If it's already a timeout error, re-throw it
      if (error instanceof Error && error.message.includes('timed out')) {
        throw error;
      }

      // Enhance other errors with duration context
      throw new Error(
        `Step "${description}" failed after ${duration}ms: ${error instanceof Error ? error.message : error}`
      );
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
