# Lib - sftools TypeScript Utilities

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

The `lib/` directory contains shared TypeScript utility functions used by all components. Functions are organized by domain and provide type-safe interfaces for Chrome storage, Salesforce API calls, and UI helpers.

## Directory Structure

```
lib/
├── auth.ts               # Multi-connection storage and state
├── salesforce.ts         # Salesforce API operations
├── salesforce-request.ts # Authenticated REST wrapper
├── fetch.ts              # Smart fetch routing (proxy vs extension)
├── query-utils.ts        # SOQL parsing and result formatting
├── apex-utils.ts         # Apex execution helpers
├── record-utils.ts       # Record field manipulation
├── schema-utils.ts       # Object metadata helpers
├── rest-api-utils.ts     # REST API request building
├── settings-utils.ts     # Settings storage
├── events-utils.ts       # Event subscription helpers
├── history-manager.ts    # Query/Apex history & favorites
├── soql-autocomplete.ts  # SOQL editor autocomplete
├── theme.ts              # Dark/light mode management
├── background-utils.ts   # Service worker helpers
├── ui-helpers.ts         # DOM utilities
├── icons.ts              # Icon mapping
├── text-utils.ts         # Text formatting
├── debug.ts              # Debug utilities
├── oauth-credentials.ts  # OAuth client configuration
├── cors-detection.ts     # CORS error detection
└── utils.ts              # Central re-export point (deprecated - import directly)
```

## TypeScript Patterns

All lib files use TypeScript with strict mode. Import types from `src/types/salesforce.d.ts`:

```typescript
import type {
  SalesforceConnection,
  QueryResult,
  SObject,
  FieldDescribe,
  SObjectDescribe,
  ColumnMetadata,
} from '../types/salesforce';
```

## Key Modules

### auth.ts - Multi-Connection Storage

Manages multiple Salesforce connections with per-instance active connection.

```typescript
import {
  loadConnections,
  setActiveConnection,
  addConnection,
  updateConnection,
  removeConnection,
  getAccessToken,
  getInstanceUrl,
  isAuthenticated,
  getActiveConnectionId,
  type ConnectionData,
} from '../lib/auth';
```

#### Connection Storage Schema

```typescript
interface SalesforceConnection {
  id: string;              // UUID
  label: string;           // User-editable label
  instanceUrl: string;     // https://org.my.salesforce.com
  loginDomain?: string;    // login.salesforce.com or test.salesforce.com
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null; // Per-connection OAuth Client ID
  createdAt?: number;
  lastUsedAt?: number;
}
```

#### Functions

```typescript
// Current connection - synchronous getters (use cached state)
getAccessToken(): string | null
getInstanceUrl(): string | null
isAuthenticated(): boolean
getActiveConnectionId(): string | null

// Connection management - async operations
loadConnections(): Promise<SalesforceConnection[]>
setActiveConnection(connection: SalesforceConnection | null): void
addConnection(data: ConnectionData): Promise<SalesforceConnection>
updateConnection(id: string, updates: Partial<SalesforceConnection>): Promise<void>
removeConnection(id: string): Promise<void>
findConnectionByDomain(hostname: string): SalesforceConnection | undefined

// OAuth helpers
getOAuthCredentials(connectionId?: string): Promise<OAuthCredentials>
setPendingAuth(params: PendingAuthParams): Promise<void>
consumePendingAuth(): Promise<PendingAuthParams | null>
```

### salesforce-request.ts - Request Wrapper

The primary API for making Salesforce REST calls with automatic auth and error handling.

```typescript
import { salesforceRequest } from '../lib/salesforce-request';

interface SalesforceRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  params?: Record<string, string>;
  body?: string;
  headers?: Record<string, string>;
}

// GET request with query params
const result = await salesforceRequest<QueryResult>('/services/data/v62.0/query', {
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
- Error response parsing with typed errors
- Generic return types for type safety

### fetch.ts - Fetch Routing

Routes requests through proxy when available, otherwise uses extension fetch.

```typescript
import {
  smartFetch,
  extensionFetch,
  isProxyConnected,
  checkProxyStatus,
} from '../lib/fetch';

// Automatic routing - use this for Salesforce requests
const response = await smartFetch(url, options);

// Force extension fetch (bypasses proxy)
const response = await extensionFetch(url, options);

// Check proxy status
if (isProxyConnected()) {
  // Proxy features available (streaming, etc.)
}

// Async check (pings proxy)
const connected = await checkProxyStatus();
```

### salesforce.ts - API Operations

Higher-level Salesforce operations built on `salesforceRequest`.

```typescript
import {
  // Query
  executeQuery,
  executeQueryWithColumns,
  executeBulkQueryExport,

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
  updateFormulaField,
} from '../lib/salesforce';
```

#### Function Signatures

```typescript
// Query
executeQuery(soql: string, useToolingApi?: boolean): Promise<QueryResult>
executeQueryWithColumns(soql: string, useToolingApi?: boolean): Promise<QueryResultWithColumns>
executeBulkQueryExport(soql: string, onProgress?: (state: string, count: number) => void): Promise<string>

