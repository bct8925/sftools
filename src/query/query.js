// Query Tab Module - SOQL Query Editor with tabbed results
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';

// State management for query tabs
const queryTabs = new Map(); // queryString -> { id, query, records, columns }
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

    // Check if this query already has a tab
    const existingTab = findTabByQuery(query);
    if (existingTab) {
        // Switch to existing tab and refresh
        switchToTab(existingTab.id);
        await refreshTab(existingTab.id);
        return;
    }

    // Create a new tab for this query
    const tabId = createTab(query);
    switchToTab(tabId);
    await fetchQueryData(tabId);
}

// Find tab by query string
function findTabByQuery(query) {
    // TODO: Normalize query for comparison (lowercase, whitespace normalization, etc.)
    const normalizedQuery = query.toLowerCase().replace(/\s+/g, ' ').trim();
    for (const [key, tab] of queryTabs) {
        const normalizedKey = key.toLowerCase().replace(/\s+/g, ' ').trim();
        if (normalizedKey === normalizedQuery) {
            return tab;
        }
    }
    return null;
}

// Create a new tab
function createTab(query) {
    const tabId = `query-tab-${++tabCounter}`;
    const tabData = {
        id: tabId,
        query: query,
        records: [],
        columns: [],
        totalSize: 0
    };

    queryTabs.set(query, tabData);
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
    let queryToRemove = null;
    for (const [query, tab] of queryTabs) {
        if (tab.id === tabId) {
            queryToRemove = query;
            break;
        }
    }

    if (queryToRemove) {
        queryTabs.delete(queryToRemove);

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

    try {
        const encodedQuery = encodeURIComponent(tabData.query);
        const url = `${getInstanceUrl()}/services/data/v62.0/query/?q=${encodedQuery}`;

        const response = await extensionFetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getAccessToken()}`,
                'Accept': 'application/json'
            }
        });

        if (response.success) {
            const data = JSON.parse(response.data);
            tabData.records = data.records || [];
            tabData.totalSize = data.totalSize || 0;
            tabData.columns = extractColumns(tabData.records);

            updateStatus(`${tabData.totalSize} record${tabData.totalSize !== 1 ? 's' : ''}`, 'success');
        } else {
            let errorMsg = 'Query failed';
            try {
                const errorData = JSON.parse(response.data);
                if (Array.isArray(errorData) && errorData[0]?.message) {
                    errorMsg = errorData[0].message;
                } else if (errorData.message) {
                    errorMsg = errorData.message;
                }
            } catch (e) {
                errorMsg = response.data || response.statusText || 'Unknown error';
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

// Extract column names from records
function extractColumns(records) {
    if (!records || records.length === 0) return [];

    // TODO: Parse query to get column order from SELECT clause
    // TODO: Handle nested relationships (e.g., Account.Name)
    // For now, just extract keys from first record, excluding 'attributes'
    const columns = [];
    const firstRecord = records[0];

    for (const key of Object.keys(firstRecord)) {
        if (key !== 'attributes') {
            columns.push(key);
        }
    }

    return columns;
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

        // Tab label - truncated query
        const label = document.createElement('span');
        label.className = 'query-tab-label';
        label.textContent = truncateQuery(tab.query);
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

// Truncate query for tab label
function truncateQuery(query) {
    // TODO: Extract object name from query for smarter labeling
    const maxLength = 30;
    if (query.length <= maxLength) return query;
    return query.substring(0, maxLength) + '...';
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
        th.textContent = col;
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
            const value = record[col];
            td.textContent = formatCellValue(value);
            td.title = formatCellValue(value);
            row.appendChild(td);
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);

    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(table);
}

// Format cell value for display
function formatCellValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        // TODO: Handle relationship fields (nested objects) better
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
