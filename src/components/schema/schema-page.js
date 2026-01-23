// Schema Browser - Custom Element
import { setActiveConnection } from '../../lib/utils.js';
import {
    getGlobalDescribe,
    getObjectDescribe,
    getFormulaFieldMetadata,
    updateFormulaField,
} from '../../lib/salesforce.js';
import { escapeHtml, escapeAttr } from '../../lib/text-utils.js';
import { icons } from '../../lib/icons.js';
import '../sf-icon/sf-icon.js';
import {
    filterObjects as filterObjectsUtil,
    filterFields as filterFieldsUtil,
    getFieldTypeDisplay as getFieldTypeDisplayUtil,
} from '../../lib/schema-utils.js';
import '../button-icon/button-icon.js';
import { monaco } from '../monaco-editor/monaco-editor.js';
import '../modal-popup/modal-popup.js';
import template from './schema.html?raw';
import './schema.css';

// Completion provider state - shared with Monaco
const completionState = {
    fields: [], // Direct fields on the object
    relationshipFields: [], // Fields from related objects (e.g., Account.Name)
    active: false,
};

// Common Salesforce formula functions with signatures and descriptions
const FORMULA_FUNCTIONS = [
    // Logical Functions
    {
        name: 'IF',
        signature: 'IF(logical_test, value_if_true, value_if_false)',
        description: 'Returns one value if a condition is true and another if false',
    },
    {
        name: 'CASE',
        signature: 'CASE(expression, value1, result1, value2, result2, ..., else_result)',
        description:
            'Compares an expression to a series of values and returns the corresponding result',
    },
    {
        name: 'AND',
        signature: 'AND(logical1, logical2, ...)',
        description: 'Returns TRUE if all arguments are true',
    },
    {
        name: 'OR',
        signature: 'OR(logical1, logical2, ...)',
        description: 'Returns TRUE if any argument is true',
    },
    {
        name: 'NOT',
        signature: 'NOT(logical)',
        description: 'Returns TRUE if the argument is false',
    },
    {
        name: 'ISBLANK',
        signature: 'ISBLANK(expression)',
        description: 'Returns TRUE if the expression is blank',
    },
    {
        name: 'ISNULL',
        signature: 'ISNULL(expression)',
        description: 'Returns TRUE if the expression is null',
    },
    {
        name: 'ISCHANGED',
        signature: 'ISCHANGED(field)',
        description: 'Returns TRUE if the field value has changed (validation/workflow only)',
    },
    {
        name: 'ISNEW',
        signature: 'ISNEW()',
        description: 'Returns TRUE if the record is new (validation/workflow only)',
    },
    {
        name: 'PRIORVALUE',
        signature: 'PRIORVALUE(field)',
        description: 'Returns the previous value of a field (validation/workflow only)',
    },
    {
        name: 'BLANKVALUE',
        signature: 'BLANKVALUE(expression, substitute)',
        description: 'Returns substitute if expression is blank, otherwise returns expression',
    },
    {
        name: 'NULLVALUE',
        signature: 'NULLVALUE(expression, substitute)',
        description: 'Returns substitute if expression is null, otherwise returns expression',
    },

    // Text Functions
    { name: 'TEXT', signature: 'TEXT(value)', description: 'Converts a value to text' },
    { name: 'VALUE', signature: 'VALUE(text)', description: 'Converts text to a number' },
    {
        name: 'LEN',
        signature: 'LEN(text)',
        description: 'Returns the number of characters in a text string',
    },
    {
        name: 'LEFT',
        signature: 'LEFT(text, num_chars)',
        description: 'Returns the leftmost characters from a text string',
    },
    {
        name: 'RIGHT',
        signature: 'RIGHT(text, num_chars)',
        description: 'Returns the rightmost characters from a text string',
    },
    {
        name: 'MID',
        signature: 'MID(text, start_num, num_chars)',
        description: 'Returns characters from the middle of a text string',
    },
    { name: 'LOWER', signature: 'LOWER(text)', description: 'Converts text to lowercase' },
    { name: 'UPPER', signature: 'UPPER(text)', description: 'Converts text to uppercase' },
    { name: 'TRIM', signature: 'TRIM(text)', description: 'Removes leading and trailing spaces' },
    {
        name: 'CONTAINS',
        signature: 'CONTAINS(text, compare_text)',
        description: 'Returns TRUE if text contains compare_text',
    },
    {
        name: 'BEGINS',
        signature: 'BEGINS(text, compare_text)',
        description: 'Returns TRUE if text begins with compare_text',
    },
    {
        name: 'FIND',
        signature: 'FIND(search_text, text, start_num)',
        description: 'Returns the position of search_text within text',
    },
    {
        name: 'SUBSTITUTE',
        signature: 'SUBSTITUTE(text, old_text, new_text)',
        description: 'Substitutes new_text for old_text in a text string',
    },
    { name: 'BR', signature: 'BR()', description: 'Inserts a line break in a text string' },
    {
        name: 'HYPERLINK',
        signature: 'HYPERLINK(url, friendly_name, target)',
        description: 'Creates a hyperlink',
    },
    {
        name: 'IMAGE',
        signature: 'IMAGE(image_url, alt_text, height, width)',
        description: 'Inserts an image',
    },
    {
        name: 'ISPICKVAL',
        signature: 'ISPICKVAL(picklist_field, text_literal)',
        description: 'Returns TRUE if picklist value equals text',
    },
    {
        name: 'REGEX',
        signature: 'REGEX(text, regex_text)',
        description: 'Returns TRUE if text matches the regular expression',
    },
    {
        name: 'LPAD',
        signature: 'LPAD(text, padded_length, pad_string)',
        description: 'Pads text on the left with specified characters',
    },
    {
        name: 'RPAD',
        signature: 'RPAD(text, padded_length, pad_string)',
        description: 'Pads text on the right with specified characters',
    },

    // Date/Time Functions
    { name: 'TODAY', signature: 'TODAY()', description: 'Returns the current date' },
    { name: 'NOW', signature: 'NOW()', description: 'Returns the current date and time' },
    {
        name: 'DATE',
        signature: 'DATE(year, month, day)',
        description: 'Creates a date from year, month, and day',
    },
    {
        name: 'DATEVALUE',
        signature: 'DATEVALUE(expression)',
        description: 'Converts a datetime or text to a date',
    },
    {
        name: 'DATETIMEVALUE',
        signature: 'DATETIMEVALUE(expression)',
        description: 'Converts text to a datetime',
    },
    { name: 'YEAR', signature: 'YEAR(date)', description: 'Returns the year of a date' },
    { name: 'MONTH', signature: 'MONTH(date)', description: 'Returns the month of a date (1-12)' },
    { name: 'DAY', signature: 'DAY(date)', description: 'Returns the day of the month (1-31)' },
    {
        name: 'WEEKDAY',
        signature: 'WEEKDAY(date)',
        description: 'Returns the day of the week (1=Sunday, 7=Saturday)',
    },
    { name: 'ADDMONTHS', signature: 'ADDMONTHS(date, num)', description: 'Adds months to a date' },
    {
        name: 'HOUR',
        signature: 'HOUR(datetime)',
        description: 'Returns the hour of a datetime (0-23)',
    },
    {
        name: 'MINUTE',
        signature: 'MINUTE(datetime)',
        description: 'Returns the minute of a datetime (0-59)',
    },
    {
        name: 'SECOND',
        signature: 'SECOND(datetime)',
        description: 'Returns the second of a datetime (0-59)',
    },
    {
        name: 'MILLISECOND',
        signature: 'MILLISECOND(datetime)',
        description: 'Returns the millisecond of a datetime (0-999)',
    },
    { name: 'TIMENOW', signature: 'TIMENOW()', description: 'Returns the current time' },
    { name: 'TIMEVALUE', signature: 'TIMEVALUE(text)', description: 'Converts text to a time' },

    // Math Functions
    {
        name: 'ABS',
        signature: 'ABS(number)',
        description: 'Returns the absolute value of a number',
    },
    {
        name: 'CEILING',
        signature: 'CEILING(number)',
        description: 'Rounds a number up to the nearest integer',
    },
    {
        name: 'FLOOR',
        signature: 'FLOOR(number)',
        description: 'Rounds a number down to the nearest integer',
    },
    {
        name: 'ROUND',
        signature: 'ROUND(number, num_digits)',
        description: 'Rounds a number to a specified number of digits',
    },
    {
        name: 'MCEILING',
        signature: 'MCEILING(number)',
        description: 'Rounds a number up, away from zero',
    },
    {
        name: 'MFLOOR',
        signature: 'MFLOOR(number)',
        description: 'Rounds a number down, toward zero',
    },
    {
        name: 'MAX',
        signature: 'MAX(number1, number2, ...)',
        description: 'Returns the largest value',
    },
    {
        name: 'MIN',
        signature: 'MIN(number1, number2, ...)',
        description: 'Returns the smallest value',
    },
    {
        name: 'MOD',
        signature: 'MOD(number, divisor)',
        description: 'Returns the remainder after division',
    },
    { name: 'SQRT', signature: 'SQRT(number)', description: 'Returns the square root of a number' },
    {
        name: 'EXP',
        signature: 'EXP(number)',
        description: 'Returns e raised to the power of number',
    },
    {
        name: 'LN',
        signature: 'LN(number)',
        description: 'Returns the natural logarithm of a number',
    },
    {
        name: 'LOG',
        signature: 'LOG(number)',
        description: 'Returns the base-10 logarithm of a number',
    },
    {
        name: 'TRUNC',
        signature: 'TRUNC(number, num_digits)',
        description: 'Truncates a number to specified digits',
    },
    {
        name: 'GEOLOCATION',
        signature: 'GEOLOCATION(latitude, longitude)',
        description: 'Creates a geolocation value',
    },
    {
        name: 'DISTANCE',
        signature: 'DISTANCE(location1, location2, unit)',
        description: 'Returns the distance between two locations',
    },

    // Advanced Functions
    {
        name: 'CURRENCYRATE',
        signature: 'CURRENCYRATE(IsoCode)',
        description: 'Returns the conversion rate to the corporate currency',
    },
    {
        name: 'GETRECORDIDS',
        signature: 'GETRECORDIDS(object_type)',
        description: 'Returns an array of record IDs (Flow only)',
    },
    { name: 'HTMLENCODE', signature: 'HTMLENCODE(text)', description: 'Encodes text for HTML' },
    { name: 'JSENCODE', signature: 'JSENCODE(text)', description: 'Encodes text for JavaScript' },
    {
        name: 'JSINHTMLENCODE',
        signature: 'JSINHTMLENCODE(text)',
        description: 'Encodes text for JavaScript inside HTML',
    },
    { name: 'URLENCODE', signature: 'URLENCODE(text)', description: 'Encodes text for URLs' },
    {
        name: 'INCLUDE',
        signature: 'INCLUDE(s_control_name, inputs)',
        description: 'Includes an S-Control (legacy)',
    },
    {
        name: 'GETSESSIONID',
        signature: 'GETSESSIONID()',
        description: 'Returns the current session ID',
    },
    {
        name: 'LINKTO',
        signature: 'LINKTO(label, target, id, inputs, no_override)',
        description: 'Creates a relative URL link',
    },
    {
        name: 'URLFOR',
        signature: 'URLFOR(target, id, inputs, no_override)',
        description: 'Returns a relative URL',
    },
    {
        name: 'REQUIRESCRIPT',
        signature: 'REQUIRESCRIPT(url)',
        description: 'Includes a JavaScript file',
    },
    {
        name: 'IMAGEPROXYURL',
        signature: 'IMAGEPROXYURL(url)',
        description: 'Returns a proxied image URL',
    },
    {
        name: 'PARENTGROUPVAL',
        signature: 'PARENTGROUPVAL(summary_field, grouping_level)',
        description: 'Returns parent grouping value (reports only)',
    },
    {
        name: 'PREVGROUPVAL',
        signature: 'PREVGROUPVAL(summary_field, grouping_level, increment)',
        description: 'Returns previous grouping value (reports only)',
    },

    // Picklist Functions
    {
        name: 'INCLUDES',
        signature: 'INCLUDES(multiselect_picklist, text_literal)',
        description: 'Returns TRUE if multi-select picklist includes value',
    },
];