// Describe
getGlobalDescribe(): Promise<DescribeGlobalResult>
getObjectDescribe(objectType: string): Promise<SObjectDescribe>

// Records
getRecord<T extends SObject>(objectType: string, recordId: string, fields?: string[]): Promise<T>
updateRecord(objectType: string, recordId: string, data: Record<string, unknown>): Promise<void>
createRecord(objectType: string, data: Record<string, unknown>): Promise<string>
deleteRecord(objectType: string, recordId: string): Promise<void>

// Apex
executeApex(code: string): Promise<ApexExecutionResult>
getDebugLog(logId: string): Promise<string>
```

#### Common Operations

```typescript
// Execute SOQL with type safety
const result = await executeQuery<{ Id: string; Name: string }>(
  'SELECT Id, Name FROM Account LIMIT 10'
);
result.records.forEach(r => console.log(r.Name));

// Get object metadata
const describe = await getObjectDescribe('Account');
describe.fields.forEach(f => console.log(f.name, f.type));

// Get record with specific fields
const account = await getRecord('Account', '001xxxxxxxxxxxx', ['Name', 'Industry']);

// Update record
await updateRecord('Account', '001xxxxxxxxxxxx', {
  Name: 'New Name',
  Industry: 'Technology'
});

// Execute anonymous Apex
const result = await executeApex('System.debug(\'Hello\');');
if (result.success && result.logId) {
  const log = await getDebugLog(result.logId);
}
```

### query-utils.ts - Query Utilities

SOQL parsing and result formatting.

```typescript
import {
  parseQueryResults,
  flattenColumnMetadata,
  extractSubqueryColumns,
  formatCellValue,
  normalizeQuery,
  type QueryColumn,
} from '../lib/query-utils';

// Parse query response with columns
const { columns, rows } = parseQueryResults(response, columnMetadata);

// Flatten nested relationship columns
const flatColumns = flattenColumnMetadata(columnMetadata);
// Returns: ['Id', 'Name', 'Account.Name', 'Account.Owner.Name']

// Format value for display
const formatted = formatCellValue(value, fieldType);

// Normalize query for comparison (removes whitespace)
const normalized = normalizeQuery(query);
```

### theme.ts - Theme Management

Dark/light mode with system preference support.

```typescript
import {
  initTheme,
  getTheme,
  setTheme,
  onThemeChange,
  type ThemeValue,
} from '../lib/theme';

type ThemeValue = 'light' | 'dark' | 'system';

// Initialize theme (call in page entry points)
await initTheme();

// Get current theme
const theme = getTheme(); // 'light', 'dark', or 'system'

// Set theme
await setTheme('dark');

// Listen for changes
onThemeChange((theme: ThemeValue, isDark: boolean) => {
  console.log(`Theme changed to ${theme}, isDark: ${isDark}`);
});
```

### history-manager.ts - History & Favorites

Manages query and apex history with favorites.

```typescript
import { HistoryManager, type HistoryEntry } from '../lib/history-manager';

interface HistoryEntry {
  id: string;
  content: string;
  label?: string;
  timestamp: number;
  isFavorite: boolean;
}

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

### soql-autocomplete.ts - SOQL Autocomplete

Provides autocomplete suggestions for SOQL queries in Monaco editor.

```typescript
import { SoqlAutocomplete } from '../lib/soql-autocomplete';

// Create instance (typically one per editor)
const autocomplete = new SoqlAutocomplete();

// Get suggestions based on position
const suggestions = await autocomplete.getSuggestions(
  'SELECT Id FROM Acc',
  { lineNumber: 1, column: 18 }
);

// Clear cached metadata (on connection change)
autocomplete.clearCache();
```

## Adding New Utilities

### 1. Create the TypeScript Module

```typescript
// src/lib/my-utils.ts

import { salesforceRequest } from './salesforce-request';
import type { SObject } from '../types/salesforce';

/**
 * Interface for the function result
 */
export interface MyResult {
  data: string;
  success: boolean;
}

/**
 * Describes what the function does.
 * @param param - Description of parameter
 * @returns Promise resolving to MyResult
 * @throws Error if param is invalid
 */
export async function myFunction(param: string): Promise<MyResult> {
  if (!param) {
    throw new Error('param is required');
  }

  const result = await salesforceRequest<{ data: string }>(
    '/services/data/v62.0/endpoint',
    {
      method: 'GET',
      params: { key: param }
    }
  );

  return {
    data: result.data,
    success: true
  };
}

/**
 * Pure utility function (no API calls).
 * @param data - Input data object
 * @returns Transformed data
 */
export function transformData<T extends SObject>(data: T): T & { transformed: true } {
  return {
    ...data,
    transformed: true as const
  };
}
```

