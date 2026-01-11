// Schema Browser - Custom Element
import template from './schema.html?raw';
import './schema.css';
import { setActiveConnection } from '../../lib/utils.js';
import { getGlobalDescribe, getObjectDescribe } from '../../lib/salesforce.js';

class SchemaPage extends HTMLElement {
    // State
    connectionId = null;
    allObjects = [];
    filteredObjects = [];
    selectedObject = null;

    // DOM references
    objectFilterEl = null;
    objectCountEl = null;
    objectsListEl = null;
    fieldsPanelEl = null;
    selectedObjectLabelEl = null;
    selectedObjectNameEl = null;
    fieldsListEl = null;
    closeFieldsBtnEl = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.initialize();
    }

    initElements() {
        this.objectFilterEl = this.querySelector('#objectFilter');
        this.objectCountEl = this.querySelector('#objectCount');
        this.objectsListEl = this.querySelector('#objectsList');
        this.fieldsPanelEl = this.querySelector('#fieldsPanel');
        this.selectedObjectLabelEl = this.querySelector('#selectedObjectLabel');
        this.selectedObjectNameEl = this.querySelector('#selectedObjectName');
        this.fieldsListEl = this.querySelector('#fieldsList');
        this.closeFieldsBtnEl = this.querySelector('#closeFieldsBtn');
    }

    attachEventListeners() {
        this.objectFilterEl.addEventListener('input', (e) => this.filterObjects(e.target.value));
        this.closeFieldsBtnEl.addEventListener('click', () => this.closeFieldsPanel());
    }

    async initialize() {
        const params = new URLSearchParams(window.location.search);
        this.connectionId = params.get('connectionId');

        if (!this.connectionId) {
            this.showError('Missing connection ID');
            return;
        }

        const connection = await this.loadConnection(this.connectionId);
        if (!connection) {
            this.showError('Connection not found. Please re-authorize.');
            return;
        }

        setActiveConnection(connection);
        await this.loadObjects();
    }

    async loadConnection(id) {
        const { connections } = await chrome.storage.local.get(['connections']);
        return connections?.find(c => c.id === id) || null;
    }

    async loadObjects() {
        this.objectsListEl.innerHTML = '<div class="loading-container">Loading objects...</div>';

        try {
            const describe = await getGlobalDescribe();
            this.allObjects = describe.sobjects
                .filter(obj => obj.queryable)
                .sort((a, b) => a.name.localeCompare(b.name));

            this.filteredObjects = [...this.allObjects];
            this.renderObjects();
            this.updateObjectCount();

        } catch (error) {
            this.showError(error.message);
        }
    }

    filterObjects(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredObjects = [...this.allObjects];
        } else {
            this.filteredObjects = this.allObjects.filter(obj =>
                obj.name.toLowerCase().includes(term) ||
                obj.label.toLowerCase().includes(term)
            );
        }

        this.renderObjects();
        this.updateObjectCount();
    }

    renderObjects() {
        if (this.filteredObjects.length === 0) {
            this.objectsListEl.innerHTML = '<div class="loading-container">No objects found</div>';
            return;
        }

        this.objectsListEl.innerHTML = this.filteredObjects.map(obj => `
            <div class="object-item" data-name="${this.escapeAttr(obj.name)}">
                <div class="object-item-label">${this.escapeHtml(obj.label)}</div>
                <div class="object-item-name">${this.escapeHtml(obj.name)}</div>
            </div>
        `).join('');

        this.objectsListEl.querySelectorAll('.object-item').forEach(item => {
            item.addEventListener('click', () => this.selectObject(item.dataset.name));
        });
    }

    updateObjectCount() {
        const total = this.allObjects.length;
        const filtered = this.filteredObjects.length;

        if (filtered === total) {
            this.objectCountEl.textContent = `${total} objects`;
        } else {
            this.objectCountEl.textContent = `${filtered} of ${total} objects`;
        }
    }

    async selectObject(objectName) {
        // Update selected state in UI
        this.objectsListEl.querySelectorAll('.object-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.name === objectName);
        });

        // Adjust panel widths
        this.objectsListEl.closest('.objects-panel').classList.add('with-fields');

        // Find object metadata
        const obj = this.allObjects.find(o => o.name === objectName);
        if (!obj) return;

        this.selectedObject = obj;

        // Show fields panel
        this.fieldsPanelEl.style.display = 'flex';
        this.selectedObjectLabelEl.textContent = obj.label;
        this.selectedObjectNameEl.textContent = obj.name;

        // Load fields
        await this.loadFields(objectName);
    }

    async loadFields(objectName) {
        this.fieldsListEl.innerHTML = '<div class="loading-container">Loading fields...</div>';

        try {
            const describe = await getObjectDescribe(objectName);
            const fields = describe.fields || [];

            // Sort fields alphabetically by API name
            const sortedFields = [...fields].sort((a, b) => a.name.localeCompare(b.name));

            this.renderFields(sortedFields);

        } catch (error) {
            this.fieldsListEl.innerHTML = `
                <div class="error-container">
                    <p class="error-message">${this.escapeHtml(error.message)}</p>
                    <p class="error-hint">Could not load field information.</p>
                </div>
            `;
        }
    }

    renderFields(fields) {
        if (fields.length === 0) {
            this.fieldsListEl.innerHTML = '<div class="loading-container">No fields found</div>';
            return;
        }

        this.fieldsListEl.innerHTML = fields.map(field => {
            const typeDisplay = this.getFieldTypeDisplay(field);
            return `
                <div class="field-item">
                    <div class="field-item-label">${this.escapeHtml(field.label)}</div>
                    <div class="field-item-name">${this.escapeHtml(field.name)}</div>
                    <div class="field-item-type">${typeDisplay}</div>
                </div>
            `;
        }).join('');
    }

    getFieldTypeDisplay(field) {
        // Reuse type recognition logic from record viewer
        if (field.calculated) {
            return `${field.type} (formula)`;
        }

        if (field.type === 'reference' && field.referenceTo?.length > 0) {
            if (field.referenceTo.length === 1) {
                return `reference (${field.referenceTo[0]})`;
            } else {
                return `reference (${field.referenceTo.join(', ')})`;
            }
        }

        return field.type;
    }

    closeFieldsPanel() {
        this.fieldsPanelEl.style.display = 'none';
        this.objectsListEl.closest('.objects-panel').classList.remove('with-fields');
        this.objectsListEl.querySelectorAll('.object-item').forEach(item => {
            item.classList.remove('selected');
        });
        this.selectedObject = null;
    }

    showError(message) {
        this.objectsListEl.innerHTML = `
            <div class="error-container">
                <p class="error-message">${this.escapeHtml(message)}</p>
                <p class="error-hint">Please check the connection and try again.</p>
            </div>
        `;
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

customElements.define('schema-page', SchemaPage);
