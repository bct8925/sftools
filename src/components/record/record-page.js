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

class RecordPage extends HTMLElement {
    // State
    objectType = null;
    recordId = null;
    connectionId = null;
    instanceUrl = null;
    fieldDescribe = {};
    nameFieldMap = {};
    originalValues = {};
    currentValues = {};

    // DOM references
    objectNameEl = null;
    recordIdEl = null;
    statusEl = null;
    fieldsContainer = null;
    saveBtn = null;
    refreshBtn = null;
    changeCountEl = null;
    openInOrgBtn = null;
    richTextModalEl = null;
    modalFieldInfoEl = null;
    modalContentEl = null;
    modalCloseBtnEl = null;

    // Bound event handlers for cleanup
    boundKeydownHandler = null;
    boundCorsHandler = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.initCorsModal();
        this.initialize();
    }

    initElements() {
        this.objectNameEl = this.querySelector('#objectName');
        this.recordIdEl = this.querySelector('#recordId');
        this.statusEl = this.querySelector('#status');
        this.fieldsContainer = this.querySelector('#fieldsContainer');
        this.saveBtn = this.querySelector('#saveBtn');
        this.refreshBtn = this.querySelector('#refreshBtn');
        this.changeCountEl = this.querySelector('#changeCount');
        this.openInOrgBtn = this.querySelector('#openInOrgBtn');
        this.richTextModalEl = this.querySelector('#richTextModal');
        this.modalFieldInfoEl = this.querySelector('#modalFieldInfo');
        this.modalContentEl = this.querySelector('#modalContent');
        this.modalCloseBtnEl = this.querySelector('#modalCloseBtn');
    }

    attachEventListeners() {
        this.saveBtn.addEventListener('click', () => this.saveChanges());
        this.refreshBtn.addEventListener('click', () => this.loadRecord());
        this.openInOrgBtn.addEventListener('click', () => this.openInOrg());

        // Modal event listeners
        this.modalCloseBtnEl.addEventListener('click', () => this.closeRichTextModal());
        this.richTextModalEl.addEventListener('click', e => {
            if (e.target === this.richTextModalEl) {
                this.closeRichTextModal();
            }
        });

        // Close modal on Escape key (store bound handler for cleanup)
        this.boundKeydownHandler = e => {
            if (e.key === 'Escape' && this.richTextModalEl.classList.contains('show')) {
                this.closeRichTextModal();
            }
        };
        document.addEventListener('keydown', this.boundKeydownHandler);
    }

    disconnectedCallback() {
        // Clean up document-level event listeners to prevent memory leaks
        if (this.boundKeydownHandler) {
            document.removeEventListener('keydown', this.boundKeydownHandler);
        }
        if (this.boundCorsHandler) {
            document.removeEventListener('show-cors-error', this.boundCorsHandler);
        }
    }

    initCorsModal() {
        const modal = document.getElementById('cors-error-modal');
        const closeBtn = document.getElementById('cors-modal-close');

        if (modal && closeBtn) {
            // Store bound handler for cleanup
            this.boundCorsHandler = () => {
                modal.open();
            };
            document.addEventListener('show-cors-error', this.boundCorsHandler);

            closeBtn.addEventListener('click', () => {
                modal.close();
            });
        }
    }

    async initialize() {
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

    openInOrg() {
        const url = `${this.instanceUrl}/lightning/r/${this.objectType}/${this.recordId}/view`;
        window.open(url, '_blank');
    }

    async loadConnection(id) {
        const { connections } = await chrome.storage.local.get(['connections']);
        return connections?.find(c => c.id === id) || null;
    }

    async loadRecord() {
        this.setStatus('Loading...', 'loading');
        this.fieldsContainer.innerHTML =
            '<div class="loading-container">Loading record data...</div>';

        try {
            const describe = await getObjectDescribe(this.objectType);
            const { record, nameFieldMap } = await getRecordWithRelationships(
                this.objectType,
                this.recordId,
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
            this.showError(error.message);
        }
    }

    renderFields(fields, record) {
        const sortedFields = sortFields(fields);
        const filteredFields = filterFields(sortedFields);

        this.fieldsContainer.innerHTML = filteredFields
            .map(field => this.createFieldRowHtml(field, record))
            .join('');

        this.attachFieldEventListeners();
    }

    createFieldRowHtml(field, record) {
        const value = record[field.name];
        const displayValue = formatValue(value, field);
        const previewHtmlRaw = formatPreviewHtml(
            value,
            field,
            record,
            this.nameFieldMap,
            this.connectionId
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

    convertPreviewPlaceholders(previewHtmlRaw, field, _value) {
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

    getTypeDisplay(field) {
        if (field.calculated) {
            return field.calculatedFormula ? `${field.type} (formula)` : `${field.type} (rollup)`;
        }
        return field.type;
    }

    createValueInputHtml(field, value, displayValue, isEditable) {
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

    attachFieldEventListeners() {
        this.fieldsContainer
            .querySelectorAll('input.field-input:not([disabled])')
            .forEach(input => {
                input.addEventListener('input', e => this.handleFieldChange(e.target));
            });

        this.fieldsContainer.querySelectorAll('select.field-input').forEach(select => {
            select.addEventListener('change', e => this.handleFieldChange(e.target));
        });

        this.fieldsContainer.querySelectorAll('.field-preview-btn').forEach(btn => {
            btn.addEventListener('click', e => this.handlePreviewClick(e.target));
        });
    }

    formatPreviewText(value, field, record) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'datetime':
                return new Date(value).toLocaleString();
            case 'date':
                return new Date(`${value}T00:00:00`).toLocaleDateString();
            case 'reference':
                if (field.relationshipName && field.referenceTo?.length > 0) {
                    const related = record[field.relationshipName];
                    const relatedType = field.referenceTo[0];
                    const nameField = this.nameFieldMap[relatedType];
                    const relatedName = nameField ? related?.[nameField] : null;
                    if (relatedName) {
                        const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
                        return `${relatedName} (${displayType})`;
                    }
                }
            default:
                return value;
        }
    }

    handleFieldChange(input) {
        const fieldName = input.dataset.field;
        const field = this.fieldDescribe[fieldName];
        const newValue = parseValue(input.value, field);

        this.currentValues[fieldName] = newValue;

        const row = input.closest('.field-row');
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

    updateChangeCount() {
        const changes = getChangedFields(
            this.originalValues,
            this.currentValues,
            this.fieldDescribe
        );
        const count = Object.keys(changes).length;

        if (count > 0) {
            this.changeCountEl.textContent = `${count} field${count > 1 ? 's' : ''} modified`;
            this.saveBtn.disabled = false;
        } else {
            this.changeCountEl.textContent = '';
            this.saveBtn.disabled = true;
        }
    }

    async saveChanges() {
        const changes = getChangedFields(
            this.originalValues,
            this.currentValues,
            this.fieldDescribe
        );

        if (Object.keys(changes).length === 0) {
            return;
        }

        this.setStatus('Saving...', 'loading');
        this.saveBtn.disabled = true;

        try {
            await updateRecord(this.objectType, this.recordId, changes);

            for (const [fieldName, value] of Object.entries(changes)) {
                this.originalValues[fieldName] = value;
            }

            this.fieldsContainer.querySelectorAll('.field-row.modified').forEach(row => {
                row.classList.remove('modified');
            });

            this.setStatus('Saved', 'success');
            this.updateChangeCount();
        } catch (error) {
            this.setStatus('Save Failed', 'error');
            this.showSaveError(error.message);
            this.saveBtn.disabled = false;
        }
    }

    setStatus(text, type = '') {
        updateStatusBadge(this.statusEl, text, type);
    }

    showError(message) {
        this.setStatus('Error', 'error');
        this.fieldsContainer.innerHTML = `
            <div class="error-container">
                <p class="error-message">${escapeHtml(message)}</p>
                <p class="error-hint">Please check the connection and try again.</p>
            </div>
        `;
    }

    showSaveError(message) {
        alert(`Error saving record: ${message}`);
    }

    handlePreviewClick(button) {
        const fieldName = button.dataset.field;
        const { fieldLabel } = button.dataset;
        const field = this.fieldDescribe[fieldName];
        const value = this.currentValues[fieldName];

        if (!value) return;

        // Set modal header
        this.modalFieldInfoEl.textContent = `${fieldLabel} (${fieldName})`;

        // Set modal content
        // Sanitize HTML content to prevent XSS from stored malicious content
        if (field.type === 'html') {
            this.modalContentEl.innerHTML = DOMPurify.sanitize(value);
        } else {
            // For textarea and encryptedstring, display as plain text with preserved formatting
            this.modalContentEl.textContent = value;
            this.modalContentEl.style.whiteSpace = 'pre-wrap';
        }

        // Show modal
        this.richTextModalEl.classList.add('show');
    }

    closeRichTextModal() {
        this.richTextModalEl.classList.remove('show');
        this.modalContentEl.innerHTML = '';
        this.modalContentEl.style.whiteSpace = '';
    }
}

customElements.define('record-page', RecordPage);