### 2. Add Unit Tests

```typescript
// tests/unit/lib/my-utils.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome';
import { myFunction, transformData } from '../../../src/lib/my-utils';

describe('myFunction', () => {
  beforeEach(() => {
    chromeMock._reset();
  });

  it('returns expected result', async () => {
    chromeMock._setStorageData({
      connections: [{
        id: '1',
        accessToken: 'token',
        instanceUrl: 'https://test.my.salesforce.com'
      }]
    });

    // Mock fetch response
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'result' })
    });

    const result = await myFunction('test');
    expect(result.data).toBe('result');
    expect(result.success).toBe(true);
  });

  it('throws on missing param', async () => {
    await expect(myFunction('')).rejects.toThrow('param is required');
  });
});

describe('transformData', () => {
  it('adds transformed flag', () => {
    const result = transformData({ Id: '001xx', attributes: { type: 'Account', url: '' } });
    expect(result.transformed).toBe(true);
    expect(result.Id).toBe('001xx');
  });
});
```

## Best Practices

### Type Safety

Always use proper TypeScript types:

```typescript
// GOOD - explicit types
export async function getAccounts(): Promise<QueryResult<Account>> {
  return await executeQuery<Account>('SELECT Id, Name FROM Account');
}

interface Account extends SObject {
  Name: string;
}

// BAD - any types
export async function getAccounts(): Promise<any> {
  return await executeQuery('SELECT Id, Name FROM Account');
}
```

### Error Handling

```typescript
export async function myApiFunction(param: string): Promise<MyResult> {
  try {
    return await salesforceRequest<MyResult>('/path', { method: 'GET' });
  } catch (error) {
    // salesforceRequest already parses errors
    // Re-throw with context if needed
    if (error instanceof Error) {
      throw new Error(`Failed to fetch: ${error.message}`);
    }
    throw error;
  }
}
```

### Pure Functions

Prefer pure functions when possible for easier testing:

```typescript
// GOOD - pure function, easily testable
export function parseResponse(response: RawResponse): ParsedResponse {
  return response.records.map(r => ({
    id: r.Id,
    name: r.Name
  }));
}

// Then use in component
const data = parseResponse(await salesforceRequest(...));
```

### Input Validation

Validate inputs early with type guards:

```typescript
export function processRecords(records: unknown): ProcessedRecord[] {
  if (!Array.isArray(records)) {
    throw new TypeError('records must be an array');
  }
  if (records.length === 0) {
    return [];
  }
  // Process...
  return records.map(r => processRecord(r));
}

function isValidRecord(record: unknown): record is SObject {
  return typeof record === 'object' && record !== null && 'Id' in record;
}
```

### Generic Types

Use generics for flexible, type-safe functions:

```typescript
export async function getRecord<T extends SObject>(
  objectType: string,
  recordId: string,
  fields?: string[]
): Promise<T> {
  const fieldsParam = fields?.join(',') || 'Id';
  const path = `/services/data/v62.0/sobjects/${objectType}/${recordId}`;
  return await salesforceRequest<T>(path, {
    params: { fields: fieldsParam }
  });
}

// Usage with type inference
const account = await getRecord<Account>('Account', '001xx');
account.Name; // TypeScript knows this exists
```

## File-by-File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `auth.ts` | Connection management | `getAccessToken`, `loadConnections`, `setActiveConnection` |
| `salesforce.ts` | API operations | `executeQuery`, `getObjectDescribe`, `executeApex` |
| `salesforce-request.ts` | REST wrapper | `salesforceRequest` |
| `fetch.ts` | Fetch routing | `smartFetch`, `extensionFetch`, `isProxyConnected` |
| `query-utils.ts` | Query parsing | `parseQueryResults`, `flattenColumnMetadata` |
| `apex-utils.ts` | Apex helpers | `parseCompileError`, `formatDebugLog` |
| `record-utils.ts` | Record helpers | `sortFields`, `getFieldValue` |
| `schema-utils.ts` | Schema helpers | `formatFieldType`, `isFormulaField` |
| `rest-api-utils.ts` | REST helpers | `buildRequestUrl`, `parseResponse` |
| `settings-utils.ts` | Settings | `getSettings`, `updateSettings` |
| `events-utils.ts` | Events | `parseChannel`, `formatEvent` |
| `history-manager.ts` | History | `HistoryManager` class |
| `soql-autocomplete.ts` | Autocomplete | `SoqlAutocomplete` class |
| `theme.ts` | Theming | `initTheme`, `setTheme`, `getTheme` |
| `background-utils.ts` | Background | `sendToBackground` |
| `ui-helpers.ts` | DOM utils | `formatDate`, `formatFileSize` |
| `icons.ts` | Icons | `getIconSvg` |
| `text-utils.ts` | Text formatting | `truncate`, `formatNumber` |
