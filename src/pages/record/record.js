// Record Viewer - Standalone Tool
import { setActiveConnection } from '../../lib/utils.js';
import { getObjectDescribe, getRecordWithRelationships, updateRecord } from '../../lib/salesforce.js';

// --- State ---
let objectType = null;
let recordId = null;
let connectionId = null;
let fieldDescribe = {};
let originalValues = {};
let currentValues = {};

// --- DOM References ---
const objectNameEl = document.getElementById('objectName');
const recordIdEl = document.getElementById('recordId');
const statusEl = document.getElementById('status');
const fieldsContainer = document.getElementById('fieldsContainer');
const saveBtn = document.getElementById('saveBtn');
const refreshBtn = document.getElementById('refreshBtn');
const changeCountEl = document.getElementById('changeCount');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    objectType = params.get('objectType');
    recordId = params.get('recordId');
    connectionId = params.get('connectionId');

    if (!objectType || !recordId || !connectionId) {
        showError('Missing required parameters');
        return;
    }

    recordIdEl.textContent = recordId;
    objectNameEl.textContent = objectType;

    const connection = await loadConnection(connectionId);
    if (!connection) {
        showError('Connection not found. Please re-authorize.');
        return;
    }

    setActiveConnection(connection);

    await loadRecord();

    saveBtn.addEventListener('click', saveChanges);
    refreshBtn.addEventListener('click', loadRecord);
});

async function loadConnection(id) {
    const { connections } = await chrome.storage.local.get(['connections']);
    return connections?.find(c => c.id === id) || null;
}

// --- Data Loading ---
async function loadRecord() {
    setStatus('Loading...', 'loading');
    fieldsContainer.innerHTML = '<div class="loading-container">Loading record data...</div>';

    try {
        // Get describe first, then fetch record with relationship names
        const describe = await getObjectDescribe(objectType);
        const record = await getRecordWithRelationships(objectType, recordId, describe.fields);

        fieldDescribe = {};
        for (const field of describe.fields) {
            fieldDescribe[field.name] = field;
        }

        objectNameEl.textContent = describe.label;
        document.title = `${describe.label} - Record Viewer - sftools`;

        originalValues = { ...record };
        currentValues = { ...record };

        renderFields(describe.fields, record);

        setStatus('Loaded', 'success');
        updateChangeCount();

    } catch (error) {
        showError(error.message);
    }
}

function renderFields(fields, record) {
    // Sort: Id first, Name second, then alphabetically by API name
    const sortedFields = [...fields].sort((a, b) => {
        if (a.name === 'Id') return -1;
        if (b.name === 'Id') return 1;
        if (a.name === 'Name') return -1;
        if (b.name === 'Name') return 1;
        return a.name.localeCompare(b.name);
    });

    // Filter out compound and internal fields
    const excludeTypes = ['address', 'location'];
    const excludeNames = ['attributes'];
    const filteredFields = sortedFields.filter(f =>
        !excludeNames.includes(f.name) &&
        !excludeTypes.includes(f.type)
    );

    fieldsContainer.innerHTML = filteredFields.map(field => {
        const value = record[field.name];
        const displayValue = formatValue(value, field);
        const previewHtml = formatPreviewHtml(value, field, record);
        const isEditable = field.updateable && !field.calculated;

        const typeDisplay = field.calculated ? `${field.type} (formula)` : field.type;

        return `
            <div class="field-row" data-field="${field.name}">
                <div class="field-label" title="${escapeAttr(field.label)}">${escapeHtml(field.label)}</div>
                <div class="field-api-name" title="${escapeAttr(field.name)}">${field.name}</div>
                <div class="field-type">${typeDisplay}</div>
                <div class="field-value">
                    <input type="text"
                           class="input field-input"
                           value="${escapeAttr(displayValue)}"
                           ${isEditable ? '' : 'disabled'}
                           data-field="${field.name}"
                           data-type="${field.type}">
                </div>
                <div class="field-preview">${previewHtml}</div>
            </div>
        `;
    }).join('');

    fieldsContainer.querySelectorAll('.field-input:not([disabled])').forEach(input => {
        input.addEventListener('input', (e) => handleFieldChange(e.target));
    });
}

