// Schema Browser - Custom Element
import template from './schema.html?raw';
import './schema.css';
import '../monaco-editor/monaco-editor.js';
import { setActiveConnection } from '../../lib/utils.js';
import { getGlobalDescribe, getObjectDescribe, getFormulaFieldMetadata, updateFormulaField } from '../../lib/salesforce.js';

class SchemaPage extends HTMLElement {
    // State
    connectionId = null;
    allObjects = [];
    filteredObjects = [];
    selectedObject = null;
    allFields = [];
    filteredFields = [];

    // DOM references
    objectFilterEl = null;
    objectCountEl = null;
    objectsListEl = null;
    fieldsPanelEl = null;
    selectedObjectLabelEl = null;
    selectedObjectNameEl = null;
    fieldFilterEl = null;
    fieldsListEl = null;
    closeFieldsBtnEl = null;

    // Modal references
    formulaModalEl = null;
    formulaEditorEl = null;
    modalFieldInfoEl = null;
    modalStatusEl = null;
    modalSaveBtnEl = null;
    modalCancelBtnEl = null;
    modalCloseBtnEl = null;

    // Current formula field being edited
    currentFormulaField = null;

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
        this.fieldFilterEl = this.querySelector('#fieldFilter');
        this.fieldsListEl = this.querySelector('#fieldsList');
        this.closeFieldsBtnEl = this.querySelector('#closeFieldsBtn');

