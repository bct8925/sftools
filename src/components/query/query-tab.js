// Query Tab - SOQL Query Editor with tabbed results
import template from './query.html?raw';
import './query.css';
import { isAuthenticated } from '../../lib/utils.js';
import { createEditor, monaco } from '../../lib/monaco.js';
import { executeQueryWithColumns } from '../../lib/salesforce.js';

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

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.initEditor();
        this.attachEventListeners();
    }

    initElements() {
        this.tabsContainer = this.querySelector('.query-tabs');
        this.resultsContainer = this.querySelector('.query-results');
        this.executeBtn = this.querySelector('.query-execute-btn');
        this.statusSpan = this.querySelector('.query-status');
    }

    initEditor() {
        const editorContainer = this.querySelector('.query-editor');
        this.editor = createEditor(editorContainer, {
            language: 'sql',
            value: `SELECT
    Id,
    Name
FROM Account
LIMIT 10`
        });
    }

    attachEventListeners() {
        this.executeBtn.addEventListener('click', () => this.executeQuery());
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            this.executeQuery();
        });
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
            alert('Not authenticated. Please authorize via the extension popup first.');
            return;
        }

        const normalizedQuery = this.normalizeQuery(query);

        const existingTab = this.queryTabs.get(normalizedQuery);
        if (existingTab) {
            this.switchToTab(existingTab.id);
            await this.refreshTab(existingTab.id);
            return;
        }

        const tabId = this.createTab(query, normalizedQuery);
        this.switchToTab(tabId);
        await this.fetchQueryData(tabId);
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