function formatValue(value, field) {
    if (value === null || value === undefined) return '';

    switch (field.type) {
        case 'boolean':
            return value ? 'true' : 'false';
        case 'datetime':
        case 'date':
            // Keep ISO format for editing - Salesforce expects YYYY-MM-DD or ISO datetime
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

function formatPreviewHtml(value, field, record) {
    if (value === null || value === undefined) return '';

    switch (field.type) {
        case 'boolean':
            return `<input type="checkbox" ${value ? 'checked' : ''} disabled>`;
        case 'datetime':
            return escapeHtml(new Date(value).toLocaleString());
        case 'date':
            return escapeHtml(new Date(value + 'T00:00:00').toLocaleDateString());
        case 'reference':
            // Look up related record name via relationship and create link
            if (field.relationshipName && field.referenceTo?.length > 0) {
                const related = record[field.relationshipName];
                const relatedName = related?.Name;
                if (relatedName) {
                    const relatedType = field.referenceTo[0];
                    const displayType = field.name === 'OwnerId' ? 'User/Group' : relatedType;
                    const url = `record.html?objectType=${encodeURIComponent(relatedType)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(connectionId)}`;
                    return `<a href="${url}" target="_blank">${escapeHtml(relatedName)} (${escapeHtml(displayType)})</a>`;
                }
            }
        default:
            return value;
    }
}

function parseValue(stringValue, field) {
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

function handleFieldChange(input) {
    const fieldName = input.dataset.field;
    const field = fieldDescribe[fieldName];
    const newValue = parseValue(input.value, field);

    currentValues[fieldName] = newValue;

    const row = input.closest('.field-row');
    const originalValue = originalValues[fieldName];

    const isChanged = (originalValue === null || originalValue === undefined)
        ? (newValue !== null && newValue !== undefined && newValue !== '')
        : String(originalValue) !== String(newValue ?? '');

    if (isChanged) {
        row.classList.add('modified');
    } else {
        row.classList.remove('modified');
    }

    updateChangeCount();
}

function updateChangeCount() {
    const changes = getChangedFields();
    const count = Object.keys(changes).length;

    if (count > 0) {
        changeCountEl.textContent = `${count} field${count > 1 ? 's' : ''} modified`;
        saveBtn.disabled = false;
    } else {
        changeCountEl.textContent = '';
        saveBtn.disabled = true;
    }
}

function getChangedFields() {
    const changes = {};

    for (const [fieldName, field] of Object.entries(fieldDescribe)) {
        if (!field.updateable || field.calculated) continue;

        const original = originalValues[fieldName];
        const current = currentValues[fieldName];

        const originalStr = original === null || original === undefined ? '' : String(original);
        const currentStr = current === null || current === undefined ? '' : String(current);

        if (originalStr !== currentStr) {
            changes[fieldName] = current;
        }
    }

    return changes;
}

async function saveChanges() {
    const changes = getChangedFields();

    if (Object.keys(changes).length === 0) {
        return;
    }

    setStatus('Saving...', 'loading');
    saveBtn.disabled = true;

    try {
        await updateRecord(objectType, recordId, changes);

        for (const [fieldName, value] of Object.entries(changes)) {
            originalValues[fieldName] = value;
        }

        fieldsContainer.querySelectorAll('.field-row.modified').forEach(row => {
            row.classList.remove('modified');
        });

        setStatus('Saved', 'success');
        updateChangeCount();

    } catch (error) {
        setStatus('Save Failed', 'error');
        showSaveError(error.message);
        saveBtn.disabled = false;
    }
}

// --- UI Helpers ---
function setStatus(text, type) {
    statusEl.textContent = text;
    statusEl.className = 'status-badge';
    if (type) {
        statusEl.classList.add(`status-${type}`);
    }
}

function showError(message) {
    setStatus('Error', 'error');
    fieldsContainer.innerHTML = `
        <div class="error-container">
            <p class="error-message">${escapeHtml(message)}</p>
            <p class="error-hint">Please check the connection and try again.</p>
        </div>
    `;
}

function showSaveError(message) {
    alert(`Error saving record: ${message}`);
}

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function escapeAttr(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
