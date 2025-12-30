// Query Tab Module - SOQL Query Editor with tabbed results
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';
import { parseQuery, composeQuery, isQueryValid } from '@jetstreamapp/soql-parser-js';

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

// Parse and analyze a SOQL query
function analyzeQuery(query) {
    try {
        const parsed = parseQuery(query);

        // Get normalized query string by re-composing
        const normalizedQuery = composeQuery(parsed, { format: false });

        // Extract columns from parsed fields
        const columns = extractColumnsFromParsed(parsed.fields || []);

        return {
            normalizedQuery,
            objectName: parsed.sObject || null,
            columns,
            error: null
        };
    } catch (e) {
        // If parsing fails, fall back to simple normalization
        console.warn('SOQL parse error:', e.message);
        return {
            normalizedQuery: query.toLowerCase().replace(/\s+/g, ' ').trim(),
            objectName: null,
            columns: [],
            error: e.message
        };
    }
}

// Extract column info from parsed fields
function extractColumnsFromParsed(fields) {
    const columns = [];
    let exprIndex = 0; // Salesforce uses expr0, expr1, etc. for unaliased aggregate functions

    for (const field of fields) {
        switch (field.type) {
            case 'Field':
                columns.push({
                    title: field.alias || field.field,
                    path: field.field
                });
                break;

            case 'FieldRelationship':
                // e.g., Account.Name -> relationships: ['Account'], field: 'Name'
                const fullPath = [...field.relationships, field.field].join('.');
                columns.push({
                    title: field.alias || fullPath,
                    path: fullPath
                });
                break;

            case 'FieldFunctionExpression':
                // e.g., COUNT(Id), SUM(Amount)
                // Salesforce returns unaliased aggregates as expr0, expr1, etc.
                // Only increment exprIndex when there's no alias
                let aggPath;
                if (field.alias) {
                    aggPath = field.alias;
                } else {
                    aggPath = `expr${exprIndex++}`;
                }
                columns.push({
                    title: field.alias || field.rawValue || field.functionName,
                    path: aggPath
                });
                break;

            case 'FieldSubquery':
                // Subqueries return nested arrays - skip for now in main columns
                columns.push({
                    title: field.subquery.relationshipName,
                    path: field.subquery.relationshipName,
                    isSubquery: true
                });
                break;

            case 'FieldTypeof':
                // TYPEOF expressions - use the field name
                columns.push({
                    title: field.field,
                    path: field.field
                });
                break;

            default:
                // Unknown field type, try to get something useful
                if (field.field) {
                    columns.push({
                        title: field.field,
                        path: field.field
                    });
                }
        }
    }

    return columns;
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

    // Analyze the query
    const analysis = analyzeQuery(query);

    // Check if this query already has a tab (using normalized form)
    const existingTab = queryTabs.get(analysis.normalizedQuery);
    if (existingTab) {
        // Switch to existing tab and refresh
        switchToTab(existingTab.id);
        await refreshTab(existingTab.id);
        return;
    }

    // Create a new tab for this query
    const tabId = createTab(query, analysis);
    switchToTab(tabId);
    await fetchQueryData(tabId);
}

// Create a new tab
function createTab(query, analysis) {
    const tabId = `query-tab-${++tabCounter}`;
    const tabData = {
        id: tabId,
        query: query,
        normalizedQuery: analysis.normalizedQuery,
        objectName: analysis.objectName,
        parsedColumns: analysis.columns,
        records: [],
        columns: [],
        totalSize: 0
    };

    queryTabs.set(analysis.normalizedQuery, tabData);
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
            tabData.columns = resolveColumns(tabData);

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

// Resolve columns - use parsed columns if available, otherwise extract from records
function resolveColumns(tabData) {
    const { records, parsedColumns } = tabData;

    // If no records, use parsed columns or empty
    if (!records || records.length === 0) {
        return parsedColumns && parsedColumns.length > 0 ? parsedColumns : [];
    }

    // Get actual keys from the first record (excluding 'attributes')
    const firstRecord = records[0];
    const recordKeys = Object.keys(firstRecord).filter(k => k !== 'attributes');
    const recordKeySet = new Set(recordKeys);

    // If we have parsed columns, validate they match the record structure
    if (parsedColumns && parsedColumns.length > 0) {
        // Check if parsed columns align with record keys
        // For nested paths like "Account.Name", check if the root exists
        const columnsValid = parsedColumns.every(col => {
            const rootKey = col.path.split('.')[0];
            return recordKeySet.has(rootKey) || recordKeySet.has(col.path);
        });

        if (columnsValid) {
            return parsedColumns;
        }

        // Parsed columns don't match paths - merge: use record keys for paths,
        // but try to get nice titles from parsed columns
        // Build a map from parsed paths to titles for lookup
        const pathToTitle = new Map();
        parsedColumns.forEach(col => {
            pathToTitle.set(col.path, col.title);
        });

        // Match record keys to parsed columns by position for expr fields
        // parsedColumns and recordKeys should be in the same order
        const columns = [];
        for (let i = 0; i < recordKeys.length; i++) {
            const key = recordKeys[i];
            let title = key;

            // Try to find a matching title from parsed columns
            if (pathToTitle.has(key)) {
                // Direct match (e.g., "Name" -> "Name")
                title = pathToTitle.get(key);
            } else if (key.startsWith('expr') && i < parsedColumns.length) {
                // For expr fields, use the title from the corresponding parsed column position
                // But we need to match by expr index, not array index
                const exprMatch = key.match(/^expr(\d+)$/);
                if (exprMatch) {
                    const exprIdx = parseInt(exprMatch[1], 10);
                    // Find the parsed column that would have been assigned this expr index
                    let funcCount = 0;
                    for (const pc of parsedColumns) {
                        if (pc.path.startsWith('expr')) {
                            if (funcCount === exprIdx) {
                                title = pc.title;
                                break;
                            }
                            funcCount++;
                        }
                    }
                }
            }

            columns.push({ title, path: key });
        }

        return columns;
    }

    // Fallback: extract keys from first record
    const columns = [];
    for (const key of recordKeys) {
        columns.push({ title: key, path: key });
    }

    return columns;
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
