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
import { updateStatusBadge } from '../../lib/ui-helpers.js';
import { HistoryManager } from '../../lib/history-manager.js';
import { escapeHtml } from '../../lib/text-utils.js';
import { icons } from '../../lib/icons.js';

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

    // History/Favorites manager
    historyManager = null;
    pendingFavoriteQuery = null;

    // Bound event handlers for cleanup
    boundConnectionHandler = this.handleConnectionChange.bind(this);

    connectedCallback() {
        this.innerHTML = template;
        this.historyManager = new HistoryManager(
            { history: 'queryHistory', favorites: 'queryFavorites' },
            { contentProperty: 'query' }
        );
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

        // Favorite modal elements
        this.favoriteModal = this.querySelector('.query-favorite-modal');
        this.favoriteInput = this.querySelector('.query-favorite-input');
        this.favoriteCancelBtn = this.querySelector('.query-favorite-cancel');
        this.favoriteSaveBtn = this.querySelector('.query-favorite-save');

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

        // Favorite modal
        this.favoriteCancelBtn.addEventListener('click', () => this.favoriteModal.close());
        this.favoriteSaveBtn.addEventListener('click', () => this.handleFavoriteSave());
        this.favoriteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.handleFavoriteSave();
            } else if (e.key === 'Escape') {
                this.favoriteModal.close();
            }
        });

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
        await this.historyManager.load();
        this.renderLists();
    }

    // ============================================================
    // History & Favorites Logic
    // ============================================================

    async saveToHistory(query) {
        await this.historyManager.saveToHistory(query);
        this.renderLists();
    }

    async addToFavorites(query, label) {
        await this.historyManager.addToFavorites(query, label);
        this.renderLists();
    }

    async removeFromHistory(id) {
        await this.historyManager.removeFromHistory(id);
        this.renderLists();
    }

    async removeFromFavorites(id) {
        await this.historyManager.removeFromFavorites(id);
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
        const history = this.historyManager.history;

        if (history.length === 0) {
            this.historyList.innerHTML = `
                <div class="query-script-empty">
                    No queries yet.<br>Execute some SOQL to see history here.
                </div>
            `;
            return;
        }

        this.historyList.innerHTML = history.map(item => `
            <div class="query-script-item" data-id="${item.id}">
                <div class="query-script-preview">${escapeHtml(this.historyManager.getPreview(item.query))}</div>
                <div class="query-script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
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
        const favorites = this.historyManager.favorites;

        if (favorites.length === 0) {
            this.favoritesList.innerHTML = `
                <div class="query-script-empty">
                    No favorites yet.<br>Click &#9733; on a query to save it.
                </div>
            `;
            return;
        }

        this.favoritesList.innerHTML = favorites.map(item => `
            <div class="query-script-item" data-id="${item.id}">
                <div class="query-script-label">${escapeHtml(item.label)}</div>
                <div class="query-script-meta">
                    <span>${this.historyManager.formatRelativeTime(item.timestamp)}</span>
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
        const list = listType === 'history' ? this.historyManager.history : this.historyManager.favorites;
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
        this.pendingFavoriteQuery = query;
        const defaultLabel = this.historyManager.getPreview(query);

        this.favoriteInput.value = defaultLabel;
        this.favoriteModal.open();
        this.favoriteInput.focus();
        this.favoriteInput.select();
    }

    handleFavoriteSave() {
        const label = this.favoriteInput.value.trim();
        if (label && this.pendingFavoriteQuery) {
            this.addToFavorites(this.pendingFavoriteQuery, label);
            this.favoriteModal.close();
            this.pendingFavoriteQuery = null;
        }
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

            this.processColumnMetadata(result, tabData);

            tabData.isEditable = this.checkIfEditable(tabData);

            await this.fetchFieldMetadataIfEditable(tabData);

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
        this.clearRowFilter();
        this.updateExportButtonState();
        this.updateSaveButtonState();
    }

    processColumnMetadata(result, tabData) {
        if (result.columnMetadata.length > 0) {
            tabData.columns = this.flattenColumnMetadata(result.columnMetadata);
        } else if (tabData.records.length > 0) {
            tabData.columns = this.extractColumnsFromRecord(tabData.records[0]);
        } else {
            tabData.columns = [];
        }
    }

    async fetchFieldMetadataIfEditable(tabData) {
        if (!tabData.isEditable || !tabData.objectName) {
            return;
        }

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
        updateStatusBadge(this.statusSpan, status, type);
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
            refreshBtn.innerHTML = icons.refreshTab;
            refreshBtn.title = 'Refresh';
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshTab(tab.id);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'query-tab-close';
            closeBtn.innerHTML = icons.closeTab;
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
            this.resultsContainer.innerHTML = `<div class="query-results-error">${escapeHtml(tabData.error)}</div>`;
            return;
        }

        if (tabData.records.length === 0) {
            this.resultsContainer.innerHTML = '<div class="query-results-empty">No records found</div>';
            return;
        }

        const isEditMode = this.editingCheckbox.checked && tabData.isEditable;
        const table = this.createResultsTable(tabData, isEditMode);

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(table);

        if (isEditMode) {
            this.attachEditableListeners(tabData);
        }
    }

    createResultsTable(tabData, isEditMode) {
        const table = document.createElement('table');
        table.className = 'query-results-table';
        if (isEditMode) {
            table.classList.add('query-results-editable');
        }

        table.appendChild(this.createTableHeader(tabData.columns));
        table.appendChild(this.createTableBody(tabData, isEditMode));

        return table;
    }

    createTableHeader(columns) {
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        for (const col of columns) {
            const th = document.createElement('th');
            th.textContent = col.title;
            headerRow.appendChild(th);
        }

        thead.appendChild(headerRow);
        return thead;
    }

    createTableBody(tabData, isEditMode) {
        const tbody = document.createElement('tbody');

        for (const record of tabData.records) {
            const row = this.createRecordRow(record, tabData, isEditMode);
            tbody.appendChild(row);
        }

        return tbody;
    }

    createRecordRow(record, tabData, isEditMode) {
        const recordId = this.getValueByPath(record, 'Id');
        const row = document.createElement('tr');
        row.dataset.recordId = recordId;

        for (const col of tabData.columns) {
            const td = this.createCell(record, col, tabData, isEditMode, recordId, row);
            row.appendChild(td);
        }

        return row;
    }

    createCell(record, col, tabData, isEditMode, recordId, row) {
        const td = document.createElement('td');
        const value = this.getValueByPath(record, col.path);

        if (col.isSubquery) {
            this.renderSubqueryCell(td, value, col, row);
        } else if (col.path === 'Id' && value && tabData.objectName) {
            this.renderIdCell(td, value, tabData.objectName);
        } else if (isEditMode && this.isFieldEditable(col.path, tabData)) {
            this.renderEditableCell(td, value, col, tabData, recordId);
        } else {
            this.renderReadOnlyCell(td, value, col);
        }

        return td;
    }

    renderIdCell(td, value, objectName) {
        const connectionId = getActiveConnectionId();
        if (connectionId) {
            const link = document.createElement('a');
            link.href = `../../pages/record/record.html?objectType=${encodeURIComponent(objectName)}&recordId=${encodeURIComponent(value)}&connectionId=${encodeURIComponent(connectionId)}`;
            link.target = '_blank';
            link.textContent = value;
            link.className = 'query-id-link';
            td.appendChild(link);
        } else {
            td.textContent = value;
            td.title = value;
        }
    }

    renderEditableCell(td, value, col, tabData, recordId) {
        const field = tabData.fieldDescribe[col.path];
        const modifiedValue = tabData.modifiedRecords.get(recordId)?.[col.path];
        const displayValue = modifiedValue !== undefined ? modifiedValue : value;

        const input = this.createEditableInput(field, displayValue, recordId, col.path);
        td.appendChild(input);

        if (modifiedValue !== undefined) {
            td.classList.add('modified');
        }
    }

    renderReadOnlyCell(td, value, col) {
        td.textContent = this.formatCellValue(value, col);
        td.title = this.formatCellValue(value, col);
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
