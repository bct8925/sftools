import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';

export class RecordPage extends BasePage {
  // Elements
  readonly objectName: Locator;
  readonly recordId: Locator;
  readonly status: Locator;
  readonly saveBtn: Locator;
  readonly refreshBtn: Locator;
  readonly openInOrgBtn: Locator;
  readonly changeCount: Locator;
  readonly fieldsContainer: Locator;

  constructor(page: Page) {
    super(page);

    this.objectName = page.locator('#objectName');
    this.recordId = page.locator('#recordId');
    this.status = page.locator('#status');
    this.saveBtn = page.locator('#saveBtn');
    this.refreshBtn = page.locator('#refreshBtn');
    this.openInOrgBtn = page.locator('#openInOrgBtn');
    this.changeCount = page.locator('#changeCount');
    this.fieldsContainer = page.locator('#fieldsContainer');
  }

  /**
   * Wait for the record to be loaded
   */
  async waitForLoad(): Promise<void> {
    // Wait for field rows to appear (loading is complete when fields are rendered)
    await this.page.waitForFunction(
      () => {
        const fieldsContainer = document.getElementById('fieldsContainer');
        // Check that loading container is gone and at least one field-row exists
        return fieldsContainer &&
               !fieldsContainer.innerHTML.includes('Loading') &&
               fieldsContainer.querySelector('.field-row') !== null;
      },
      { timeout: 30000 }
    );
  }

  /**
   * Get the object type name displayed
   */
  async getObjectName(): Promise<string> {
    return (await this.objectName.textContent()) || '';
  }

  /**
   * Get the record ID displayed
   */
  async getRecordId(): Promise<string> {
    return (await this.recordId.textContent()) || '';
  }

  /**
   * Get the value of a field by API name
   */
  async getFieldValue(fieldName: string): Promise<string> {
    const fieldRow = this.page.locator(`.field-row[data-field="${fieldName}"]`);
    const input = fieldRow.locator('.field-input');

    if (await input.count() > 0) {
      const tagName = await input.evaluate((el) => el.tagName.toLowerCase());
      if (tagName === 'select') {
        return (await input.inputValue()) || '';
      }
      return (await input.inputValue()) || '';
    }

    // For read-only fields without input, get text content from value cell
    const valueCell = fieldRow.locator('.field-value');
    return ((await valueCell.textContent()) || '').trim();
  }

  /**
   * Set the value of an editable field
   */
  async setFieldValue(fieldName: string, value: string): Promise<void> {
    const fieldRow = this.page.locator(`.field-row[data-field="${fieldName}"]`);
    const input = fieldRow.locator('.field-input');
    await this.slowFill(input, value);
  }

  /**
   * Check if a field is modified (has pending changes)
   */
  async isFieldModified(fieldName: string): Promise<boolean> {
    const fieldRow = this.page.locator(`.field-row[data-field="${fieldName}"]`);
    const classList = await fieldRow.evaluate((el) =>
      Array.from(el.classList)
    );
    return classList.includes('modified');
  }

  /**
   * Check if a field is editable
   */
  async isFieldEditable(fieldName: string): Promise<boolean> {
    const fieldRow = this.page.locator(`.field-row[data-field="${fieldName}"]`);
    const input = fieldRow.locator('.field-input');

    if ((await input.count()) === 0) {
      return false;
    }

    return !(await input.isDisabled());
  }

  /**
   * Get all field names displayed
   */
  async getFieldNames(): Promise<string[]> {
    return this.page.$$eval('.field-row', (rows) =>
      rows.map((r) => r.getAttribute('data-field') || '')
    );
  }

  /**
   * Get the number of modified fields
   */
  async getModifiedFieldCount(): Promise<number> {
    const count = await this.changeCount.textContent();
    const match = count?.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Save changes
   */
  async save(): Promise<void> {
    await this.slowClick(this.saveBtn);

    // Wait for save to complete
    await this.page.waitForFunction(
      () => {
        const status = document.getElementById('status');
        return (
          status &&
          (status.textContent?.includes('Saved') ||
            status.textContent?.includes('Error'))
        );
      },
      { timeout: 30000 }
    );
  }

  /**
   * Refresh the record data
   */
  async refresh(): Promise<void> {
    await this.slowClick(this.refreshBtn);
    await this.waitForLoad();
  }

  /**
   * Get the status text
   */
  async getStatus(): Promise<string> {
    return (await this.status.textContent()) || '';
  }

  /**
   * Check if save button is enabled
   */
  async isSaveEnabled(): Promise<boolean> {
    return !(await this.saveBtn.isDisabled());
  }
}
