// Query Tab Module - SOQL Query Editor with tabbed results
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

// State management for query tabs
const queryTabs = new Map(); // normalizedQuery -> { id, query, normalizedQuery, records, columns, ... }
let activeTabId = null;
let tabCounter = 0;

// DOM element references
let queryInput = null;
let tabsContainer = null;
let resultsContainer = null;
let executeBtn = null;
let statusSpan = null;

export function init() {
    queryInput = document.getElementById('query-input');
    tabsContainer = document.getElementById('query-tabs');
    resultsContainer = document.getElementById('query-results');
    executeBtn = document.getElementById('query-execute-btn');
    statusSpan = document.getElementById('query-status');

    // Execute button click
    executeBtn.addEventListener('click', executeQuery);

    // Ctrl/Cmd+Enter to execute
    queryInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
        }
    });
}

// Simple query normalization for tab deduplication
function normalizeQuery(query) {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Flatten column metadata from the columns=true API response
// Handles nested joinColumns recursively for relationship fields
function flattenColumnMetadata(columnMetadata, prefix = '') {
    const columns = [];

    for (const col of columnMetadata) {
        const columnName = col.columnName;
        const path = prefix ? `${prefix}.${columnName}` : columnName;

        if (col.joinColumns && col.joinColumns.length > 0) {
            // Relationship field - recurse into joinColumns
            columns.push(...flattenColumnMetadata(col.joinColumns, path));
        } else {
            // Use full path as title for nested fields, displayName for top-level
            // This shows "Account.Name" instead of just "Name" for relationship fields
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

// Fallback: extract columns from record keys when column metadata unavailable
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

// Execute the current query
async function executeQuery() {
    const query = queryInput.value.trim();

    if (!query) {
        alert('Please enter a SOQL query.');
        return;
    }

    if (!isAuthenticated()) {
        alert('Not authenticated. Please authorize via the extension popup first.');
        return;
    }

    const normalizedQuery = normalizeQuery(query);

    // Check if this query already has a tab (using normalized form)
    const existingTab = queryTabs.get(normalizedQuery);
    if (existingTab) {
        // Switch to existing tab and refresh
        switchToTab(existingTab.id);
        await refreshTab(existingTab.id);
        return;
    }

    // Create a new tab for this query
    const tabId = createTab(query, normalizedQuery);
    switchToTab(tabId);
    await fetchQueryData(tabId);
}

// Create a new tab
function createTab(query, normalizedQuery) {
    const tabId = `query-tab-${++tabCounter}`;
    const tabData = {
        id: tabId,
        query: query,
        normalizedQuery: normalizedQuery,
        objectName: null, // Will be set from column metadata
        records: [],
        columns: [],
        totalSize: 0
    };

    queryTabs.set(normalizedQuery, tabData);
    renderTabs();
    return tabId;
}

// Switch to a specific tab
function switchToTab(tabId) {
    activeTabId = tabId;
    renderTabs();
    renderResults();
}

// Refresh data for a specific tab
async function refreshTab(tabId) {
    const tabData = getTabDataById(tabId);
    if (tabData) {
        await fetchQueryData(tabId);
    }
}

// Get tab data by ID
function getTabDataById(tabId) {
    for (const tab of queryTabs.values()) {
        if (tab.id === tabId) {
            return tab;
        }
    }
    return null;
}

// Close a tab
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

        // If closing active tab, switch to another or clear
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

// Fetch query data from Salesforce
async function fetchQueryData(tabId) {
    const tabData = getTabDataById(tabId);
    if (!tabData) return;

    updateStatus('Loading...', 'loading');
    tabData.error = null;

    try {
        const encodedQuery = encodeURIComponent(tabData.query);
        const baseUrl = `${getInstanceUrl()}/services/data/v62.0/query/?q=${encodedQuery}`;
        const headers = {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Accept': 'application/json'
        };

        // Make both calls in parallel for better performance
        const [columnsResponse, dataResponse] = await Promise.all([
            extensionFetch(`${baseUrl}&columns=true`, { method: 'GET', headers }),
            extensionFetch(baseUrl, { method: 'GET', headers })
        ]);

        // Process column metadata
        if (columnsResponse.success) {
            const columnData = JSON.parse(columnsResponse.data);
            tabData.objectName = columnData.entityName || null;
            tabData.columns = flattenColumnMetadata(columnData.columnMetadata || []);
            // Re-render tabs in case objectName changed
            renderTabs();
        } else {
            // Column metadata failed - will fall back to record keys
            tabData.columns = [];
        }

        // Process query results
        if (dataResponse.success) {
            const data = JSON.parse(dataResponse.data);
            tabData.records = data.records || [];
            tabData.totalSize = data.totalSize || 0;

            // If columns weren't set from metadata, extract from records
            if (tabData.columns.length === 0 && tabData.records.length > 0) {
                tabData.columns = extractColumnsFromRecord(tabData.records[0]);
            }

            updateStatus(`${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`, 'success');
        } else {
            let errorMsg = 'Query failed';
            try {
                const errorData = JSON.parse(dataResponse.data);
                if (Array.isArray(errorData) && errorData[0]?.message) {
                    errorMsg = errorData[0].message;
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {
                errorMsg = dataResponse.data || dataResponse.statusText || 'Unknown error';
            }
            tabData.records = [];
            tabData.columns = [];
            tabData.error = errorMsg;
            updateStatus('Error', 'error');
        }
    } catch (error) {
        tabData.records = [];
        tabData.columns = [];
        tabData.error = error.message;
        updateStatus('Error', 'error');
        console.error('Query error:', error);
    }

    renderResults();
}

// Get value from record using path (handles nested objects like Account.Name)
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

// Update status badge
function updateStatus(status, type = '') {
    statusSpan.textContent = status;
    statusSpan.className = 'status-badge';
    if (type) {
        statusSpan.classList.add(`status-${type}`);
    }
}

// Render the tabs bar
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

        // Tab label - use object name if available, otherwise truncated query
        const label = document.createElement('span');
        label.className = 'query-tab-label';
        label.textContent = getTabLabel(tab);
        label.title = tab.query;
        label.addEventListener('click', () => switchToTab(tab.id));

        // Refresh button
        const refreshBtn = document.createElement('button');
        refreshBtn.className = 'query-tab-refresh';
        refreshBtn.innerHTML = '&#x21bb;'; // ↻
        refreshBtn.title = 'Refresh';
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            refreshTab(tab.id);
        });

        // Close button
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

// Get label for tab (object name or truncated query)
function getTabLabel(tab) {
    if (tab.objectName) {
        return tab.objectName;
    }

    // Fallback to truncated query
    const maxLength = 30;
    if (tab.query.length <= maxLength) return tab.query;
    return tab.query.substring(0, maxLength) + '...';
}

// Render results table for active tab
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

    // Build table
    const table = document.createElement('table');
    table.className = 'query-results-table';

    // Header row
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const col of tabData.columns) {
        const th = document.createElement('th');
        th.textContent = col.title;
        headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Data rows
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

// Format cell value for display
function formatCellValue(value, col) {
    if (value === null || value === undefined) {
        return '';
    }

    // Handle subquery results (arrays of records)
    if (col?.isSubquery && typeof value === 'object') {
        if (value.records) {
            return `[${value.totalSize || value.records.length} records]`;
        }
        if (Array.isArray(value)) {
            return `[${value.length} records]`;
        }
    }

    if (typeof value === 'object') {
        // Handle nested relationship objects - show relevant field or stringify
        if (value.Name !== undefined) return value.Name;
        if (value.Id !== undefined) return value.Id;
        return JSON.stringify(value);
    }

    return String(value);
}

// Escape HTML for safe rendering
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
