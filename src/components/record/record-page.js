// Record Viewer - Custom Element
import template from './record.html?raw';
import './record.css';
import { setActiveConnection } from '../../lib/utils.js';
import { getObjectDescribe, getRecordWithRelationships, updateRecord } from '../../lib/salesforce.js';

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

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
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
    }

    attachEventListeners() {
        this.saveBtn.addEventListener('click', () => this.saveChanges());
        this.refreshBtn.addEventListener('click', () => this.loadRecord());
        this.openInOrgBtn.addEventListener('click', () => this.openInOrg());
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
        this.fieldsContainer.innerHTML = '<div class="loading-container">Loading record data...</div>';

        try {
            const describe = await getObjectDescribe(this.objectType);
            const { record, nameFieldMap } = await getRecordWithRelationships(this.objectType, this.recordId, describe.fields);

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
        // Sort: Id first, name field second, then alphabetically by API name
        const sortedFields = [...fields].sort((a, b) => {
            if (a.name === 'Id') return -1;
            if (b.name === 'Id') return 1;
            if (a.nameField) return -1;
            if (b.nameField) return 1;
            return a.name.localeCompare(b.name);
        });

        // Filter out compound and internal fields
        const excludeTypes = ['address', 'location'];
        const excludeNames = ['attributes'];
        const filteredFields = sortedFields.filter(f =>
            !excludeNames.includes(f.name) &&
            !excludeTypes.includes(f.type)
        );

        this.fieldsContainer.innerHTML = filteredFields.map(field => {
            const value = record[field.name];
            const displayValue = this.formatValue(value, field);
            const previewHtml = this.formatPreviewHtml(value, field, record);
            const previewText = this.formatPreviewText(value, field, record);
            const isEditable = field.updateable && !field.calculated;

            const typeDisplay = field.calculated ? `${field.type} (formula)` : field.type;

            let valueHtml;
            if (field.type === 'picklist' && isEditable) {
                const options = (field.picklistValues || [])
                    .filter(pv => pv.active)
                    .map(pv => `<option value="${this.escapeAttr(pv.value)}" ${pv.value === value ? 'selected' : ''}>${this.escapeHtml(pv.label)}</option>`)
                    .join('');
                valueHtml = `
                    <select class="select field-input" data-field="${field.name}" data-type="${field.type}">
                        <option value="">--None--</option>
                        ${options}
                    </select>`;
            } else {
                valueHtml = `
                    <input type="text"
                           class="input field-input"
                           value="${this.escapeAttr(displayValue)}"
                           ${isEditable ? '' : 'disabled'}
                           data-field="${field.name}"
                           data-type="${field.type}">`;
            }

            return `
                <div class="field-row" data-field="${field.name}">
                    <div class="field-label" title="${this.escapeAttr(field.label)}">${this.escapeHtml(field.label)}</div>
                    <div class="field-api-name" title="${this.escapeAttr(field.name)}">${field.name}</div>
                    <div class="field-type">${typeDisplay}</div>
                    <div class="field-value">${valueHtml}</div>
                    <div class="field-preview" title="${this.escapeAttr(previewText)}">${previewHtml}</div>
                </div>
            `;
        }).join('');

        this.fieldsContainer.querySelectorAll('input.field-input:not([disabled])').forEach(input => {
            input.addEventListener('input', (e) => this.handleFieldChange(e.target));
        });
        this.fieldsContainer.querySelectorAll('select.field-input').forEach(select => {
            select.addEventListener('change', (e) => this.handleFieldChange(e.target));
        });
    }

    formatValue(value, field) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'datetime':
            case 'date':
                return value;
            case 'double':
            case 'currency':
            case 'percent':
            case 'int':
                return String(value);
            default:
                return String(value);
        }
    }

    formatPreviewHtml(value, field, record) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return `<input type="checkbox" ${value ? 'checked' : ''} disabled>`;
            case 'datetime':
                return this.escapeHtml(new Date(value).toLocaleString());
            case 'date':
                return this.escapeHtml(new Date(value + 'T00:00:00').toLocaleDateString());
            case 'reference':
                if (field.relationshipName && field.referenceTo?.length > 0) {
                    const related = record[field.relationshipName];
                    const relatedType = field.referenceTo[0];
                    const nameField = this.nameFieldMap[relatedType] || 'Name';
                    const relatedName = related?.[nameField];
                    if (relatedName) {
                        const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
                        const url = `record.html?objectType=${encodeURIComponent(relatedType)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(this.connectionId)}`;
                        return `<a href="${url}" target="_blank">${this.escapeHtml(relatedName)} (${this.escapeHtml(displayType)})</a>`;
                    }
                }
            default:
                return value;
        }
    }

    formatPreviewText(value, field, record) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'datetime':
                return new Date(value).toLocaleString();
            case 'date':
                return new Date(value + 'T00:00:00').toLocaleDateString();
            case 'reference':
                if (field.relationshipName && field.referenceTo?.length > 0) {
                    const related = record[field.relationshipName];
                    const relatedType = field.referenceTo[0];
                    const nameField = this.nameFieldMap[relatedType] || 'Name';
                    const relatedName = related?.[nameField];
                    if (relatedName) {
                        const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
                        return `${relatedName} (${displayType})`;
                    }
                }
            default:
                return value;
        }
    }

    parseValue(stringValue, field) {
        if (stringValue === '' || stringValue === null) return null;

        switch (field.type) {
            case 'boolean':
                return stringValue.toLowerCase() === 'true';
            case 'int':
                const intVal = parseInt(stringValue, 10);
                return isNaN(intVal) ? null : intVal;
            case 'double':
            case 'currency':
            case 'percent':
                const floatVal = parseFloat(stringValue);
                return isNaN(floatVal) ? null : floatVal;
            default:
                return stringValue;
        }
    }

    handleFieldChange(input) {
        const fieldName = input.dataset.field;
        const field = this.fieldDescribe[fieldName];
        const newValue = this.parseValue(input.value, field);

        this.currentValues[fieldName] = newValue;

        const row = input.closest('.field-row');
        const originalValue = this.originalValues[fieldName];

        const isChanged = (originalValue === null || originalValue === undefined)
            ? (newValue !== null && newValue !== undefined && newValue !== '')
            : String(originalValue) !== String(newValue ?? '');

        if (isChanged) {
            row.classList.add('modified');
        } else {
            row.classList.remove('modified');
        }

        this.updateChangeCount();
    }

    updateChangeCount() {
        const changes = this.getChangedFields();
        const count = Object.keys(changes).length;

        if (count > 0) {
            this.changeCountEl.textContent = `${count} field${count > 1 ? 's' : ''} modified`;
            this.saveBtn.disabled = false;
        } else {
            this.changeCountEl.textContent = '';
            this.saveBtn.disabled = true;
        }
    }

    getChangedFields() {
        const changes = {};

        for (const [fieldName, field] of Object.entries(this.fieldDescribe)) {
            if (!field.updateable || field.calculated) continue;

            const original = this.originalValues[fieldName];
            const current = this.currentValues[fieldName];

            const originalStr = original === null || original === undefined ? '' : String(original);
            const currentStr = current === null || current === undefined ? '' : String(current);

            if (originalStr !== currentStr) {
                changes[fieldName] = current;
            }
        }

        return changes;
    }

    async saveChanges() {
        const changes = this.getChangedFields();

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

    setStatus(text, type) {
        this.statusEl.textContent = text;
        this.statusEl.className = 'status-badge';
        if (type) {
            this.statusEl.classList.add(`status-${type}`);
        }
    }

    showError(message) {
        this.setStatus('Error', 'error');
        this.fieldsContainer.innerHTML = `
            <div class="error-container">
                <p class="error-message">${this.escapeHtml(message)}</p>
                <p class="error-hint">Please check the connection and try again.</p>
            </div>
        `;
    }

    showSaveError(message) {
        alert(`Error saving record: ${message}`);
    }

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    escapeAttr(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}

customElements.define('record-page', RecordPage);
