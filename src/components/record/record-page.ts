// Record Viewer - Custom Element
import DOMPurify from 'dompurify';
import { setActiveConnection } from '../../lib/utils.js';
import {
  getObjectDescribe,
  getRecordWithRelationships,
  updateRecord,
} from '../../lib/salesforce.js';
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { escapeHtml, escapeAttr } from '../../lib/text-utils.js';
import '../sf-icon/sf-icon.js';
import {
  sortFields,
  filterFields,
  formatValue,
  formatPreviewHtml,
  parseValue,
  getChangedFields,
} from '../../lib/record-utils.js';
import '../modal-popup/modal-popup.js';
import template from './record.html?raw';
import './record.css';
import type { SalesforceConnection, FieldDescribe, SObject } from '../../types/salesforce';

class RecordPage extends HTMLElement {
  // State
  private objectType: string | null = null;
  private recordId: string | null = null;
  private connectionId: string | null = null;
  private instanceUrl: string | null = null;
  private fieldDescribe: Record<string, FieldDescribe> = {};
  private nameFieldMap: Record<string, string> = {};
  private originalValues: Record<string, unknown> = {};
  private currentValues: Record<string, unknown> = {};

  // DOM references
  private objectNameEl!: HTMLElement;
  private recordIdEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private fieldsContainer!: HTMLElement;
  private saveBtn!: HTMLButtonElement;
  private refreshBtn!: HTMLButtonElement;
  private changeCountEl!: HTMLElement;
  private openInOrgBtn!: HTMLButtonElement;
  private richTextModalEl!: HTMLElement;
  private modalFieldInfoEl!: HTMLElement;
  private modalContentEl!: HTMLElement;
  private modalCloseBtnEl!: HTMLButtonElement;

  // Bound event handlers for cleanup
  private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private boundCorsHandler: (() => void) | null = null;

  connectedCallback(): void {
    this.innerHTML = template;
    this.initElements();
    this.attachEventListeners();
    this.initCorsModal();
    this.initialize();
  }

  private initElements(): void {
    this.objectNameEl = this.querySelector<HTMLElement>('#objectName')!;
    this.recordIdEl = this.querySelector<HTMLElement>('#recordId')!;
    this.statusEl = this.querySelector<HTMLElement>('#status')!;
    this.fieldsContainer = this.querySelector<HTMLElement>('#fieldsContainer')!;
    this.saveBtn = this.querySelector<HTMLButtonElement>('#saveBtn')!;
    this.refreshBtn = this.querySelector<HTMLButtonElement>('#refreshBtn')!;
    this.changeCountEl = this.querySelector<HTMLElement>('#changeCount')!;
    this.openInOrgBtn = this.querySelector<HTMLButtonElement>('#openInOrgBtn')!;
    this.richTextModalEl = this.querySelector<HTMLElement>('#richTextModal')!;
    this.modalFieldInfoEl = this.querySelector<HTMLElement>('#modalFieldInfo')!;
    this.modalContentEl = this.querySelector<HTMLElement>('#modalContent')!;
    this.modalCloseBtnEl = this.querySelector<HTMLButtonElement>('#modalCloseBtn')!;
  }

