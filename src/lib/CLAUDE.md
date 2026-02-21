# Lib - sftools TypeScript Utilities

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

The `lib/` directory contains shared TypeScript utility functions used by all components. Functions are organized by domain and provide type-safe interfaces for query parsing, record manipulation, schema utilities, and UI helpers.

**Note**: API and authentication code has been moved to dedicated directories:
- **API utilities**: See [../api/CLAUDE.md](../api/CLAUDE.md) for `salesforce-request.ts`, `salesforce.ts`, `fetch.ts`, etc.
- **Authentication**: See [../auth/CLAUDE.md](../auth/CLAUDE.md) for `auth.ts`, `oauth-credentials.ts`, etc.

## Directory Structure

```
lib/
├── query-utils.ts        # SOQL parsing and result formatting
├── apex-utils.ts         # Apex execution helpers
├── record-utils.ts       # Record field manipulation
├── schema-utils.ts       # Object metadata helpers
├── rest-api-utils.ts     # REST API request building
├── settings-utils.ts     # Settings storage
├── events-utils.ts       # Event subscription helpers
├── history-manager.ts    # Query/Apex history & favorites
├── theme.ts              # Dark/light mode management
├── background-utils.ts   # Service worker helpers
├── ui-helpers.ts         # DOM utilities
├── icons.ts              # Icon mapping
├── text-utils.ts         # Text formatting
├── debug.ts              # Debug utilities
├── app-utils.ts          # App utilities
├── column-utils.ts       # Column utilities
├── csv-utils.ts          # CSV export utilities
├── date-utils.ts         # Date formatting
├── value-utils.ts        # Value formatting
├── monaco-custom.js      # Monaco editor customization
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

**Note**: The following modules have been moved to dedicated directories:
- `auth.ts`, `oauth-credentials.ts` → See [../auth/CLAUDE.md](../auth/CLAUDE.md)
- `salesforce.ts`, `salesforce-request.ts`, `fetch.ts`, `cors-detection.ts`, `bulk-query.ts`, `debug-logs.ts`, `streaming.ts` → See [../api/CLAUDE.md](../api/CLAUDE.md)

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

## Adding New Utilities

### 1. Create the TypeScript Module

```typescript
// src/lib/my-utils.ts

import { salesforceRequest } from '../api/salesforce-request';
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
| `query-utils.ts` | Query parsing | `parseQueryResults`, `flattenColumnMetadata` |
| `apex-utils.ts` | Apex helpers | `parseCompileError`, `formatDebugLog` |
| `record-utils.ts` | Record helpers | `sortFields`, `getFieldValue` |
| `schema-utils.ts` | Schema helpers | `formatFieldType`, `isFormulaField` |
| `rest-api-utils.ts` | REST helpers | `buildRequestUrl`, `parseResponse` |
| `settings-utils.ts` | Settings | `getSettings`, `updateSettings` |
| `events-utils.ts` | Events | `parseChannel`, `formatEvent` |
| `history-manager.ts` | History | `HistoryManager` class |
| `theme.ts` | Theming | `initTheme`, `setTheme`, `getTheme` |
| `background-utils.ts` | Background | `sendToBackground` |
| `ui-helpers.ts` | DOM utils | `formatDate`, `formatFileSize` |
| `icons.ts` | Icons | `getIconSvg`, `IconName` type, tile icons (`tileQuery`, `tileApex`, etc.), header icons (`apps`, `chevrondown`, `salesforce1`) |
| `text-utils.ts` | Text formatting | `truncate`, `formatNumber` |
| `app-utils.ts` | App utilities | `buildOAuthUrl` (adds `prompt=login` for standard SF domains) |
| `column-utils.ts` | Column utilities | Column manipulation |
| `csv-utils.ts` | CSV export | CSV formatting |
| `date-utils.ts` | Date formatting | Date helpers |
| `value-utils.ts` | Value formatting | Value display helpers |
| `monaco-custom.js` | Monaco editor | Editor customization |
| `debug.ts` | Debug utilities | Debug helpers |
| `utils.ts` | Central re-export | Deprecated - import directly |
