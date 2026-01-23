# Lib - sftools Utilities

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

The `lib/` directory contains shared utility functions used by all components. Functions are organized by domain and re-exported through `utils.js` for convenience.

## Directory Structure

```
lib/
├── auth.js               # Multi-connection storage and state
├── salesforce.js         # Salesforce API operations
├── salesforce-request.js # Authenticated REST wrapper
├── fetch.js              # Smart fetch routing (proxy vs extension)
├── query-utils.js        # SOQL parsing and result formatting
├── apex-utils.js         # Apex execution helpers
├── record-utils.js       # Record field manipulation
├── schema-utils.js       # Object metadata helpers
├── rest-api-utils.js     # REST API request building
├── settings-utils.js     # Settings storage
├── events-utils.js       # Event subscription helpers
├── history-manager.js    # Query/Apex history & favorites
├── soql-autocomplete.js  # SOQL editor autocomplete
├── theme.js              # Dark/light mode management
├── background-utils.js   # Service worker helpers
├── ui-helpers.js         # DOM utilities
├── icons.js              # Icon mapping
└── utils.js              # Central re-export point
```

## Module Organization

### utils.js - Central Exports

Import commonly used functions from `utils.js`:

```javascript
import {
    // Auth
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    loadConnections,
    setActiveConnection,
    getActiveConnectionId,
    addConnection,
    updateConnection,
    removeConnection,

    // OAuth
    getOAuthCredentials,
    setPendingAuth,
    consumePendingAuth,

    // Fetch
    extensionFetch,
    smartFetch,

    // Proxy
    isProxyConnected
} from '../../lib/utils.js';
```

### Direct Imports

For domain-specific functions, import directly:

```javascript
// Salesforce API operations
import { executeQuery, getObjectDescribe, getRecord } from '../../lib/salesforce.js';

// Request wrapper
import { salesforceRequest } from '../../lib/salesforce-request.js';

// Theme
import { initTheme, getTheme, setTheme } from '../../lib/theme.js';

// History
import { HistoryManager } from '../../lib/history-manager.js';
```

## Key Modules

### auth.js - Multi-Connection Storage

Manages multiple Salesforce connections with per-instance active connection.

```javascript
// Connection storage schema
{
  connections: [{
    id: string,          // UUID
    label: string,       // User-editable label
    instanceUrl: string, // https://org.my.salesforce.com
    loginDomain: string, // login.salesforce.com or test.salesforce.com
    accessToken: string,
    refreshToken: string | null,
    clientId: string | null,  // Per-connection OAuth Client ID
    createdAt: number,
    lastUsedAt: number
  }]
}
```

#### Functions

```javascript
// Current connection
getAccessToken()         // Returns active connection's token
getInstanceUrl()         // Returns active connection's instance URL
isAuthenticated()        // Returns true if active connection exists
getActiveConnectionId()  // Returns active connection's ID

// Connection management
await loadConnections()                    // Load all connections from storage
await setActiveConnection(connection)      // Set active connection for this instance
await addConnection(connection)            // Add new connection
await updateConnection(id, updates)        // Update existing connection
await removeConnection(id)                 // Remove connection
findConnectionByDomain(hostname)           // Find connection by hostname

// OAuth helpers
await getOAuthCredentials(connectionId?)   // Get client ID for connection
await setPendingAuth(params)               // Store pending auth flow state
await consumePendingAuth()                 // Retrieve and clear pending auth
```

### salesforce-request.js - Request Wrapper

The primary API for making Salesforce REST calls with automatic auth and error handling.

```javascript
import { salesforceRequest } from '../../lib/salesforce-request.js';

// GET request with query params
const result = await salesforceRequest('/services/data/v62.0/query', {
    method: 'GET',
    params: { q: 'SELECT Id FROM Account' }
});

// POST request with body
await salesforceRequest('/services/data/v62.0/sobjects/Account', {
    method: 'POST',
    body: JSON.stringify({ Name: 'New Account' })
});

// PATCH request
await salesforceRequest(`/services/data/v62.0/sobjects/Account/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ Name: 'Updated Name' })
});