  private attachEventListeners(): void {
    this.saveBtn.addEventListener('click', this.saveChanges);
    this.refreshBtn.addEventListener('click', this.loadRecord);
    this.openInOrgBtn.addEventListener('click', this.openInOrg);

    // Modal event listeners
    this.modalCloseBtnEl.addEventListener('click', this.closeRichTextModal);
    this.richTextModalEl.addEventListener('click', this.handleModalClick);

    // Close modal on Escape key (store bound handler for cleanup)
    this.boundKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.richTextModalEl.classList.contains('show')) {
        this.closeRichTextModal();
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  disconnectedCallback(): void {
    // Clean up document-level event listeners to prevent memory leaks
    if (this.boundKeydownHandler) {
      document.removeEventListener('keydown', this.boundKeydownHandler);
    }
    if (this.boundCorsHandler) {
      document.removeEventListener('show-cors-error', this.boundCorsHandler);
    }
  }

  private initCorsModal(): void {
    const modal = document.getElementById('cors-error-modal');
    const closeBtn = document.getElementById('cors-modal-close');

    if (modal && closeBtn) {
      // Store bound handler for cleanup
      this.boundCorsHandler = () => {
        (modal as HTMLElement & { open: () => void }).open();
      };
      document.addEventListener('show-cors-error', this.boundCorsHandler);

      closeBtn.addEventListener('click', () => {
        (modal as HTMLElement & { close: () => void }).close();
      });
    }
  }

  private async initialize(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    this.objectType = params.get('objectType');
    this.recordId = params.get('recordId');
    this.connectionId = params.get('connectionId');

    if (!this.objectType || !this.recordId || !this.connectionId) {
      this.showError('Missing required parameters');
      return;
    }

    this.recordIdEl.textContent = this.recordId;
    this.objectNameEl.textContent = this.objectType;

    const connection = await this.loadConnection(this.connectionId);
    if (!connection) {
      this.showError('Connection not found. Please re-authorize.');
      return;
    }

    this.instanceUrl = connection.instanceUrl;
    setActiveConnection(connection);

    await this.loadRecord();
  }

  private openInOrg = (): void => {
    const url = `${this.instanceUrl}/lightning/r/${this.objectType}/${this.recordId}/view`;
    window.open(url, '_blank');
  };

  private async loadConnection(id: string): Promise<SalesforceConnection | null> {
    const { connections } = await chrome.storage.local.get(['connections']);
    return (connections as SalesforceConnection[] | undefined)?.find(c => c.id === id) || null;
  }

  private loadRecord = async (): Promise<void> => {
    this.setStatus('Loading...', 'loading');
    this.fieldsContainer.innerHTML =
      '<div class="loading-container">Loading record data...</div>';

    try {
      const describe = await getObjectDescribe(this.objectType!);
      const { record, nameFieldMap } = await getRecordWithRelationships(
        this.objectType!,
        this.recordId!,
        describe.fields
      );

      this.fieldDescribe = {};
      for (const field of describe.fields) {
        this.fieldDescribe[field.name] = field;
      }
      this.nameFieldMap = nameFieldMap;

      this.objectNameEl.textContent = describe.label;
      document.title = `${this.recordId} - Record Viewer - sftools`;

      this.originalValues = { ...record };
      this.currentValues = { ...record };

      this.renderFields(describe.fields, record);

      this.setStatus('Loaded', 'success');
      this.updateChangeCount();
    } catch (error) {
      this.showError((error as Error).message);
    }
  };

  private renderFields(fields: FieldDescribe[], record: SObject): void {
    const sortedFields = sortFields(fields);
    const filteredFields = filterFields(sortedFields);

    this.fieldsContainer.innerHTML = filteredFields
      .map(field => this.createFieldRowHtml(field, record))
      .join('');

    this.attachFieldEventListeners();
  }

  private createFieldRowHtml(field: FieldDescribe, record: SObject): string {
    const value = record[field.name];
    const displayValue = formatValue(value, field);
    const previewHtmlRaw = formatPreviewHtml(
      value,
      field,
      record,
      this.nameFieldMap,
      this.connectionId!
    );
    const previewHtml = this.convertPreviewPlaceholders(previewHtmlRaw, field, value);
    const previewText = this.formatPreviewText(value, field, record);
    const isEditable = field.updateable && !field.calculated;

    const typeDisplay = this.getTypeDisplay(field);
    const valueHtml = this.createValueInputHtml(field, value, displayValue, isEditable);

    return `
            <div class="field-row" data-field="${field.name}">
                <div class="field-label" title="${escapeAttr(field.label)}">${escapeHtml(field.label)}</div>
                <div class="field-api-name" title="${escapeAttr(field.name)}">${field.name}</div>
                <div class="field-type">${typeDisplay}</div>
                <div class="field-value">${valueHtml}</div>
                <div class="field-preview" title="${escapeAttr(previewText)}">${previewHtml}</div>
            </div>
        `;
  }

  private convertPreviewPlaceholders(
    previewHtmlRaw: string,
    field: FieldDescribe,
    _value: unknown
  ): string {
    if (previewHtmlRaw === '__PREVIEW_BUTTON__') {
      return `<button class="field-preview-btn" data-field="${field.name}" data-field-label="${escapeAttr(field.label)}">Preview</button>`;
    }
    if (previewHtmlRaw === '__CHECKBOX_CHECKED__') {
      return '<input type="checkbox" checked disabled>';
    }
    if (previewHtmlRaw === '__CHECKBOX_UNCHECKED__') {
      return '<input type="checkbox" disabled>';
    }
    if (previewHtmlRaw.startsWith('__LINK__')) {
      const parts = previewHtmlRaw.split('__');
      const relatedName = parts[2];
      const displayType = parts[3];
      const relatedType = parts[4];
      const recordId = parts[5];
      const connectionId = parts[6];
      const url = `record.html?objectType=${encodeURIComponent(relatedType)}&recordId=${encodeURIComponent(recordId)}&connectionId=${encodeURIComponent(connectionId)}`;
      return `<a href="${url}" target="_blank">${escapeHtml(relatedName)} (${escapeHtml(displayType)})</a>`;
    }
    return escapeHtml(previewHtmlRaw);
  }

  private getTypeDisplay(field: FieldDescribe): string {
    if (field.calculated) {
      return (field as FieldDescribe & { calculatedFormula?: string }).calculatedFormula
        ? `${field.type} (formula)`
        : `${field.type} (rollup)`;
    }
    return field.type;
  }

  private createValueInputHtml(
    field: FieldDescribe,
    value: unknown,
    displayValue: string,
    isEditable: boolean
  ): string {
    if (field.type === 'picklist' && isEditable) {
      const options = (field.picklistValues || [])
        .filter(pv => pv.active)
        .map(
          pv =>
            `<option value="${escapeAttr(pv.value)}" ${pv.value === value ? 'selected' : ''}>${escapeHtml(pv.label)}</option>`
        )
        .join('');

      return `
                <select class="select field-input" data-field="${field.name}" data-type="${field.type}">
                    <option value="">--None--</option>
                    ${options}
                </select>`;
    }

    return `
            <input type="text"
                   class="input field-input"
                   value="${escapeAttr(displayValue)}"
                   ${isEditable ? '' : 'disabled'}
                   data-field="${field.name}"
                   data-type="${field.type}">`;
  }

  private attachFieldEventListeners(): void {
    this.fieldsContainer
      .querySelectorAll<HTMLInputElement>('input.field-input:not([disabled])')
      .forEach(input => {
        input.addEventListener('input', () => this.handleFieldChange(input));
      });

    this.fieldsContainer.querySelectorAll<HTMLSelectElement>('select.field-input').forEach(select => {
      select.addEventListener('change', () => this.handleFieldChange(select));
    });

    this.fieldsContainer.querySelectorAll<HTMLButtonElement>('.field-preview-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handlePreviewClick(btn));
    });
  }

