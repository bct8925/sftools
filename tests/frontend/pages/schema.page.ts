import type { Page, Locator } from 'playwright';
import { BasePage } from './base.page';
import { MonacoHelpers } from '../helpers/monaco-helpers';

export class SchemaPage extends BasePage {
    // Elements
    readonly objectFilter: Locator;
    readonly objectsList: Locator;
    readonly objectCount: Locator;
    readonly refreshObjectsBtn: Locator;
    readonly fieldsPanel: Locator;
    readonly fieldFilter: Locator;
    readonly fieldsList: Locator;
    readonly selectedObjectLabel: Locator;
    readonly selectedObjectName: Locator;
    readonly closeFieldsBtn: Locator;

    // Formula modal
    readonly formulaModal: Locator;
    readonly formulaEditor: MonacoHelpers;
    readonly modalSaveBtn: Locator;
    readonly modalCancelBtn: Locator;
    readonly modalStatus: Locator;

    constructor(page: Page) {
        super(page);

        this.objectFilter = page.locator('[data-testid="schema-object-filter"]');
        this.objectsList = page.locator('[data-testid="schema-objects-list"]');
        this.objectCount = page.locator('[data-testid="schema-object-count"]');
        this.refreshObjectsBtn = page.locator('[data-testid="schema-refresh-objects"]');
        this.fieldsPanel = page.locator('[data-testid="schema-fields-panel"]');
        this.fieldFilter = page.locator('[data-testid="schema-field-filter"]');
        this.fieldsList = page.locator('[data-testid="schema-fields-list"]');
        this.selectedObjectLabel = page.locator('[data-testid="schema-selected-object-label"]');
        this.selectedObjectName = page.locator('[data-testid="schema-selected-object-name"]');
        this.closeFieldsBtn = page.locator('[data-testid="schema-close-fields"]');

        this.formulaModal = page.locator('[data-testid="schema-formula-modal"]');
        this.formulaEditor = new MonacoHelpers(page, '[data-testid="schema-formula-editor"]');
        this.modalSaveBtn = page.locator('[data-testid="schema-formula-save"]');
        this.modalCancelBtn = page.locator('[data-testid="schema-formula-cancel"]');
        this.modalStatus = page.locator('[data-testid="schema-formula-status"]');
    }

    /**
     * Wait for objects to be loaded
     */
    async waitForLoad(): Promise<void> {
        await this.page.waitForFunction(
            () => {
                const list = document.querySelector('[data-testid="schema-objects-list"]');
                const loading = document.querySelector('[data-testid="schema-objects-loading"]');
                return list && !loading;
            },
            { timeout: 30000 }
        );
    }