// DELETE request
await salesforceRequest(`/services/data/v62.0/sobjects/Account/${id}`, {
    method: 'DELETE'
});
```

#### Features

- Automatic auth header injection
- Smart routing (proxy when connected, extension fetch otherwise)
- Error response parsing
- Connection ID for 401 retry

### fetch.js - Fetch Routing

Routes requests through proxy when available, otherwise uses extension fetch.

```javascript
import { smartFetch, extensionFetch, isProxyConnected } from '../../lib/utils.js';

// Automatic routing - use this for Salesforce requests
const response = await smartFetch(url, options);

// Force extension fetch (bypasses proxy)
const response = await extensionFetch(url, options);

// Check proxy status
if (isProxyConnected()) {
    // Proxy features available
}
```

### salesforce.js - API Operations

Higher-level Salesforce operations built on `salesforceRequest`.

```javascript
import {
    // Query
    executeQuery,
    executeQueryWithColumns,

    // Describe
    getGlobalDescribe,
    getObjectDescribe,

    // Records
    getRecord,
    updateRecord,
    createRecord,
    deleteRecord,

    // Apex
    executeApex,
    getDebugLog,

    // Tooling API
    enableTraceFlagForUser,
    deleteAllDebugLogs,
    searchUsers,
    searchFlows,
    getFlowVersions,
    deleteInactiveFlowVersions,

    // Schema
    getFormulaFieldMetadata,
    updateFormulaField
} from '../../lib/salesforce.js';
```

#### Common Operations

```javascript
// Execute SOQL
const result = await executeQuery('SELECT Id, Name FROM Account LIMIT 10');
console.log(result.records);

// Get object metadata
const describe = await getObjectDescribe('Account');
console.log(describe.fields);

// Get record
const account = await getRecord('Account', '001xxxxxxxxxxxx');

// Update record
await updateRecord('Account', '001xxxxxxxxxxxx', {
    Name: 'New Name',
    Industry: 'Technology'
});

// Execute anonymous Apex
const result = await executeApex('System.debug(\'Hello\');');
if (result.success) {
    const log = await getDebugLog(result.logId);
}
```

### query-utils.js - Query Utilities

SOQL parsing and result formatting.

```javascript
import {
    parseQueryResults,
    flattenColumns,
    extractSubqueryColumns,
    formatCellValue
} from '../../lib/query-utils.js';

// Parse query response with columns
const { columns, rows } = parseQueryResults(response, columnMetadata);

// Flatten nested relationship columns
const flatColumns = flattenColumns(columnMetadata);
// ['Id', 'Name', 'Account.Name', 'Account.Owner.Name']

// Format value for display
const formatted = formatCellValue(value, fieldType);
```

### theme.js - Theme Management

Dark/light mode with system preference support.

```javascript
import { initTheme, getTheme, setTheme, onThemeChange } from '../../lib/theme.js';

// Initialize theme (call in page entry points)
initTheme();

// Get current theme
const theme = getTheme(); // 'light', 'dark', or 'system'

// Set theme
await setTheme('dark');

// Listen for changes
onThemeChange((theme, isDark) => {
    console.log(`Theme changed to ${theme}, isDark: ${isDark}`);
});
```

### history-manager.js - History & Favorites

Manages query and apex history with favorites.

```javascript
import { HistoryManager } from '../../lib/history-manager.js';

// Create manager for a specific type
const history = new HistoryManager('query'); // or 'apex'

// Add entry
await history.addEntry({
    content: 'SELECT Id FROM Account',
    label: 'All Accounts' // Optional
});

// Get recent entries
const entries = await history.getHistory(10); // limit

// Favorites
await history.addFavorite({ content: '...', label: 'My Query' });
await history.removeFavorite(entryId);
const favorites = await history.getFavorites();

// Search
const results = await history.search('account');
```

## Adding New Utilities

### 1. Create the Module

```javascript
// src/lib/my-utils.js

/**
 * Description of what this module does.
 */

import { salesforceRequest } from './salesforce-request.js';

/**
 * Describes what the function does.
 * @param {string} param - Description
 * @returns {Promise<Object>} Description
 */
