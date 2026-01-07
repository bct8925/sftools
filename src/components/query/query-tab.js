// Query Tab - SOQL Query Editor with tabbed results
import template from './query.html?raw';
import './query.css';
import { isAuthenticated } from '../../lib/utils.js';
import '../monaco-editor/monaco-editor.js';
import { executeQueryWithColumns } from '../../lib/salesforce.js';

const MAX_HISTORY = 30;

class QueryTab extends HTMLElement {
    // State
    queryTabs = new Map(); // normalizedQuery -> tabData
    activeTabId = null;
    tabCounter = 0;

    // DOM references
    editor = null;
    tabsContainer = null;
    resultsContainer = null;
    executeBtn = null;
    statusSpan = null;

    // Dropdown DOM references
    dropdown = null;
    dropdownTrigger = null;
    historyList = null;
    favoritesList = null;
    dropdownTabs = [];

    // Search DOM references
    searchInput = null;
    searchClear = null;

    // History/Favorites cache
    history = [];
    favorites = [];

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditor();
        this.attachEventListeners();
        this.loadStoredData();
    }

    initElements() {
        this.tabsContainer = this.querySelector('.query-tabs');
        this.resultsContainer = this.querySelector('.query-results');
        this.executeBtn = this.querySelector('.query-execute-btn');
        this.statusSpan = this.querySelector('.query-status');

        // Dropdown elements
        this.dropdown = this.querySelector('.query-header-dropdown');
        this.dropdownTrigger = this.querySelector('.query-dropdown-trigger');
        this.historyList = this.querySelector('.query-history-list');
        this.favoritesList = this.querySelector('.query-favorites-list');
        this.dropdownTabs = this.querySelectorAll('.query-dropdown-tab');

        // Search elements
        this.searchInput = this.querySelector('.query-search-input');
        this.searchClear = this.querySelector('.query-search-clear');
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
        this.executeBtn.addEventListener('click', () => this.executeQuery());
        this.editor.addEventListener('execute', () => this.executeQuery());

        // Dropdown trigger
        this.dropdownTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });

        // Dropdown tab switching
        this.dropdownTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchDropdownTab(tab.dataset.tab));
        });

        // List click delegation
        this.historyList.addEventListener('click', (e) => this.handleListClick(e, 'history'));
        this.favoritesList.addEventListener('click', (e) => this.handleListClick(e, 'favorites'));

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!this.dropdown.contains(e.target)) {
                this.closeDropdown();
            }
        });

        // Search filtering
        this.searchInput.addEventListener('input', () => this.applyRowFilter());
        this.searchClear.addEventListener('click', () => this.clearRowFilter());
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

    toggleDropdown() {
        this.dropdown.classList.toggle('open');
    }

    closeDropdown() {
        this.dropdown.classList.remove('open');
    }

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
                this.closeDropdown();
            } else if (action.classList.contains('favorite')) {
                this.showFavoriteModal(scriptData.query);
                this.closeDropdown();
            } else if (action.classList.contains('delete')) {
                if (listType === 'history') {
                    this.removeFromHistory(id);
                } else {
                    this.removeFromFavorites(id);
                }
            }
        } else {
            this.loadQuery(scriptData.query);
            this.closeDropdown();
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

            if (col.joinColumns && col.joinColumns.length > 0) {
                columns.push(...this.flattenColumnMetadata(col.joinColumns, path));
            } else {
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
            const result = await executeQueryWithColumns(tabData.query);

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

            this.updateStatus(`${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`, 'success');
            this.renderTabs();

        } catch (error) {
            tabData.records = [];
            tabData.columns = [];
            tabData.error = error.message;
            this.updateStatus('Error', 'error');
            console.error('Query error:', error);
        }

        this.renderResults();
        // Clear search when results change
        this.clearRowFilter();
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
            totalSize: 0
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
            refreshBtn.innerHTML = '&#x21bb;';
            refreshBtn.title = 'Refresh';
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshTab(tab.id);
            });

            const closeBtn = document.createElement('button');
            closeBtn.className = 'query-tab-close';
            closeBtn.innerHTML = '&times;';
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

        const table = document.createElement('table');
        table.className = 'query-results-table';

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
            const row = document.createElement('tr');
            for (const col of tabData.columns) {
                const td = document.createElement('td');
                const value = this.getValueByPath(record, col.path);
                td.textContent = this.formatCellValue(value, col);
                td.title = this.formatCellValue(value, col);
                row.appendChild(td);
            }
            tbody.appendChild(row);
        }
        table.appendChild(tbody);

        this.resultsContainer.innerHTML = '';
        this.resultsContainer.appendChild(table);
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
}

customElements.define('query-tab', QueryTab);