    /**
     * Get the count of objects displayed
     */
    async getObjectCount(): Promise<number> {
        const text = await this.objectCount.textContent();
        const match = text?.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * Filter objects by name
     */
    async filterObjects(searchTerm: string): Promise<void> {
        await this.slowFill(this.objectFilter, searchTerm);
        await this.page.waitForTimeout(300);
    }

    /**
     * Get list of visible object names
     */
    async getVisibleObjectNames(): Promise<string[]> {
        return this.page.$$eval('[data-testid="schema-object-item"]', items =>
            items
                .filter(item => (item as HTMLElement).style.display !== 'none')
                .map(item => item.getAttribute('data-object-name') || '')
        );
    }

    /**
     * Select an object to view its fields
     */
    async selectObject(apiName: string): Promise<void> {
        const objectItem = this.page.locator(
            `[data-testid="schema-object-item"][data-object-name="${apiName}"]`
        );
        await this.slowClick(objectItem);

        // Wait for fields panel to show
        await this.fieldsPanel.waitFor({ state: 'visible', timeout: 10000 });

        // Wait for fields to load
        await this.page.waitForFunction(
            () => {
                const list = document.querySelector('[data-testid="schema-fields-list"]');
                const loading = document.querySelector('[data-testid="schema-fields-loading"]');
                return list && !loading;
            },
            { timeout: 30000 }
        );
        await this.afterNavigation();
    }

    /**
     * Get the selected object label
     */
    async getSelectedObjectLabel(): Promise<string> {
        return (await this.selectedObjectLabel.textContent()) || '';
    }

    /**
     * Get the selected object API name
     */
    async getSelectedObjectApiName(): Promise<string> {
        return (await this.selectedObjectName.textContent()) || '';
    }

    /**
     * Filter fields by name
     */
    async filterFields(searchTerm: string): Promise<void> {
        await this.fieldFilter.fill(searchTerm);
        await this.page.waitForTimeout(300);
    }

    /**
     * Get list of visible field API names
     */
    async getVisibleFieldNames(): Promise<string[]> {
        return this.page.$$eval('[data-testid="schema-field-item"]', items =>
            items
                .filter(item => (item as HTMLElement).style.display !== 'none')
                .map(item => item.getAttribute('data-field-name') || '')
        );
    }

    /**
     * Get field details by API name
     */
    async getFieldDetails(fieldApiName: string): Promise<{ label: string; type: string } | null> {
        const fieldItem = this.page.locator(
            `[data-testid="schema-field-item"][data-field-name="${fieldApiName}"]`
        );

        if ((await fieldItem.count()) === 0) {
            return null;
        }

        const label =
            (await fieldItem.locator('[data-testid="schema-field-label"]').textContent()) || '';
        const type =
            (await fieldItem.locator('[data-testid="schema-field-type"]').textContent()) || '';

        return { label: label.trim(), type: type.trim() };
    }

    /**
     * Check if a field is a formula field (has edit button)
     */
    async isFormulaField(fieldApiName: string): Promise<boolean> {
        const fieldItem = this.page.locator(
            `[data-testid="schema-field-item"][data-field-name="${fieldApiName}"]`
        );
        const editBtn = fieldItem.locator('[data-testid="schema-field-edit"]');
        return (await editBtn.count()) > 0;
    }

    /**
     * Open formula editor for a field
     */
    async openFormulaEditor(fieldApiName: string): Promise<void> {
        const fieldItem = this.page.locator(
            `[data-testid="schema-field-item"][data-field-name="${fieldApiName}"]`
        );

        // Hover to reveal menu
        await fieldItem.hover();

        // Click the edit button or menu
        const editBtn = fieldItem.locator('[data-testid="schema-field-edit"]');
        await editBtn.click();

        // Wait for modal
        await this.formulaModal.waitFor({ state: 'visible', timeout: 10000 });
    }

    /**
     * Get the formula from the editor
     */
    async getFormulaContent(): Promise<string> {
        return this.formulaEditor.getValue();
    }

    /**
     * Set the formula in the editor
     */
    async setFormulaContent(formula: string): Promise<void> {
        await this.formulaEditor.setValue(formula);
    }

    /**
     * Save the formula
     */
    async saveFormula(): Promise<void> {
        await this.modalSaveBtn.click();

        // Wait for save to complete
        await this.page.waitForFunction(
            () => {
                const modal = document.querySelector('[data-testid="schema-formula-modal"]');
                const status = document.querySelector('[data-testid="schema-formula-status"]');
                return (
                    !modal ||
                    (modal as HTMLElement).style.display === 'none' ||
                    status?.textContent?.includes('Error')
                );
            },
            { timeout: 30000 }
        );
    }

    /**
     * Cancel formula editing
     */
    async cancelFormulaEdit(): Promise<void> {
        await this.modalCancelBtn.click();
        await this.formulaModal.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Close the fields panel
     */
    async closeFieldsPanel(): Promise<void> {
        await this.closeFieldsBtn.click();
        await this.fieldsPanel.waitFor({ state: 'hidden', timeout: 5000 });
    }

    /**
     * Refresh the objects list
     */
    async refreshObjects(): Promise<void> {
        await this.refreshObjectsBtn.click();
        await this.waitForLoad();
    }
}