        // Modal elements
        this.formulaModalEl = this.querySelector('#formulaModal');
        this.formulaEditorEl = this.querySelector('#formulaEditor');
        this.modalFieldInfoEl = this.querySelector('#modalFieldInfo');
        this.modalStatusEl = this.querySelector('#modalStatus');
        this.modalSaveBtnEl = this.querySelector('#modalSaveBtn');
        this.modalCancelBtnEl = this.querySelector('#modalCancelBtn');
        this.modalCloseBtnEl = this.querySelector('#modalCloseBtn');
    }

    attachEventListeners() {
        this.objectFilterEl.addEventListener('input', (e) => this.filterObjects(e.target.value));
        this.fieldFilterEl.addEventListener('input', (e) => this.filterFields(e.target.value));
        this.closeFieldsBtnEl.addEventListener('click', () => this.closeFieldsPanel());

        // Modal event listeners
        this.modalSaveBtnEl.addEventListener('click', () => this.saveFormula());
        this.modalCancelBtnEl.addEventListener('click', () => this.closeFormulaModal());
        this.modalCloseBtnEl.addEventListener('click', () => this.closeFormulaModal());
        this.formulaModalEl.addEventListener('click', (e) => {
            if (e.target === this.formulaModalEl) {
                this.closeFormulaModal();
            }
        });

        // Close any open field menus when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.field-menu-button') && !e.target.closest('.field-menu')) {
                this.closeAllFieldMenus();
            }
        });
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
        this.fieldFilterEl.value = '';

        try {
            const describe = await getObjectDescribe(objectName);
            const fields = describe.fields || [];

            // Sort fields alphabetically by API name
            this.allFields = [...fields].sort((a, b) => a.name.localeCompare(b.name));
            this.filteredFields = [...this.allFields];

            this.renderFields();

        } catch (error) {
            this.fieldsListEl.innerHTML = `
                <div class="error-container">
                    <p class="error-message">${this.escapeHtml(error.message)}</p>
                    <p class="error-hint">Could not load field information.</p>
                </div>
            `;
        }
    }

    filterFields(searchTerm) {
        const term = searchTerm.toLowerCase().trim();

        if (!term) {
            this.filteredFields = [...this.allFields];
        } else {
            this.filteredFields = this.allFields.filter(field =>
                field.name.toLowerCase().includes(term) ||
                field.label.toLowerCase().includes(term)
            );
        }

        this.renderFields();
    }

    renderFields() {
        const fields = this.filteredFields;

        if (fields.length === 0) {
            this.fieldsListEl.innerHTML = '<div class="loading-container">No fields found</div>';
            return;
        }

        this.fieldsListEl.innerHTML = fields.map(field => {
            const typeDisplay = this.getFieldTypeDisplay(field);
            const isFormulaField = field.calculated && field.calculatedFormula;

            return `
                <div class="field-item" data-field-name="${this.escapeAttr(field.name)}">
                    <div class="field-item-label" title="${this.escapeAttr(field.label)}">${this.escapeHtml(field.label)}</div>
                    <div class="field-item-name" title="${this.escapeAttr(field.name)}">${this.escapeHtml(field.name)}</div>
                    <div class="field-item-type" title="${this.escapeAttr(typeDisplay)}">${typeDisplay}</div>
                    <div class="field-item-actions">
                        ${isFormulaField ? `
                            <button class="field-menu-button" data-field-name="${this.escapeAttr(field.name)}" aria-label="More options">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                    <circle cx="8" cy="3" r="1.5"/>
                                    <circle cx="8" cy="8" r="1.5"/>
                                    <circle cx="8" cy="13" r="1.5"/>
                                </svg>
                            </button>
                            <div class="field-menu" data-field-name="${this.escapeAttr(field.name)}">
                                <div class="field-menu-item" data-action="edit" data-field-name="${this.escapeAttr(field.name)}">Edit</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Attach event listeners to field menu buttons
        this.fieldsListEl.querySelectorAll('.field-menu-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFieldMenu(button.dataset.fieldName);
            });
        });

        // Attach event listeners to menu items
        this.fieldsListEl.querySelectorAll('.field-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                const fieldName = item.dataset.fieldName;

                if (action === 'edit') {
                    const field = fields.find(f => f.name === fieldName);
                    if (field) {
                        this.openFormulaEditor(field);
                    }
                }

                this.closeAllFieldMenus();
            });
        });
    }

    getFieldTypeDisplay(field) {
        // Reuse type recognition logic from record viewer
        if (field.calculated) {
            if (field.calculatedFormula) {
                return `${field.type} (formula)`;
            }
            return `${field.type} (rollup)`;
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

    // Field menu methods
    toggleFieldMenu(fieldName) {
        const menu = this.fieldsListEl.querySelector(`.field-menu[data-field-name="${fieldName}"]`);
        if (!menu) return;

        // Close all other menus first
        this.closeAllFieldMenus();

        // Toggle this menu
        menu.classList.toggle('show');
    }

    closeAllFieldMenus() {
        this.fieldsListEl.querySelectorAll('.field-menu').forEach(menu => {
            menu.classList.remove('show');
        });
    }

    // Formula editor modal methods
    async openFormulaEditor(field) {
        this.currentFormulaField = {
            field,
            objectName: this.selectedObject.name
        };

        // Update modal header
        this.modalFieldInfoEl.textContent = `${this.selectedObject.label} > ${field.label} (${field.name})`;

        // Show modal
        this.formulaModalEl.classList.add('show');

        // Clear status and disable save until loaded
        this.modalStatusEl.textContent = '';
        this.modalStatusEl.className = 'modal-status';
        this.modalSaveBtnEl.disabled = true;

        // Load formula metadata
        try {
            this.modalStatusEl.textContent = 'Loading formula...';
            this.formulaEditorEl.setValue('Loading formula...');
            const metadata = await getFormulaFieldMetadata(this.selectedObject.name, field.name);

            this.currentFormulaField.id = metadata.id;
            this.currentFormulaField.metadata = metadata.metadata;

            // Set formula in editor
            this.formulaEditorEl.setValue(metadata.formula || '');
            this.modalStatusEl.textContent = '';
            this.modalSaveBtnEl.disabled = false;

        } catch (error) {
            this.modalStatusEl.textContent = `Error loading formula: ${error.message}`;
            this.modalStatusEl.className = 'modal-status error';
        }
    }

    closeFormulaModal() {
        this.formulaModalEl.classList.remove('show');
        this.currentFormulaField = null;
        this.formulaEditorEl.clear();
        this.modalStatusEl.textContent = '';
        this.modalStatusEl.className = 'modal-status';
        this.modalSaveBtnEl.disabled = false;
    }

    async saveFormula() {
        if (!this.currentFormulaField) return;

        const newFormula = this.formulaEditorEl.getValue();

        // Disable save button during save
        this.modalSaveBtnEl.disabled = true;
        this.modalStatusEl.textContent = 'Saving...';
        this.modalStatusEl.className = 'modal-status';

        try {
            await updateFormulaField(
                this.currentFormulaField.id,
                newFormula,
                this.currentFormulaField.metadata
            );

            this.modalStatusEl.textContent = 'Formula saved successfully!';
            this.modalStatusEl.className = 'modal-status success';

            // Close modal after a brief delay
            setTimeout(() => {
                this.closeFormulaModal();
                // Reload fields to reflect any changes
                this.loadFields(this.selectedObject.name);
            }, 1500);

        } catch (error) {
            this.modalStatusEl.textContent = `Error saving: ${error.message}`;
            this.modalStatusEl.className = 'modal-status error';
            this.modalSaveBtnEl.disabled = false;
        }
    }
}

customElements.define('schema-page', SchemaPage);