// Map Salesforce field types to Monaco completion item kinds
function getCompletionKind(field) {
    if (field.calculated) {
        return monaco.languages.CompletionItemKind.Constant; // Formula/rollup fields
    }
    if (field.type === 'reference') {
        return monaco.languages.CompletionItemKind.Reference;
    }
    if (field.type === 'boolean') {
        return monaco.languages.CompletionItemKind.Value;
    }
    if (field.type === 'picklist' || field.type === 'multipicklist') {
        return monaco.languages.CompletionItemKind.Enum;
    }
    if (field.type === 'id') {
        return monaco.languages.CompletionItemKind.Keyword;
    }
    if (['int', 'double', 'currency', 'percent'].includes(field.type)) {
        return monaco.languages.CompletionItemKind.Unit;
    }
    if (['date', 'datetime', 'time'].includes(field.type)) {
        return monaco.languages.CompletionItemKind.Event;
    }
    return monaco.languages.CompletionItemKind.Field;
}

// Register completion provider for formula fields (once, globally for 'apex' language)
monaco.languages.registerCompletionItemProvider('apex', {
    triggerCharacters: ['.'],
    provideCompletionItems: (model, position) => {
        if (!completionState.active) {
            return { suggestions: [] };
        }

        const word = model.getWordUntilPosition(position);
        const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
        };

        // Check if we're after a dot (relationship traversal)
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        const dotMatch = textBeforeCursor.match(/(\w+)\.$/);

        let suggestions = [];

        if (dotMatch) {
            // After a dot - show relationship fields for that relationship
            const relationshipName = dotMatch[1];
            const relatedFields = completionState.relationshipFields.filter(
                rf => rf.relationshipName.toLowerCase() === relationshipName.toLowerCase()
            );

            suggestions = relatedFields.map(rf => ({
                label: rf.fieldName,
                kind: getCompletionKind(rf.field),
                detail: `${rf.relationshipName}.${rf.fieldName} (${rf.field.type})`,
                documentation: rf.field.label,
                insertText: rf.fieldName,
                range,
            }));
        } else {
            // Direct fields
            const fieldSuggestions = completionState.fields.map(field => ({
                label: field.name,
                kind: getCompletionKind(field),
                detail: field.type + (field.calculated ? ' (formula)' : ''),
                documentation: field.label,
                insertText: field.name,
                range,
                sortText: `1_${field.name}`, // Sort fields first
            }));

            // Relationship names (for traversal)
            const relationshipNames = [
                ...new Set(completionState.relationshipFields.map(rf => rf.relationshipName)),
            ];
            const relationshipSuggestions = relationshipNames.map(name => ({
                label: name,
                kind: monaco.languages.CompletionItemKind.Module,
                detail: 'Relationship',
                documentation: `Access fields from related ${name} record`,
                insertText: name,
                range,
                sortText: `2_${name}`, // Sort relationships second
            }));

            // Formula functions
            const functionSuggestions = FORMULA_FUNCTIONS.map(fn => ({
                label: fn.name,
                kind: monaco.languages.CompletionItemKind.Function,
                detail: fn.signature,
                documentation: fn.description,
                insertText: `${fn.name}($0)`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
                sortText: `3_${fn.name}`, // Sort functions third
            }));

            suggestions = [...fieldSuggestions, ...relationshipSuggestions, ...functionSuggestions];
        }

        return { suggestions };
    },
});

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
    refreshObjectsBtnEl = null;
    fieldsPanelEl = null;
    selectedObjectLabelEl = null;
    selectedObjectNameEl = null;
    fieldFilterEl = null;
    fieldsListEl = null;
    refreshFieldsBtnEl = null;
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

    // Bound event handlers for cleanup
    boundDocClickHandler = null;
    boundCorsHandler = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.initCorsModal();
        this.initialize();
    }

    initElements() {
        this.objectFilterEl = this.querySelector('#objectFilter');
        this.objectCountEl = this.querySelector('#objectCount');
        this.objectsListEl = this.querySelector('#objectsList');
        this.refreshObjectsBtnEl = this.querySelector('#refreshObjectsBtn');
        this.fieldsPanelEl = this.querySelector('#fieldsPanel');
        this.selectedObjectLabelEl = this.querySelector('#selectedObjectLabel');
        this.selectedObjectNameEl = this.querySelector('#selectedObjectName');
        this.fieldFilterEl = this.querySelector('#fieldFilter');
        this.fieldsListEl = this.querySelector('#fieldsList');
        this.refreshFieldsBtnEl = this.querySelector('#refreshFieldsBtn');
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
        this.objectFilterEl.addEventListener('input', e => this.filterObjects(e.target.value));
        this.refreshObjectsBtnEl.addEventListener('click', () => this.refreshObjects());
        this.fieldFilterEl.addEventListener('input', e => this.filterFields(e.target.value));
        this.refreshFieldsBtnEl.addEventListener('click', () => this.refreshFields());
        this.closeFieldsBtnEl.addEventListener('click', () => this.closeFieldsPanel());

        // Modal event listeners
        this.modalSaveBtnEl.addEventListener('click', () => this.saveFormula());
        this.modalCancelBtnEl.addEventListener('click', () => this.closeFormulaModal());
        this.modalCloseBtnEl.addEventListener('click', () => this.closeFormulaModal());
        this.formulaModalEl.addEventListener('click', e => {
            if (e.target === this.formulaModalEl) {
                this.closeFormulaModal();
            }
        });

        // Close any open field menus when clicking outside (store bound handler for cleanup)
        this.boundDocClickHandler = e => {
            if (!e.target.closest('.field-menu-button') && !e.target.closest('.field-menu')) {
                this.closeAllFieldMenus();
            }
        };
        document.addEventListener('click', this.boundDocClickHandler);
    }

    disconnectedCallback() {
        // Clean up document-level event listeners to prevent memory leaks
        if (this.boundDocClickHandler) {
            document.removeEventListener('click', this.boundDocClickHandler);
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
        this.filteredObjects = filterObjectsUtil(this.allObjects, searchTerm);
        this.renderObjects();
        this.updateObjectCount();
    }

    renderObjects() {
        if (this.filteredObjects.length === 0) {
            this.objectsListEl.innerHTML = '<div class="loading-container">No objects found</div>';
            return;
        }

        this.objectsListEl.innerHTML = this.filteredObjects
            .map(
                obj => `
            <div class="object-item" data-name="${escapeAttr(obj.name)}">
                <div class="object-item-label">${escapeHtml(obj.label)}</div>
                <div class="object-item-name">${escapeHtml(obj.name)}</div>
            </div>
        `
            )
            .join('');

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

        // Find object metadata
        const obj = this.allObjects.find(o => o.name === objectName);
        if (!obj) return;

        this.selectedObject = obj;
        this.selectedObjectLabelEl.textContent = obj.label;
        this.selectedObjectNameEl.textContent = obj.name;

        // Show fields panel instantly (no transition on open)
        const objectsPanel = this.objectsListEl.closest('.objects-panel');
        objectsPanel.style.transition = 'none';
        objectsPanel.classList.add('with-fields');
        this.fieldsPanelEl.style.display = 'flex';

        // Re-enable transition for close animation
        requestAnimationFrame(() => {
            objectsPanel.style.transition = '';
        });

        // Load fields
        await this.loadFields(objectName);
    }

    navigateToObject(objectName) {
        // Check if object exists
        const obj = this.allObjects.find(o => o.name === objectName);
        if (!obj) {
            console.warn(`Object ${objectName} not found`);
            return;
        }

        // Clear object filter to ensure the object is visible
        this.objectFilterEl.value = '';
        this.filteredObjects = [...this.allObjects];
        this.renderObjects();
        this.updateObjectCount();

        // Scroll to and select the object
        const objectItem = this.objectsListEl.querySelector(
            `.object-item[data-name="${objectName}"]`
        );
        if (objectItem) {
            objectItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.selectObject(objectName);
        }
    }

    async loadFields(objectName, bypassCache = false) {
        this.fieldsListEl.innerHTML = '<div class="loading-container">Loading fields...</div>';
        this.fieldFilterEl.value = '';

        try {
            const describe = await getObjectDescribe(objectName, bypassCache);
            const fields = describe.fields || [];

            // Sort fields alphabetically by API name
            this.allFields = [...fields].sort((a, b) => a.name.localeCompare(b.name));
            this.filteredFields = [...this.allFields];

            this.renderFields();
        } catch (error) {
            this.fieldsListEl.innerHTML = `
                <div class="error-container">
                    <p class="error-message">${escapeHtml(error.message)}</p>
                    <p class="error-hint">Could not load field information.</p>
                </div>
            `;
        }
    }

    async refreshObjects() {
        this.refreshObjectsBtnEl.setAttribute('disabled', '');
        this.objectsListEl.innerHTML = '<div class="loading-container">Refreshing objects...</div>';

        try {
            const describe = await getGlobalDescribe(true); // bypass cache
            this.allObjects = describe.sobjects
                .filter(obj => obj.queryable)
                .sort((a, b) => a.name.localeCompare(b.name));

            this.filteredObjects = [...this.allObjects];
            this.filterObjects(this.objectFilterEl.value); // re-apply current filter
            this.updateObjectCount();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.refreshObjectsBtnEl.removeAttribute('disabled');
        }
    }

    async refreshFields() {
        if (!this.selectedObject) return;

        this.refreshFieldsBtnEl.setAttribute('disabled', '');

        try {
            await this.loadFields(this.selectedObject.name, true); // bypass cache
        } finally {
            this.refreshFieldsBtnEl.removeAttribute('disabled');
        }
    }

    filterFields(searchTerm) {
        this.filteredFields = filterFieldsUtil(this.allFields, searchTerm);
        this.renderFields();
    }

    renderFields() {
        const fields = this.filteredFields;

        if (fields.length === 0) {
            this.fieldsListEl.innerHTML = '<div class="loading-container">No fields found</div>';
            return;
        }

        this.fieldsListEl.innerHTML = fields
            .map(field => {
                const typeDisplay = this.getFieldTypeDisplay(field);
                const isFormulaField = field.calculated && field.calculatedFormula;

                // Generate type display HTML - with links for reference fields
                let typeHtml;
                if (typeDisplay.isReference && typeDisplay.referenceTo) {
                    // Create clickable links for each referenced object
                    const links = typeDisplay.referenceTo
                        .map(
                            objName =>
                                `<a href="#" class="reference-link" data-object="${escapeAttr(objName)}">${escapeHtml(objName)}</a>`
                        )
                        .join(', ');
                    typeHtml = `reference (${links})`;
                } else {
                    typeHtml = escapeHtml(typeDisplay.text);
                }

                return `
                <div class="field-item" data-field-name="${escapeAttr(field.name)}">
                    <div class="field-item-label" title="${escapeAttr(field.label)}">${escapeHtml(field.label)}</div>
                    <div class="field-item-name" title="${escapeAttr(field.name)}">${escapeHtml(field.name)}</div>
                    <div class="field-item-type" title="${escapeAttr(typeDisplay.text)}">${typeHtml}</div>
                    <div class="field-item-actions">
                        ${
                            isFormulaField
                                ? `
                            <button class="field-menu-button" data-field-name="${escapeAttr(field.name)}" aria-label="More options">
                                ${icons.verticalDots}
                            </button>
                            <div class="field-menu" data-field-name="${escapeAttr(field.name)}">
                                <div class="field-menu-item" data-action="edit" data-field-name="${escapeAttr(field.name)}">Edit</div>
                            </div>
                        `
                                : ''
                        }
                    </div>
                </div>
            `;
            })
            .join('');

        // Attach event listeners to reference links
        this.fieldsListEl.querySelectorAll('.reference-link').forEach(link => {
            link.addEventListener('click', e => {
                e.preventDefault();
                const objectName = link.dataset.object;
                this.navigateToObject(objectName);
            });
        });

        // Attach event listeners to field menu buttons
        this.fieldsListEl.querySelectorAll('.field-menu-button').forEach(button => {
            button.addEventListener('click', e => {
                e.stopPropagation();
                this.toggleFieldMenu(button.dataset.fieldName);
            });
        });

        // Attach event listeners to menu items
        this.fieldsListEl.querySelectorAll('.field-menu-item').forEach(item => {
            item.addEventListener('click', e => {
                e.stopPropagation();
                const { action } = item.dataset;
                const { fieldName } = item.dataset;

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
        return getFieldTypeDisplayUtil(field);
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
                <p class="error-message">${escapeHtml(message)}</p>
                <p class="error-hint">Please check the connection and try again.</p>
            </div>
        `;
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
            objectName: this.selectedObject.name,
        };

        // Set fields for autocompletion
        completionState.fields = this.allFields;
        completionState.active = true;

        // Load relationship fields asynchronously (don't block modal opening)
        this.loadRelationshipFields();

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

    async loadRelationshipFields() {
        // Find reference fields with relationship names
        const referenceFields = this.allFields.filter(
            f => f.type === 'reference' && f.relationshipName && f.referenceTo?.length > 0
        );

        // Clear existing relationship fields
        completionState.relationshipFields = [];

        // Load fields for each related object (in parallel, but limit concurrency)
        const relatedObjectNames = [...new Set(referenceFields.flatMap(f => f.referenceTo))];

        // Fetch describes for all related objects
        const describePromises = relatedObjectNames.map(async objectName => {
            try {
                const describe = await getObjectDescribe(objectName);
                return { objectName, fields: describe.fields || [] };
            } catch {
                return { objectName, fields: [] };
            }
        });

        const describes = await Promise.all(describePromises);
        const fieldsByObject = new Map(describes.map(d => [d.objectName, d.fields]));

        // Build relationship field suggestions
        for (const refField of referenceFields) {
            const { relationshipName } = refField;

            for (const targetObject of refField.referenceTo) {
                const targetFields = fieldsByObject.get(targetObject) || [];

                for (const targetField of targetFields) {
                    completionState.relationshipFields.push({
                        relationshipName,
                        fieldName: targetField.name,
                        field: targetField,
                        targetObject,
                    });
                }
            }
        }
    }

    closeFormulaModal() {
        this.formulaModalEl.classList.remove('show');
        this.currentFormulaField = null;
        this.formulaEditorEl.clear();
        this.modalStatusEl.textContent = '';
        this.modalStatusEl.className = 'modal-status';
        this.modalSaveBtnEl.disabled = false;

        // Clear autocompletion state
        completionState.fields = [];
        completionState.relationshipFields = [];
        completionState.active = false;
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
