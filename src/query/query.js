// Query Tab Module - SOQL Query Editor with tabbed results - UI Controller
import { isAuthenticated } from '../lib/utils.js';
import { createEditor, monaco } from '../lib/monaco.js';
import { executeQueryWithColumns } from '../lib/salesforce.js';

// ============================================================
// State Management
// ============================================================

const queryTabs = new Map(); // normalizedQuery -> { id, query, normalizedQuery, records, columns, ... }
let activeTabId = null;
let tabCounter = 0;

// DOM element references
let queryEditor = null;
let tabsContainer = null;
let resultsContainer = null;
let executeBtn = null;
let statusSpan = null;

// ============================================================
// Initialization
// ============================================================

export function init() {
    const editorContainer = document.getElementById('query-editor');
    tabsContainer = document.getElementById('query-tabs');
    resultsContainer = document.getElementById('query-results');
    executeBtn = document.getElementById('query-execute-btn');
    statusSpan = document.getElementById('query-status');

    queryEditor = createEditor(editorContainer, {
        language: 'sql',
        value: `SELECT
    Id,
    Name
FROM Account
LIMIT 10`
    });

    executeBtn.addEventListener('click', executeQuery);

    queryEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        executeQuery();
    });
}

// ============================================================
// Data Transformations
// ============================================================

function normalizeQuery(query) {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

function flattenColumnMetadata(columnMetadata, prefix = '') {
    const columns = [];

    for (const col of columnMetadata) {
        const columnName = col.columnName;
        const path = prefix ? `${prefix}.${columnName}` : columnName;

        if (col.joinColumns && col.joinColumns.length > 0) {
            columns.push(...flattenColumnMetadata(col.joinColumns, path));
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

function extractColumnsFromRecord(record) {
    return Object.keys(record)
        .filter(key => key !== 'attributes')
        .map(key => ({
            title: key,
            path: key,
            aggregate: false,
            isSubquery: false
        }));
}

function getValueByPath(record, path) {
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

async function executeQuery() {
    const query = queryEditor.getValue().trim();

    if (!query) {
        alert('Please enter a SOQL query.');
        return;
    }

    if (!isAuthenticated()) {
        alert('Not authenticated. Please authorize via the extension popup first.');
        return;
    }

    const normalizedQuery = normalizeQuery(query);

    const existingTab = queryTabs.get(normalizedQuery);
    if (existingTab) {
        switchToTab(existingTab.id);
        await refreshTab(existingTab.id);
        return;
    }

    const tabId = createTab(query, normalizedQuery);
    switchToTab(tabId);
    await fetchQueryData(tabId);
}

async function fetchQueryData(tabId) {
    const tabData = getTabDataById(tabId);
    if (!tabData) return;

    updateStatus('Loading...', 'loading');
    tabData.error = null;

    try {
        const result = await executeQueryWithColumns(tabData.query);

        tabData.records = result.records;
        tabData.totalSize = result.totalSize;
        tabData.objectName = result.entityName;

        if (result.columnMetadata.length > 0) {
            tabData.columns = flattenColumnMetadata(result.columnMetadata);
        } else if (tabData.records.length > 0) {
            tabData.columns = extractColumnsFromRecord(tabData.records[0]);
        } else {
            tabData.columns = [];
        }

        updateStatus(`${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`, 'success');
        renderTabs();

    } catch (error) {
        tabData.records = [];
        tabData.columns = [];
        tabData.error = error.message;
        updateStatus('Error', 'error');
        console.error('Query error:', error);
    }

    renderResults();
}

// ============================================================
// Tab Management
// ============================================================

function createTab(query, normalizedQuery) {
    const tabId = `query-tab-${++tabCounter}`;
    const tabData = {
        id: tabId,
        query: query,
        normalizedQuery: normalizedQuery,
        objectName: null,
        records: [],
        columns: [],
        totalSize: 0
    };

    queryTabs.set(normalizedQuery, tabData);
    renderTabs();
    return tabId;
}

function switchToTab(tabId) {
    activeTabId = tabId;
    renderTabs();
    renderResults();
}

async function refreshTab(tabId) {
    const tabData = getTabDataById(tabId);
    if (tabData) {
        await fetchQueryData(tabId);
    }
}

function getTabDataById(tabId) {
    for (const tab of queryTabs.values()) {
        if (tab.id === tabId) {
            return tab;
        }
    }
    return null;
}

function closeTab(tabId) {
    let keyToRemove = null;
    for (const [key, tab] of queryTabs) {
        if (tab.id === tabId) {
            keyToRemove = key;
            break;
        }
    }

    if (keyToRemove) {
        queryTabs.delete(keyToRemove);

        if (activeTabId === tabId) {
            const remaining = Array.from(queryTabs.values());
            if (remaining.length > 0) {
                switchToTab(remaining[remaining.length - 1].id);
            } else {
                activeTabId = null;
                renderTabs();
                renderResults();
            }
        } else {
            renderTabs();
        }
    }
}

function getTabLabel(tab) {
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

function updateStatus(status, type = '') {
    statusSpan.textContent = status;
    statusSpan.className = 'status-badge';
    if (type) {
        statusSpan.classList.add(`status-${type}`);
    }
}

function renderTabs() {
    tabsContainer.innerHTML = '';

    if (queryTabs.size === 0) {
        tabsContainer.innerHTML = '<div class="query-tabs-empty">Run a query to see results</div>';
        return;
    }

    for (const tab of queryTabs.values()) {
        const tabEl = document.createElement('div');
        tabEl.className = `query-tab${tab.id === activeTabId ? ' active' : ''}`;
        tabEl.dataset.tabId = tab.id;

        const label = document.createElement('span');
        label.className = 'query-tab-label';
        label.textContent = getTabLabel(tab);
        label.title = tab.query;
        label.addEventListener('click', () => switchToTab(tab.id));

        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'query-tab-refresh';
        refreshBtn.innerHTML = '&#x21bb;';
        refreshBtn.title = 'Refresh';
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshTab(tab.id);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'query-tab-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeTab(tab.id);
        });

        tabEl.appendChild(label);
        tabEl.appendChild(refreshBtn);
        tabEl.appendChild(closeBtn);
        tabsContainer.appendChild(tabEl);
    }
}

function renderResults() {
    if (!activeTabId) {
        resultsContainer.innerHTML = '<div class="query-results-empty">No query results to display</div>';
        return;
    }

    const tabData = getTabDataById(activeTabId);
    if (!tabData) {
        resultsContainer.innerHTML = '<div class="query-results-empty">No query results to display</div>';
        return;
    }

    if (tabData.error) {
        resultsContainer.innerHTML = `<div class="query-results-error">${escapeHtml(tabData.error)}</div>`;
        return;
    }

    if (tabData.records.length === 0) {
        resultsContainer.innerHTML = '<div class="query-results-empty">No records found</div>';
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
            const value = getValueByPath(record, col.path);
            td.textContent = formatCellValue(value, col);
            td.title = formatCellValue(value, col);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);

    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(table);
}

function formatCellValue(value, col) {
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

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