  private formatPreviewText(value: unknown, field: FieldDescribe, record: SObject): string {
    if (value === null || value === undefined) return '';

    switch (field.type) {
      case 'boolean':
        return value ? 'true' : 'false';
      case 'datetime':
        return new Date(value as string).toLocaleString();
      case 'date':
        return new Date(`${value}T00:00:00`).toLocaleDateString();
      case 'reference':
        if (field.relationshipName && field.referenceTo?.length > 0) {
          const related = record[field.relationshipName];
          const relatedType = field.referenceTo[0];
          const nameField = this.nameFieldMap[relatedType];
          const relatedName = nameField ? (related as SObject)?.[nameField] : null;
          if (relatedName) {
            const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
            return `${relatedName} (${displayType})`;
          }
        }
      default:
        return String(value);
    }
  }

  private handleFieldChange(input: HTMLInputElement | HTMLSelectElement): void {
    const fieldName = input.dataset.field!;
    const field = this.fieldDescribe[fieldName];
    const newValue = parseValue(input.value, field);

    this.currentValues[fieldName] = newValue;

    const row = input.closest<HTMLElement>('.field-row')!;
    const originalValue = this.originalValues[fieldName];

    const isChanged =
      originalValue === null || originalValue === undefined
        ? newValue !== null && newValue !== undefined && newValue !== ''
        : String(originalValue) !== String(newValue ?? '');

    if (isChanged) {
      row.classList.add('modified');
    } else {
      row.classList.remove('modified');
    }

    this.updateChangeCount();
  }