export async function myFunction(param) {
    if (!param) {
        throw new Error('param is required');
    }

    const result = await salesforceRequest('/services/data/v62.0/endpoint', {
        method: 'GET',
        params: { key: param }
    });

    return result;
}

/**
 * Pure utility function (no API calls).
 * @param {Object} data - Input data
 * @returns {Object} Transformed data
 */
export function transformData(data) {
    return {
        ...data,
        transformed: true
    };
}
```

### 2. Add Unit Tests

```javascript
// tests/unit/lib/my-utils.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';
import { myFunction, transformData } from '../../../src/lib/my-utils.js';

describe('myFunction', () => {
    beforeEach(() => {
        chromeMock._reset();
    });

    it('returns expected result', async () => {
        chromeMock._setStorageData({
            connections: [{ id: '1', accessToken: 'token', instanceUrl: 'https://test.my.salesforce.com' }]
        });

        // Mock fetch response
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: 'result' })
        });

        const result = await myFunction('test');
        expect(result.data).toBe('result');
    });

    it('throws on missing param', () => {
        expect(() => myFunction()).toThrow('param is required');
    });
});

describe('transformData', () => {
    it('adds transformed flag', () => {
        const result = transformData({ key: 'value' });
        expect(result).toEqual({
            key: 'value',
            transformed: true
        });
    });
});
```

### 3. Export from utils.js (if commonly used)

```javascript
// src/lib/utils.js

// Add re-export
export { myFunction, transformData } from './my-utils.js';
```

## Best Practices

### Error Handling

```javascript
export async function myApiFunction(param) {
    try {
        return await salesforceRequest('/path', { method: 'GET' });
    } catch (error) {
        // salesforceRequest already parses errors
        // Re-throw with context if needed
        throw new Error(`Failed to fetch: ${error.message}`);
    }
}
```

### Pure Functions

Prefer pure functions when possible for easier testing:

```javascript
// GOOD - pure function, easily testable
export function parseResponse(response) {
    return response.records.map(r => ({
        id: r.Id,
        name: r.Name
    }));
}

// Then use in component
const data = parseResponse(await salesforceRequest(...));
```

### Input Validation

Validate inputs early:

```javascript
export function processRecords(records) {
    if (!Array.isArray(records)) {
        throw new TypeError('records must be an array');
    }
    if (records.length === 0) {
        return [];
    }
    // Process...
}
```

### JSDoc Comments

Document public functions:

```javascript
/**
 * Fetches and parses object describe metadata.
 * @param {string} objectType - Salesforce object API name
 * @returns {Promise<{name: string, fields: Array}>} Object describe result
 * @throws {Error} If object doesn't exist or API fails
 */
export async function getObjectDescribe(objectType) {
    // ...
}
```

## File-by-File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `auth.js` | Connection management | `getAccessToken`, `loadConnections`, `setActiveConnection` |
| `salesforce.js` | API operations | `executeQuery`, `getObjectDescribe`, `executeApex` |
| `salesforce-request.js` | REST wrapper | `salesforceRequest` |
| `fetch.js` | Fetch routing | `smartFetch`, `extensionFetch` |
| `query-utils.js` | Query parsing | `parseQueryResults`, `flattenColumns` |
| `apex-utils.js` | Apex helpers | `parseCompileError`, `formatDebugLog` |
| `record-utils.js` | Record helpers | `sortFields`, `getFieldValue` |
| `schema-utils.js` | Schema helpers | `formatFieldType`, `isFormulaField` |
| `rest-api-utils.js` | REST helpers | `buildRequestUrl`, `parseResponse` |
| `settings-utils.js` | Settings | `getSettings`, `updateSettings` |
| `events-utils.js` | Events | `parseChannel`, `formatEvent` |
| `history-manager.js` | History | `HistoryManager` class |
| `soql-autocomplete.js` | Autocomplete | `SoqlAutocomplete` class |
| `theme.js` | Theming | `initTheme`, `setTheme`, `getTheme` |
| `background-utils.js` | Background | `sendToBackground`, `parseResponse` |
| `ui-helpers.js` | DOM utils | `createElement`, `formatDate` |
| `icons.js` | Icons | `getIconSvg` |
| `utils.js` | Re-exports | All common functions |
