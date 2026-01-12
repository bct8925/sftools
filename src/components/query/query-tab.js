// Query Tab - SOQL Query Editor with tabbed results
import template from './query.html?raw';
import './query.css';
import { isAuthenticated, getActiveConnectionId } from '../../lib/utils.js';
import '../monaco-editor/monaco-editor.js';
import '../button-dropdown/button-dropdown.js';
import '../button-icon/button-icon.js';
import '../modal-popup/modal-popup.js';
import { executeQueryWithColumns, executeBulkQueryExport, getObjectDescribe, updateRecord } from '../../lib/salesforce.js';
import {
    registerSOQLCompletionProvider,
    activateSOQLAutocomplete,
    deactivateSOQLAutocomplete,
    loadGlobalDescribe,
    clearState as clearAutocompleteState
} from '../../lib/soql-autocomplete.js';

const MAX_HISTORY = 30;

class QueryTab extends HTMLElement {
    // State
    queryTabs = new Map(); // normalizedQuery -> tabData
    activeTabId = null;
    tabCounter = 0;
    bulkExportInProgress = false;

    // DOM references
    editor = null;
    tabsContainer = null;
    resultsContainer = null;
    toolingCheckbox = null;
    editingCheckbox = null;
    statusSpan = null;
    searchInput = null;
    exportBtn = null;
    saveBtn = null;
    clearBtn = null;

    // Button components
    historyBtn = null;
    historyModal = null;
    settingsBtn = null;
    resultsBtn = null;
    actionBtn = null;

    // History dropdown elements
    historyList = null;
    favoritesList = null;
    dropdownTabs = [];

    // History/Favorites cache
    history = [];
    favorites = [];

    // Bound event handlers for cleanup
    boundConnectionHandler = this.handleConnectionChange.bind(this);

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditor();
        this.attachEventListeners();
        this.loadStoredData();

        // Initialize SOQL autocomplete
        registerSOQLCompletionProvider();
        activateSOQLAutocomplete();
        loadGlobalDescribe();