  private updateChangeCount(): void {
    const changes = getChangedFields(this.originalValues, this.currentValues, this.fieldDescribe);
    const count = Object.keys(changes).length;

    if (count > 0) {
      this.changeCountEl.textContent = `${count} field${count > 1 ? 's' : ''} modified`;
      this.saveBtn.disabled = false;
    } else {
      this.changeCountEl.textContent = '';
      this.saveBtn.disabled = true;
    }
  }

  private saveChanges = async (): Promise<void> => {
    const changes = getChangedFields(this.originalValues, this.currentValues, this.fieldDescribe);

    if (Object.keys(changes).length === 0) {
      return;
    }

    this.setStatus('Saving...', 'loading');
    this.saveBtn.disabled = true;

    try {
      await updateRecord(this.objectType!, this.recordId!, changes);

      for (const [fieldName, value] of Object.entries(changes)) {
        this.originalValues[fieldName] = value;
      }

      this.fieldsContainer.querySelectorAll<HTMLElement>('.field-row.modified').forEach(row => {
        row.classList.remove('modified');
      });

      this.setStatus('Saved', 'success');
      this.updateChangeCount();
    } catch (error) {
      this.setStatus('Save Failed', 'error');
      this.showSaveError((error as Error).message);
      this.saveBtn.disabled = false;
    }
  };

  private setStatus(text: string, type: '' | 'loading' | 'success' | 'error' = ''): void {
    updateStatusBadge(this.statusEl, text, type);
  }

  private showError(message: string): void {
    this.setStatus('Error', 'error');
    this.fieldsContainer.innerHTML = `
            <div class="error-container">
                <p class="error-message">${escapeHtml(message)}</p>
                <p class="error-hint">Please check the connection and try again.</p>
            </div>
        `;
  }

  private showSaveError(message: string): void {
    alert(`Error saving record: ${message}`);
  }

  private handlePreviewClick(button: HTMLButtonElement): void {
    const fieldName = button.dataset.field!;
    const { fieldLabel } = button.dataset;
    const field = this.fieldDescribe[fieldName];
    const value = this.currentValues[fieldName];

    if (!value) return;

    // Set modal header
    this.modalFieldInfoEl.textContent = `${fieldLabel} (${fieldName})`;

    // Set modal content
    // Sanitize HTML content to prevent XSS from stored malicious content
    if (field.type === 'html') {
      this.modalContentEl.innerHTML = DOMPurify.sanitize(value as string);
    } else {
      // For textarea and encryptedstring, display as plain text with preserved formatting
      this.modalContentEl.textContent = value as string;
      this.modalContentEl.style.whiteSpace = 'pre-wrap';
    }

    // Show modal
    this.richTextModalEl.classList.add('show');
  }

  private closeRichTextModal = (): void => {
    this.richTextModalEl.classList.remove('show');
    this.modalContentEl.innerHTML = '';
    this.modalContentEl.style.whiteSpace = '';
  };

  private handleModalClick = (e: MouseEvent): void => {
    if (e.target === this.richTextModalEl) {
      this.closeRichTextModal();
    }
  };
}

customElements.define('record-page', RecordPage);