        // Listen for connection changes
        document.addEventListener('connection-changed', this.boundConnectionHandler);
    }

    disconnectedCallback() {
        deactivateSOQLAutocomplete();
        document.removeEventListener('connection-changed', this.boundConnectionHandler);
    }

    handleConnectionChange() {
        clearAutocompleteState();
        loadGlobalDescribe();
    }

    initElements() {
        this.tabsContainer = this.querySelector('.query-tabs');
        this.resultsContainer = this.querySelector('.query-results');
        this.toolingCheckbox = this.querySelector('.query-tooling-checkbox');
        this.editingCheckbox = this.querySelector('.query-editing-checkbox');
        this.statusSpan = this.querySelector('.query-status');

        // Button components
        this.historyBtn = this.querySelector('.query-history-btn');
        this.historyModal = this.querySelector('.query-history-modal');
        this.settingsBtn = this.querySelector('.query-settings-btn');
        this.resultsBtn = this.querySelector('.query-results-btn');
        this.actionBtn = this.querySelector('.query-action-btn');

        // History dropdown elements
        this.historyList = this.querySelector('.query-history-list');
        this.favoritesList = this.querySelector('.query-favorites-list');
        this.dropdownTabs = this.querySelectorAll('.query-dropdown-tab');

        // Search elements
        this.searchInput = this.querySelector('.query-search-input');

        // Export, Save, and Clear buttons (inside results dropdown)
        this.exportBtn = this.querySelector('.query-export-btn');
        this.saveBtn = this.querySelector('.query-save-btn');
        this.clearBtn = this.querySelector('.query-clear-btn');

        // Setup action button options
        this.actionBtn.setOptions([
            { label: 'Export', disabled: false }
        ]);
    }

    initEditor() {
        this.editor = this.querySelector('.query-editor');
        this.editor.setValue(`SELECT
    Id,
    Name
FROM Account
LIMIT 10`);
    }

    attachEventListeners() {
        // Query execution
        this.actionBtn.addEventListener('click-main', () => this.executeQuery());
        this.actionBtn.addEventListener('click-option', (e) => {
            if (e.detail.index === 0) this.bulkExport();
        });
        this.editor.addEventListener('execute', () => this.executeQuery());

        // History modal
        this.historyBtn.addEventListener('click', () => this.historyModal.toggle());

        // History tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchDropdownTab(tab.dataset.tab));
        });

        // List click delegation
        this.historyList.addEventListener('click', (e) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e) => this.handleListClick(e, 'favorites'));

        // Search filtering
        this.searchInput.addEventListener('input', () => this.applyRowFilter());

        // Export CSV handler
        this.exportBtn.addEventListener('click', () => {
            this.exportCurrentResults();
            this.resultsBtn.close();
        });

        // Save changes handler
        this.saveBtn.addEventListener('click', () => {
            this.saveChanges();
            this.resultsBtn.close();
        });

        // Clear changes handler
        this.clearBtn.addEventListener('click', () => {
            this.clearChanges();
            this.resultsBtn.close();
        });

        // Editing checkbox handler
        this.editingCheckbox.addEventListener('change', () => {
            this.renderResults();
            this.updateSaveButtonState();
        });
    }

    // ============================================================
    // Storage Operations
    // ============================================================

    async loadStoredData() {
        const data = await chrome.storage.local.get(['queryHistory', 'queryFavorites']);
        this.history = data.queryHistory || [];
        this.favorites = data.queryFavorites || [];
        this.renderLists();
    }

    async saveHistory() {
        await chrome.storage.local.set({ queryHistory: this.history });
    }

    async saveFavorites() {
        await chrome.storage.local.set({ queryFavorites: this.favorites });
    }

    // ============================================================
    // History & Favorites Logic
    // ============================================================

    async saveToHistory(query) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) return;

        // If already in favorites, just update the timestamp
        const favoriteIndex = this.favorites.findIndex(item => item.query.trim() === trimmedQuery);
        if (favoriteIndex !== -1) {
            this.favorites[favoriteIndex].timestamp = Date.now();
            await this.saveFavorites();
            this.renderLists();
            return;
        }

        // Remove duplicate if exists
        const existingIndex = this.history.findIndex(item => item.query.trim() === trimmedQuery);
        if (existingIndex !== -1) {
            this.history.splice(existingIndex, 1);
        }

        // Add to beginning
        this.history.unshift({
            id: Date.now().toString(),
            query: trimmedQuery,
            timestamp: Date.now()
        });

        // Trim to max size
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(0, MAX_HISTORY);
        }

        await this.saveHistory();
        this.renderLists();
    }

    async addToFavorites(query, label) {
        const trimmedQuery = query.trim();
        if (!trimmedQuery || !label.trim()) return;

        this.favorites.unshift({
            id: Date.now().toString(),
            query: trimmedQuery,
            label: label.trim(),
            timestamp: Date.now()
        });

        await this.saveFavorites();
        this.renderLists();
    }

    async removeFromHistory(id) {
        this.history = this.history.filter(item => item.id !== id);
        await this.saveHistory();
        this.renderLists();
    }

    async removeFromFavorites(id) {
        this.favorites = this.favorites.filter(item => item.id !== id);
        await this.saveFavorites();
        this.renderLists();
    }

    loadQuery(query) {
        this.editor.setValue(query);
    }

    // ============================================================
    // Dropdown UI
    // ============================================================

    switchDropdownTab(tabName) {
        this.dropdownTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        this.historyList.style.display = tabName === 'history' ? '' : 'none';
        this.favoritesList.style.display = tabName === 'favorites' ? '' : 'none';
    }

    // ============================================================
    // List Rendering
    // ============================================================

    renderLists() {
        this.renderHistoryList();
        this.renderFavoritesList();
    }

    renderHistoryList() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = `
                <div class="query-script-empty">
                    No queries yet.<br>Execute some SOQL to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = this.history.map(item => `
            <div class="query-script-item" data-id="${item.id}">
                <div class="query-script-preview">${this.escapeHtml(this.getPreview(item.query))}</div>
                <div class="query-script-meta">
                    <span>${this.formatRelativeTime(item.timestamp)}</span>
                    <div class="query-script-actions">
                        <button class="query-script-action load" title="Load query">&#8629;</button>
                        <button class="query-script-action favorite" title="Add to favorites">&#9733;</button>
                        <button class="query-script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderFavoritesList() {
        if (this.favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="query-script-empty">
                    No favorites yet.<br>Click &#9733; on a query to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = this.favorites.map(item => `
            <div class="query-script-item" data-id="${item.id}">
                <div class="query-script-label">${this.escapeHtml(item.label)}</div>
                <div class="query-script-meta">
                    <span>${this.formatRelativeTime(item.timestamp)}</span>
                    <div class="query-script-actions">
                        <button class="query-script-action load" title="Load query">&#8629;</button>
                        <button class="query-script-action delete" title="Delete">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    handleListClick(event, listType) {
        const item = event.target.closest('.query-script-item');
        if (!item) return;

        const id = item.dataset.id;
        const list = listType === 'history' ? this.history : this.favorites;
        const scriptData = list.find(s => s.id === id);
        if (!scriptData) return;

        const action = event.target.closest('.query-script-action');
        if (action) {
            event.stopPropagation();

            if (action.classList.contains('load')) {
                this.loadQuery(scriptData.query);
                this.historyModal.close();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(scriptData.query);
                this.historyModal.close();
            } else if (action.classList.contains('delete')) {
                if (listType === 'history') {
                    this.removeFromHistory(id);
                } else {
                    this.removeFromFavorites(id);
                }
            }
        } else {
            this.loadQuery(scriptData.query);
            this.historyModal.close();
        }
    }

    showFavoriteModal(query) {
        const defaultLabel = this.getPreview(query);

        const modal = document.createElement('div');
        modal.className = 'query-favorite-modal';
        modal.innerHTML = `
            <div class="query-favorite-dialog">
                <h3>Add to Favorites</h3>
                <input type="text" class="query-favorite-input" placeholder="Enter a label for this query" value="${this.escapeHtml(defaultLabel)}">
                <div class="query-favorite-buttons">
                    <button class="button-neutral query-favorite-cancel">Cancel</button>
                    <button class="button-brand query-favorite-save">Save</button>
                </div>
            </div>
        `;

        const input = modal.querySelector('.query-favorite-input');
        const cancelBtn = modal.querySelector('.query-favorite-cancel');
        const saveBtn = modal.querySelector('.query-favorite-save');

        const close = () => modal.remove();

        cancelBtn.addEventListener('click', close);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });

        saveBtn.addEventListener('click', () => {
            const label = input.value.trim();
            if (label) {
                this.addToFavorites(query, label);
                close();
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveBtn.click();
            } else if (e.key === 'Escape') {
                close();
            }
        });

        document.body.appendChild(modal);
        input.focus();
        input.select();
    }

    // ============================================================
    // Row Filter (Search)
    // ============================================================

    applyRowFilter() {
        const filter = this.searchInput.value.trim().toLowerCase();
        const rows = this.resultsContainer.querySelectorAll('.query-results-table tbody tr');

        if (!filter) {
            rows.forEach(row => row.classList.remove('hidden'));
            return;
        }

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.classList.toggle('hidden', !text.includes(filter));
        });
    }

    clearRowFilter() {
        this.searchInput.value = '';
        const rows = this.resultsContainer.querySelectorAll('.query-results-table tbody tr');
        rows.forEach(row => row.classList.remove('hidden'));
    }

    // ============================================================
    // Utility Methods
    // ============================================================

    getPreview(query) {
        // Get first meaningful part of query
        const cleaned = query.replace(/\s+/g, ' ').trim();
        return cleaned.length > 60 ? cleaned.substring(0, 60) + '...' : cleaned;
    }

    formatRelativeTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    // ============================================================
    // Data Transformations
    // ============================================================

    normalizeQuery(query) {
        return query.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    flattenColumnMetadata(columnMetadata, prefix = '') {
        const columns = [];

        for (const col of columnMetadata) {
            const columnName = col.columnName;
            const path = prefix ? `${prefix}.${columnName}` : columnName;

            // Check if this is a subquery (has aggregate=true and joinColumns)
            // Subqueries in Salesforce are marked as aggregate even though they're not actual aggregates
            const isSubquery = col.aggregate && col.joinColumns && col.joinColumns.length > 0;

            if (isSubquery) {
                // For subqueries, add a single column representing the entire subquery
                const title = prefix ? path : col.displayName;
                columns.push({
                    title: title,
                    path: path,
                    aggregate: false,
                    isSubquery: true,
                    subqueryColumns: col.joinColumns // Store subquery columns for later rendering
                });
            } else if (col.joinColumns && col.joinColumns.length > 0) {
                // Regular parent relationship - flatten it
                columns.push(...this.flattenColumnMetadata(col.joinColumns, path));
            } else {
                // Regular scalar column
                const title = prefix ? path : col.displayName;
                columns.push({
                    title: title,
                    path: path,
                    aggregate: col.aggregate || false,
                    isSubquery: false
                });
            }
        }

        return columns;
    }

    extractColumnsFromRecord(record) {
        return Object.keys(record)
            .filter(key => key !== 'attributes')
            .map(key => ({
                title: key,
                path: key,
                aggregate: false,
                isSubquery: false
            }));
    }

    getValueByPath(record, path) {
        if (!path) return undefined;

        const parts = path.split('.');
        let value = record;

        for (const part of parts) {
            if (value === null || value === undefined) return undefined;
            value = value[part];
        }

        return value;
    }

    // ============================================================
    // Query Execution
    // ============================================================

    async executeQuery() {
        const query = this.editor.getValue().trim();

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        const normalizedQuery = this.normalizeQuery(query);

        const existingTab = this.queryTabs.get(normalizedQuery);
        if (existingTab) {
            this.switchToTab(existingTab.id);
            await this.refreshTab(existingTab.id);
            // Save to history even for refresh
            await this.saveToHistory(query);
            return;
        }

        const tabId = this.createTab(query, normalizedQuery);
        this.switchToTab(tabId);
        await this.fetchQueryData(tabId);

        // Save to history after successful execution
        await this.saveToHistory(query);
    }

    async fetchQueryData(tabId) {
        const tabData = this.getTabDataById(tabId);
        if (!tabData) return;

        this.updateStatus('Loading...', 'loading');
        tabData.error = null;

        try {
            const useToolingApi = this.toolingCheckbox.checked;
            const result = await executeQueryWithColumns(tabData.query, useToolingApi);

            tabData.records = result.records;
            tabData.totalSize = result.totalSize;
            tabData.objectName = result.entityName;

            if (result.columnMetadata.length > 0) {
                tabData.columns = this.flattenColumnMetadata(result.columnMetadata);
            } else if (tabData.records.length > 0) {
                tabData.columns = this.extractColumnsFromRecord(tabData.records[0]);
            } else {
                tabData.columns = [];
            }

            // Check if query is editable (has Id column, non-aggregate, single object)
            tabData.isEditable = this.checkIfEditable(tabData);

            // Fetch field metadata if editable
            if (tabData.isEditable && tabData.objectName) {
                try {
                    const describe = await getObjectDescribe(tabData.objectName);
                    tabData.fieldDescribe = {};
                    for (const field of describe.fields) {
                        tabData.fieldDescribe[field.name] = field;
                    }
                } catch (err) {
                    console.warn('Failed to fetch field metadata:', err);
                    tabData.isEditable = false;
                }
            }

            this.updateStatus(`${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`, 'success');
            this.renderTabs();

        } catch (error) {
            tabData.records = [];
            tabData.columns = [];
            tabData.error = error.message;
            tabData.isEditable = false;
            this.updateStatus('Error', 'error');
            console.error('Query error:', error);
        }

        this.renderResults();
        // Clear search when results change
        this.clearRowFilter();
        this.updateExportButtonState();
        this.updateSaveButtonState();
    }

    checkIfEditable(tabData) {
        // Must have Id column
        const hasIdColumn = tabData.columns.some(col => col.path === 'Id');
        if (!hasIdColumn) return false;

        // Must not have aggregate functions
        const hasAggregate = tabData.columns.some(col => col.aggregate);
        if (hasAggregate) return false;

        // Must have a single object name
        if (!tabData.objectName) return false;

        return true;
    }

    // ============================================================
    // Tab Management
    // ============================================================

    createTab(query, normalizedQuery) {
        const tabId = `query-tab-${++this.tabCounter}`;
        const tabData = {
            id: tabId,
            query: query,
            normalizedQuery: normalizedQuery,
            objectName: null,
            records: [],
            columns: [],
            totalSize: 0,
            fieldDescribe: null,
            modifiedRecords: new Map(), // recordId -> { fieldName: newValue }
            isEditable: false
        };

        this.queryTabs.set(normalizedQuery, tabData);
        this.renderTabs();
        return tabId;
    }

    switchToTab(tabId) {
        this.activeTabId = tabId;
        this.renderTabs();
        this.renderResults();
        // Clear search when switching tabs
        this.clearRowFilter();
        this.updateExportButtonState();
    }

    async refreshTab(tabId) {
        const tabData = this.getTabDataById(tabId);
        if (tabData) {
            await this.fetchQueryData(tabId);
        }
    }

    getTabDataById(tabId) {
        for (const tab of this.queryTabs.values()) {
            if (tab.id === tabId) {
                return tab;
            }
        }
        return null;
    }

    closeTab(tabId) {
        let keyToRemove = null;
        for (const [key, tab] of this.queryTabs) {
            if (tab.id === tabId) {
                keyToRemove = key;
                break;
            }
        }

        if (keyToRemove) {
            this.queryTabs.delete(keyToRemove);

            if (this.activeTabId === tabId) {
                const remaining = Array.from(this.queryTabs.values());
                if (remaining.length > 0) {
                    this.switchToTab(remaining[remaining.length - 1].id);
                } else {
                    this.activeTabId = null;
                    this.renderTabs();
                    this.renderResults();
                    this.updateExportButtonState();
                }
            } else {
                this.renderTabs();
            }
        }
    }

    getTabLabel(tab) {
        if (tab.objectName) {
            return tab.objectName;
        }

        const maxLength = 30;
        if (tab.query.length <= maxLength) return tab.query;
        return tab.query.substring(0, maxLength) + '...';
    }

    // ============================================================
    // UI Rendering
    // ============================================================

    updateStatus(status, type = '') {
        this.statusSpan.textContent = status;
        this.statusSpan.className = 'status-badge';
        if (type) {
            this.statusSpan.classList.add(`status-${type}`);
        }
    }

    renderTabs() {
        this.tabsContainer.innerHTML = '';

        if (this.queryTabs.size === 0) {
            this.tabsContainer.innerHTML = '<div class="query-tabs-empty">Run a query to see results</div>';
            return;
        }

        for (const tab of this.queryTabs.values()) {
            const tabEl = document.createElement('div');
            tabEl.className = `query-tab${tab.id === this.activeTabId ? ' active' : ''}`;
            tabEl.dataset.tabId = tab.id;

            const label = document.createElement('span');
            label.className = 'query-tab-label';
            label.textContent = this.getTabLabel(tab);
            label.title = tab.query;
            label.addEventListener('click', () => this.switchToTab(tab.id));

            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'query-tab-refresh';
            refreshBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>';
            refreshBtn.title = 'Refresh';
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshTab(tab.id);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'query-tab-close';
            closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z"/></svg>';
            closeBtn.title = 'Close';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tab.id);
            });

            tabEl.appendChild(label);
            tabEl.appendChild(refreshBtn);
            tabEl.appendChild(closeBtn);
            this.tabsContainer.appendChild(tabEl);
        }
    }

    renderResults() {
        if (!this.activeTabId) {
            this.resultsContainer.innerHTML = '<div class="query-results-empty">No query results to display</div>';
            return;
        }

        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData) {
            this.resultsContainer.innerHTML = '<div class="query-results-empty">No query results to display</div>';
            return;
        }

        if (tabData.error) {
            this.resultsContainer.innerHTML = `<div class="query-results-error">${this.escapeHtml(tabData.error)}</div>`;
            return;
        }

        if (tabData.records.length === 0) {
            this.resultsContainer.innerHTML = '<div class="query-results-empty">No records found</div>';
            return;
        }

        const isEditMode = this.editingCheckbox.checked && tabData.isEditable;

        const table = document.createElement('table');
        table.className = 'query-results-table';
        if (isEditMode) {
            table.classList.add('query-results-editable');
        }

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const col of tabData.columns) {
            const th = document.createElement('th');
            th.textContent = col.title;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        for (const record of tabData.records) {
            const recordId = this.getValueByPath(record, 'Id');
            const row = document.createElement('tr');
            row.dataset.recordId = recordId;

            for (const col of tabData.columns) {
                const td = document.createElement('td');
                const value = this.getValueByPath(record, col.path);

                if (col.isSubquery) {
                    // Render subquery cell with expand/collapse functionality
                    this.renderSubqueryCell(td, value, col, row);
                } else if (col.path === 'Id' && value && tabData.objectName) {
                    // Render Id as clickable link to record-viewer
                    const connectionId = getActiveConnectionId();
                    if (connectionId) {
                        const link = document.createElement('a');
                        link.href = `../../pages/record/record.html?objectType=${encodeURIComponent(tabData.objectName)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(connectionId)}`;
                        link.target = '_blank';
                        link.textContent = value;
                        link.className = 'query-id-link';
                        td.appendChild(link);
                    } else {
                        td.textContent = this.formatCellValue(value, col);
                        td.title = this.formatCellValue(value, col);
                    }
                } else if (isEditMode && this.isFieldEditable(col.path, tabData)) {
                    // Render as editable field
                    const field = tabData.fieldDescribe[col.path];
                    const modifiedValue = tabData.modifiedRecords.get(recordId)?.[col.path];
                    const displayValue = modifiedValue !== undefined ? modifiedValue : value;

                    const input = this.createEditableInput(field, displayValue, recordId, col.path);
                    td.appendChild(input);

                    if (modifiedValue !== undefined) {
                        td.classList.add('modified');
                    }
                } else {
                    // Render as read-only text
                    td.textContent = this.formatCellValue(value, col);
                    td.title = this.formatCellValue(value, col);
                }

                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(table);

        // Attach event listeners to editable inputs
        if (isEditMode) {
            this.attachEditableListeners(tabData);
        }
    }

    renderSubqueryCell(td, value, col, parentRow) {
        td.className = 'query-subquery-cell';

        if (!value || !value.records || value.records.length === 0) {
            td.textContent = '(0 records)';
            td.classList.add('query-subquery-empty');
            return;
        }

        const count = value.totalSize || value.records.length;
        const button = document.createElement('button');
        button.className = 'query-subquery-toggle';
        button.textContent = `▶ ${count} record${count !== 1 ? 's' : ''}`;
        button.dataset.expanded = 'false';

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const isExpanded = button.dataset.expanded === 'true';

            if (isExpanded) {
                // Collapse - remove the detail row
                button.textContent = `▶ ${count} record${count !== 1 ? 's' : ''}`;
                button.dataset.expanded = 'false';
                const detailRow = parentRow.nextElementSibling;
                if (detailRow && detailRow.classList.contains('query-subquery-detail')) {
                    detailRow.remove();
                }
            } else {
                // Expand - insert detail row
                button.textContent = `▼ ${count} record${count !== 1 ? 's' : ''}`;
                button.dataset.expanded = 'true';
                this.insertSubqueryDetailRow(parentRow, value, col);
            }
        });

        td.appendChild(button);
    }

    insertSubqueryDetailRow(parentRow, subqueryData, col) {
        // Remove existing detail row if any
        const existingDetail = parentRow.nextElementSibling;
        if (existingDetail && existingDetail.classList.contains('query-subquery-detail')) {
            existingDetail.remove();
        }

        const detailRow = document.createElement('tr');
        detailRow.className = 'query-subquery-detail';

        const detailCell = document.createElement('td');
        detailCell.colSpan = parentRow.children.length;

        // Create nested table for subquery results
        const nestedTable = document.createElement('table');
        nestedTable.className = 'query-subquery-table';

        // Get column names from subqueryColumns metadata
        const subqueryColumns = col.subqueryColumns || [];
        const flattenedSubCols = this.flattenColumnMetadata(subqueryColumns);

        // If no metadata, infer from first record
        const columns = flattenedSubCols.length > 0
            ? flattenedSubCols
            : this.extractColumnsFromRecord(subqueryData.records[0]);

        // Build header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (const subCol of columns) {
            const th = document.createElement('th');
            th.textContent = subCol.title;
            headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        nestedTable.appendChild(thead);

        // Build rows
        const tbody = document.createElement('tbody');
        for (const record of subqueryData.records) {
            const row = document.createElement('tr');
            for (const subCol of columns) {
                const td = document.createElement('td');
                const value = this.getValueByPath(record, subCol.path);
                td.textContent = this.formatCellValue(value, subCol);
                td.title = this.formatCellValue(value, subCol);
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        nestedTable.appendChild(tbody);

        detailCell.appendChild(nestedTable);
        detailRow.appendChild(detailCell);

        // Insert after parent row
        parentRow.parentNode.insertBefore(detailRow, parentRow.nextSibling);
    }

    formatCellValue(value, col) {
        if (value === null || value === undefined) {
            return '';
        }

        if (col?.isSubquery && typeof value === 'object') {
            if (value.records) {
                return `[${value.totalSize || value.records.length} records]`;
            }
            if (Array.isArray(value)) {
                return `[${value.length} records]`;
            }
        }

        if (typeof value === 'object') {
            if (value.Name !== undefined) return value.Name;
            if (value.Id !== undefined) return value.Id;
            return JSON.stringify(value);
        }

        return String(value);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ============================================================
    // CSV Export
    // ============================================================

    exportCurrentResults() {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.records.length === 0) return;

        const csv = this.recordsToCsv(tabData.records, tabData.columns);
        this.downloadCsv(csv, this.getExportFilename(tabData));
    }

    recordsToCsv(records, columns) {
        const rows = [];

        const headers = columns.map(col => this.escapeCsvField(col.title));
        rows.push(headers.join(','));

        for (const record of records) {
            const row = columns.map(col => {
                const value = this.getValueByPath(record, col.path);
                return this.escapeCsvField(this.formatCellValue(value, col));
            });
            rows.push(row.join(','));
        }

        return rows.join('\n');
    }

    escapeCsvField(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    getExportFilename(tabData) {
        const objectName = tabData.objectName || 'query';
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `${objectName}_${timestamp}.csv`;
    }

    downloadCsv(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async bulkExport() {
        const query = this.editor.getValue().trim();

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated()) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        if (this.toolingCheckbox.checked) {
            alert('Bulk export is not supported with Tooling API.');
            return;
        }

        if (this.bulkExportInProgress) return;

        this.bulkExportInProgress = true;
        this.actionBtn.setOptionDisabled(0, true);

        try {
            const csv = await executeBulkQueryExport(query, (state, recordCount) => {
                if (state === 'InProgress' || state === 'UploadComplete') {
                    this.updateStatus(`Processing: ${recordCount} records`, 'loading');
                } else if (state === 'Creating job...') {
                    this.updateStatus('Creating bulk job...', 'loading');
                } else if (state === 'Downloading...') {
                    this.updateStatus('Downloading results...', 'loading');
                }
            });

            const objectMatch = query.match(/FROM\s+(\w+)/i);
            const objectName = objectMatch ? objectMatch[1] : 'export';
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
            const filename = `${objectName}_${timestamp}.csv`;

            this.downloadCsv(csv, filename);
            this.updateStatus('Export complete', 'success');

        } catch (error) {
            console.error('Bulk export error:', error);
            this.updateStatus('Export failed', 'error');
            alert(`Bulk export failed: ${error.message}`);
        } finally {
            this.bulkExportInProgress = false;
            this.actionBtn.setOptionDisabled(0, false);
        }
    }

    updateExportButtonState() {
        const tabData = this.getTabDataById(this.activeTabId);
        const hasResults = tabData && tabData.records && tabData.records.length > 0;
        this.exportBtn.disabled = !hasResults;
    }

    updateSaveButtonState() {
        const tabData = this.getTabDataById(this.activeTabId);
        const isEditMode = this.editingCheckbox.checked && tabData?.isEditable;
        const hasModifications = tabData && tabData.modifiedRecords.size > 0;
        this.saveBtn.disabled = !isEditMode || !hasModifications;
        this.clearBtn.disabled = !isEditMode || !hasModifications;
    }

    // ============================================================
    // Field Editing
    // ============================================================

    isFieldEditable(fieldPath, tabData) {
        // Only direct fields (not relationships) are editable
        if (fieldPath.includes('.')) return false;

        const field = tabData.fieldDescribe?.[fieldPath];
        if (!field) return false;

        return field.updateable && !field.calculated;
    }

    createEditableInput(field, value, recordId, fieldName) {
        const formattedValue = this.formatValueForInput(value, field);

        if (field.type === 'boolean') {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'query-field-input';
            checkbox.checked = value === true;
            checkbox.dataset.recordId = recordId;
            checkbox.dataset.fieldName = fieldName;
            checkbox.dataset.fieldType = field.type;
            return checkbox;
        }

        if (field.type === 'picklist') {
            const select = document.createElement('select');
            select.className = 'query-field-input';
            select.dataset.recordId = recordId;
            select.dataset.fieldName = fieldName;
            select.dataset.fieldType = field.type;

            const noneOption = document.createElement('option');
            noneOption.value = '';
            noneOption.textContent = '--None--';
            select.appendChild(noneOption);

            for (const pv of (field.picklistValues || [])) {
                if (pv.active) {
                    const option = document.createElement('option');
                    option.value = pv.value;
                    option.textContent = pv.label;
                    if (pv.value === value) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                }
            }

            return select;
        }

        // Default: text input
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'query-field-input';
        input.value = formattedValue;
        input.dataset.recordId = recordId;
        input.dataset.fieldName = fieldName;
        input.dataset.fieldType = field.type;
        return input;
    }

    formatValueForInput(value, field) {
        if (value === null || value === undefined) return '';

        switch (field.type) {
            case 'boolean':
                return value ? 'true' : 'false';
            case 'datetime':
            case 'date':
            case 'double':
            case 'currency':
            case 'percent':
            case 'int':
                return String(value);
            default:
                return String(value);
        }
    }

    parseValueFromInput(stringValue, field) {
        if (stringValue === '' || stringValue === null) return null;

        switch (field.type) {
            case 'boolean':
                return stringValue === 'true' || stringValue === true;
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

    attachEditableListeners(tabData) {
        const inputs = this.resultsContainer.querySelectorAll('.query-field-input');

        inputs.forEach(input => {
            const handler = (e) => {
                const recordId = e.target.dataset.recordId;
                const fieldName = e.target.dataset.fieldName;
                const fieldType = e.target.dataset.fieldType;
                const field = tabData.fieldDescribe[fieldName];

                let newValue;
                if (fieldType === 'boolean') {
                    newValue = e.target.checked;
                } else {
                    newValue = this.parseValueFromInput(e.target.value, field);
                }

                // Get original value from record
                const record = tabData.records.find(r => this.getValueByPath(r, 'Id') === recordId);
                const originalValue = this.getValueByPath(record, fieldName);

                // Compare values
                const isChanged = (originalValue === null || originalValue === undefined)
                    ? (newValue !== null && newValue !== undefined && newValue !== '')
                    : String(originalValue) !== String(newValue ?? '');

                if (isChanged) {
                    // Mark as modified
                    if (!tabData.modifiedRecords.has(recordId)) {
                        tabData.modifiedRecords.set(recordId, {});
                    }
                    tabData.modifiedRecords.get(recordId)[fieldName] = newValue;
                    e.target.closest('td').classList.add('modified');
                } else {
                    // Remove modification
                    if (tabData.modifiedRecords.has(recordId)) {
                        delete tabData.modifiedRecords.get(recordId)[fieldName];
                        if (Object.keys(tabData.modifiedRecords.get(recordId)).length === 0) {
                            tabData.modifiedRecords.delete(recordId);
                        }
                    }
                    e.target.closest('td').classList.remove('modified');
                }

                this.updateSaveButtonState();
            };

            if (input.type === 'checkbox') {
                input.addEventListener('change', handler);
            } else {
                input.addEventListener('input', handler);
            }
        });
    }

    async saveChanges() {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.modifiedRecords.size === 0) {
            return;
        }

        this.updateStatus('Saving...', 'loading');
        this.saveBtn.disabled = true;

        const updatePromises = [];
        const errors = [];

        for (const [recordId, fields] of tabData.modifiedRecords.entries()) {
            updatePromises.push(
                updateRecord(tabData.objectName, recordId, fields)
                    .then(() => {
                        // Update the original record data
                        const record = tabData.records.find(r => this.getValueByPath(r, 'Id') === recordId);
                        if (record) {
                            for (const [fieldName, value] of Object.entries(fields)) {
                                record[fieldName] = value;
                            }
                        }
                    })
                    .catch(error => {
                        errors.push({ recordId, error: error.message });
                    })
            );
        }

        await Promise.all(updatePromises);

        if (errors.length === 0) {
            // Clear all modifications
            tabData.modifiedRecords.clear();
            this.updateStatus('Saved', 'success');
            this.renderResults();
        } else {
            this.updateStatus('Save Failed', 'error');
            const errorMsg = errors.map(e => `Record ${e.recordId}: ${e.error}`).join('\n');
            alert(`Failed to save some records:\n\n${errorMsg}`);
        }

        this.updateSaveButtonState();
    }

    clearChanges() {
        const tabData = this.getTabDataById(this.activeTabId);
        if (!tabData || tabData.modifiedRecords.size === 0) {
            return;
        }

        tabData.modifiedRecords.clear();
        this.renderResults();
        this.updateSaveButtonState();
    }
}

customElements.define('query-tab', QueryTab);
