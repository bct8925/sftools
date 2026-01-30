# API - sftools Salesforce API Client

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

The `api/` directory contains all Salesforce REST API operations, request routing, and specialized API utilities. This module provides a type-safe, consistent interface for interacting with Salesforce APIs.

## Directory Structure

```
api/
├── salesforce-request.ts  # Authenticated REST wrapper
├── salesforce.ts          # High-level API operations
├── fetch.ts               # Smart routing (proxy vs extension)
├── bulk-query.ts          # Bulk API v2 query export
├── debug-logs.ts          # Trace flags & debug logs
├── streaming.ts           # Streaming channel discovery
├── cors-detection.ts      # CORS error detection
└── index.ts               # Barrel exports
```

## TypeScript Patterns

All API files use TypeScript with strict mode. Import types from `src/types/salesforce.d.ts`:

```typescript
import type {
  QueryResult,
  SObject,
  DescribeGlobalResult,
  ObjectDescribeResult,
  ApexExecutionResult,
  ColumnMetadata,
} from '../types/salesforce';
```

## Key Modules

### salesforce-request.ts - Authenticated REST Wrapper

The primary API for making Salesforce REST calls with automatic auth, routing, and error handling.

```typescript
import { salesforceRequest, type SalesforceRequestOptions } from '../api/salesforce-request';

interface SalesforceRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  params?: Record<string, string>;
  body?: string;
  headers?: Record<string, string>;
}
```

#### Features

- Automatic auth header injection via `getAccessToken()`
- Smart routing via `smartFetch()` (proxy or extension fetch)
- Error response parsing with typed errors
- CORS error detection and modal triggering
- Auth expiration handling (triggers `triggerAuthExpired` on 401)
- Generic return types for type safety

#### Usage Examples

```typescript
// GET request with query params
const result = await salesforceRequest<QueryResult>(
  '/services/data/v62.0/query',
  {
    method: 'GET',
    params: { q: 'SELECT Id FROM Account LIMIT 10' }
  }
);

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

#### Error Handling

```typescript
try {
  await salesforceRequest('/services/data/v62.0/query', {
    params: { q: 'INVALID SOQL' }
  });
} catch (error) {
  // Error message is parsed from Salesforce response
  console.error(error.message); // "MALFORMED_QUERY: ..."
}

// CORS errors throw with message and show modal
// 401 errors trigger auth expiration flow
// Other errors throw with Salesforce error message
```

### fetch.ts - Smart Fetch Routing

Routes requests through proxy when available, otherwise uses extension fetch.

```typescript
import {
  smartFetch,
  extensionFetch,
  proxyFetch,
  isProxyConnected,
  checkProxyStatus,
  type FetchOptions,
  type FetchResponse,
} from '../api/fetch';
```

#### Fetch Response Interface

```typescript
interface FetchResponse {
  success: boolean;
  status: number;
  statusText?: string;
  data?: string;
  error?: string;
  authExpired?: boolean;
  connectionId?: string;
}
```

#### Functions

```typescript
// Smart routing - use this for all Salesforce requests
const response = await smartFetch(url, options);
// Automatically routes to proxy if connected, otherwise extension fetch

// Force extension fetch (bypasses proxy)
const response = await extensionFetch(url, options);

// Force proxy fetch (requires proxy connection)
const response = await proxyFetch(url, options);

// Check proxy status (synchronous)
if (isProxyConnected()) {
  // Proxy features available (streaming, CORS bypass)
}

// Check proxy status (async, pings proxy)
const connected = await checkProxyStatus();
```

#### Routing Logic

```typescript
// In real extension context
if (isProxyConnected()) {
  return proxyFetch(url, options); // Via native messaging
} else {
  return extensionFetch(url, options); // Via background service worker
}

// In headless test mode (chrome.runtime.id === 'test-extension-id')
return directFetch(url, options); // Direct fetch (MockRouter intercepts)
```

### salesforce.ts - High-Level API Operations

High-level Salesforce operations built on `salesforceRequest`.

```typescript
import {
  // Query
  executeQueryWithColumns,
  fetchQueryMore,

  // Describe
  getGlobalDescribe,
  getObjectDescribe,
  clearDescribeCache,

  // Records
  getRecord,
  getRecordWithRelationships,
  updateRecord,

  // Apex
  executeAnonymousApex,

  // User
  getCurrentUserId,

  // REST API
  executeRestRequest,

  // Utilities (re-exports)
  getDebugLogStats,
  deleteDebugLogs,
  deleteAllDebugLogs,
  enableTraceFlagForUser,
  searchUsers,
  searchFlows,
  getFlowVersions,
  deleteInactiveFlowVersions,
  searchProfiles,

  // Bulk Query (re-exports)
  createBulkQueryJob,
  getBulkQueryJobStatus,
  getBulkQueryResults,
  executeBulkQueryExport,

  // Streaming (re-exports)
  getEventChannels,
  getPushTopics,
  getAllStreamingChannels,
  publishPlatformEvent,

  // Formula Fields
  getFormulaFieldMetadata,
  updateFormulaField,

  // Types
  type QueryWithColumnsResult,
  type QueryMoreResult,
  type ExecuteAnonymousResult,
  type RecordWithRelationships,
  type FormulaFieldMetadata,
} from '../api/salesforce';
```

#### Query Operations

```typescript
// Execute query with column metadata
const result = await executeQueryWithColumns(
  'SELECT Id, Name, Account.Name FROM Contact LIMIT 10',
  false // useToolingApi
);
// Returns: { records, totalSize, done, nextRecordsUrl, columnMetadata, entityName }

// Fetch next page of results
const more = await fetchQueryMore(result.nextRecordsUrl);
// Returns: { records, done, nextRecordsUrl }
```

#### Describe Operations (with caching)

```typescript
// Get global describe (all objects)
const global = await getGlobalDescribe();
// Uses per-connection cache if available

const global = await getGlobalDescribe(true);
// Bypasses cache (bypassCache = true)

// Get object describe (fields, relationships)
const describe = await getObjectDescribe('Account');
// Uses per-connection cache if available

// Clear describe cache for current connection
await clearDescribeCache();
```

#### Record Operations

```typescript
// Get record
const account = await getRecord('Account', '001xxxxxxxxxxxx');
// Returns: SObject

// Get record with relationship names
const result = await getRecordWithRelationships(
  'Contact',
  '003xxxxxxxxxxxx',
  fields // FieldDescribe[]
);
// Returns: { record, nameFieldMap }
// Automatically includes relationship fields like Account.Name

// Update record
await updateRecord('Account', '001xxxxxxxxxxxx', {
  Name: 'New Name',
  Industry: 'Technology'
});
```

#### Apex Execution

```typescript
const result = await executeAnonymousApex(
  'System.debug("Hello");',
  (message) => console.log(message) // onProgress callback
);
// Returns: { execution: ApexExecutionResult, debugLog: string | null }
// Automatically sets up trace flag, executes, and retrieves debug log
```

#### REST API Explorer

```typescript
const response = await executeRestRequest(
  '/services/data/v62.0/sobjects/Account/001xxxxxxxxxxxx',
  'GET',
  null // body
);
// Returns: { success, status, statusText, error?, data, raw }
// Used by REST API tab for raw API exploration
```

### bulk-query.ts - Bulk API v2 Query Export

Functions for large data exports using Salesforce Bulk API v2.

```typescript
import {
  createBulkQueryJob,
  getBulkQueryJobStatus,
  getBulkQueryResults,
  abortBulkQueryJob,
  executeBulkQueryExport,
  type BulkQueryJob,
} from '../api/bulk-query';
```

#### High-Level Export

```typescript
// Execute bulk query with polling and progress
const csv = await executeBulkQueryExport(
  'SELECT Id, Name FROM Account',
  (state, recordCount) => {
    console.log(`State: ${state}, Records: ${recordCount}`);
  }
);
// Returns CSV string
// Handles job creation, polling (150 attempts × 2s), and download
```

#### Low-Level Control

```typescript
// Create job
const job = await createBulkQueryJob('SELECT Id FROM Account');

// Poll status
const status = await getBulkQueryJobStatus(job.id);
// status.state: 'UploadComplete' | 'InProgress' | 'JobComplete' | 'Failed' | 'Aborted'

// Get results (only when JobComplete)
const csv = await getBulkQueryResults(job.id);

// Abort job
await abortBulkQueryJob(job.id);
```

### debug-logs.ts - Trace Flags & Debug Logs

Functions for managing trace flags, debug levels, and debug logs.

```typescript
import {
  // Trace flag management
  ensureTraceFlag,
  enableTraceFlagForUser,
  deleteAllTraceFlags,

  // Debug log operations
  getDebugLogStats,
  deleteDebugLogs,
  deleteAllDebugLogs,
  getLatestAnonymousLog,

  // Log viewer
  getDebugLogsSince,
  getLogBody,

  // Types
  type DebugLogStats,
  type DebugLogEntry,
} from '../api/debug-logs';
```

#### Trace Flag Management

```typescript
// Ensure trace flag exists for user (used by executeAnonymousApex)
await ensureTraceFlag(userId);
// Creates or updates TraceFlag with SFTOOLS_DEBUG DebugLevel
// Extends expiration to 30 minutes if needed

// Enable trace flag for user (30 minutes)
await enableTraceFlagForUser(userId);
// Used by Utils tab to enable debugging

// Delete all trace flags
const result = await deleteAllTraceFlags();
// Returns: { deletedCount }
```

#### Debug Log Operations

```typescript
// Get debug log statistics
const stats = await getDebugLogStats();
// Returns: { count, totalSize, logIds }
// Handles pagination to get all logs beyond 2000 limit

// Delete specific logs
await deleteDebugLogs(['07Lxx000000001', '07Lxx000000002']);
// Uses Tooling API composite endpoint (batches of 25)

// Delete all logs
await deleteAllDebugLogs();
// Convenience wrapper for getDebugLogStats() + deleteDebugLogs()

// Get latest anonymous apex log
const log = await getLatestAnonymousLog();
// Used by executeAnonymousApex to retrieve debug log
```

#### Log Viewer

```typescript
// Get logs created since timestamp
const logs = await getDebugLogsSince('2024-01-01T00:00:00.000Z');
// Returns: DebugLogEntry[]
// Includes LogUser.Name, LogLength, Operation, Request, Status, StartTime

// Get log body content
const body = await getLogBody('07Lxx000000001');
// Returns plain text log content
```

### streaming.ts - Streaming Channel Discovery

Functions for discovering and publishing to streaming channels.

```typescript
import {
  getEventChannels,
  getPushTopics,
  getAllStreamingChannels,
  publishPlatformEvent,
  type StreamingChannels,
  type PublishEventResult,
} from '../api/streaming';
```

#### Channel Discovery

```typescript
// Get custom Platform Events
const { customEvents } = await getEventChannels();
// Queries EntityDefinition for custom __e objects

// Get active PushTopics
const pushTopics = await getPushTopics();
// Queries PushTopic for IsActive = true

// Get all streaming channels (unified)
const channels = await getAllStreamingChannels();
// Returns: {
//   platformEvents: EntityDefinition[],
//   standardEvents: [...], // BatchApexErrorEvent, etc.
//   pushTopics: PushTopic[],
//   systemTopics: [...], // /systemTopic/Logging
// }
```

#### Publishing Events

```typescript
const result = await publishPlatformEvent('MyEvent__e', {
  Field1__c: 'value1',
  Field2__c: 'value2',
});
// Returns: { success, id, error }

if (result.success) {
  console.log(`Published event: ${result.id}`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

### cors-detection.ts - CORS Error Detection

Utilities for detecting and handling CORS errors.

```typescript
import { isCorsError, showCorsErrorModal } from '../api/cors-detection';
```

#### CORS Detection

```typescript
const response = await smartFetch(url, options);

if (isCorsError(response)) {
  // Detected CORS error
  showCorsErrorModal(); // Dispatches 'show-cors-error' event
  throw new Error('CORS error - enable proxy or configure CORS');
}
```

#### Detection Logic

```typescript
function isCorsError(response: FetchResponse): boolean {
  // Checks for:
  // 1. status === 0 && error includes "failed to fetch"
  // 2. error includes CORS keywords (cors, cross-origin, access-control)
  return true if CORS error detected;
}
```

## Common Operations

### Execute SOQL Query

```typescript
import { executeQueryWithColumns } from '../api/salesforce';

const result = await executeQueryWithColumns(
  'SELECT Id, Name, Account.Name FROM Contact WHERE Email != null LIMIT 100'
);

console.log(`Total: ${result.totalSize}`);
result.records.forEach(record => {
  console.log(record.Name);
});

// Handle pagination
if (!result.done && result.nextRecordsUrl) {
  const more = await fetchQueryMore(result.nextRecordsUrl);
  console.log(`More records: ${more.records.length}`);
}
```

### Get Object Metadata

```typescript
import { getObjectDescribe } from '../api/salesforce';

const describe = await getObjectDescribe('Account');

// Field information
describe.fields.forEach(field => {
  console.log(`${field.name} (${field.type}): ${field.label}`);
});

// Relationship information
const relationships = describe.fields.filter(f => f.type === 'reference');
console.log(`Relationships: ${relationships.length}`);
```

### Execute Anonymous Apex

```typescript
import { executeAnonymousApex } from '../api/salesforce';

const result = await executeAnonymousApex(
  `
    System.debug('Starting process...');
    List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
    System.debug('Found ' + accounts.size() + ' accounts');
  `,
  (message) => console.log(message) // onProgress
);

if (result.execution.success) {
  console.log('Execution successful');
  if (result.debugLog) {
    console.log('Debug log:', result.debugLog);
  }
} else {
  console.error('Compilation failed:', result.execution.compileProblem);
}
```

### Bulk Query Export

```typescript
import { executeBulkQueryExport } from '../api/bulk-query';

const csv = await executeBulkQueryExport(
  'SELECT Id, Name, Email FROM Contact',
  (state, recordCount) => {
    console.log(`${state}: ${recordCount} records`);
  }
);

// Parse CSV
const rows = csv.split('\n');
console.log(`Exported ${rows.length - 1} records`);
```

### Update Record

```typescript
import { updateRecord } from '../api/salesforce';

await updateRecord('Account', '001xxxxxxxxxxxx', {
  Name: 'Updated Name',
  Industry: 'Technology',
  AnnualRevenue: 1000000
});
```

## Best Practices

### Use salesforceRequest for All API Calls

```typescript
// GOOD - use salesforceRequest for automatic auth and error handling
import { salesforceRequest } from '../api/salesforce-request';
const result = await salesforceRequest<QueryResult>(endpoint, options);

// BAD - don't use fetch directly for Salesforce APIs
const response = await fetch(url, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### Use smartFetch for Automatic Routing

```typescript
// GOOD - use smartFetch for automatic proxy routing
import { smartFetch } from '../api/fetch';
const response = await smartFetch(url, options);

// BAD - don't hard-code proxy or extension fetch
const response = await extensionFetch(url, options); // Misses proxy optimization
```

### Type Query Results

```typescript
// GOOD - use generic types for type safety
const result = await executeQueryWithColumns<Contact>(
  'SELECT Id, Name, Email FROM Contact'
);
result.records.forEach(contact => {
  console.log(contact.Email); // TypeScript knows Email exists
});

// BAD - no type safety
const result = await executeQueryWithColumns('SELECT Id, Name, Email FROM Contact');
result.records.forEach(contact => {
  console.log(contact.Email); // No type checking
});
```

### Handle Describe Cache

```typescript
// GOOD - use cache for repeated describe calls
const describe = await getObjectDescribe('Account');
// Second call uses cache
const describeAgain = await getObjectDescribe('Account'); // Fast

// Clear cache when needed
await clearDescribeCache(); // On connection change or refresh

// BAD - bypass cache unnecessarily
const describe = await getObjectDescribe('Account', true); // bypassCache=true
// Slower, more API calls
```

### Handle Pagination

```typescript
// GOOD - check done and nextRecordsUrl
let allRecords = result.records;
while (!result.done && result.nextRecordsUrl) {
  const more = await fetchQueryMore(result.nextRecordsUrl);
  allRecords = allRecords.concat(more.records);
  result = more;
}

// BAD - ignore pagination
const records = result.records; // Only first page
```

### Use High-Level Operations

```typescript
// GOOD - use high-level operations for common tasks
import { executeAnonymousApex } from '../api/salesforce';
const result = await executeAnonymousApex(code, onProgress);
// Handles trace flag setup, execution, and log retrieval

// BAD - manually implement complex flows
await ensureTraceFlag(userId);
const execution = await salesforceRequest(...);
const log = await getLatestAnonymousLog();
```

## Error Handling

All API functions throw descriptive errors:

```typescript
try {
  await salesforceRequest('/invalid/endpoint');
} catch (error) {
  console.error(error.message);
  // "NOT_FOUND: The requested resource does not exist"
}

try {
  await executeQueryWithColumns('INVALID SOQL');
} catch (error) {
  console.error(error.message);
  // "MALFORMED_QUERY: unexpected token: 'INVALID'"
}

// CORS errors show modal and throw
try {
  await salesforceRequest('/endpoint');
} catch (error) {
  // Modal shown, error message: "CORS error - please configure..."
}
```

## File-by-File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `salesforce-request.ts` | Authenticated REST wrapper | `salesforceRequest` |
| `salesforce.ts` | High-level API operations | `executeQueryWithColumns`, `getObjectDescribe`, `executeAnonymousApex`, `updateRecord` |
| `fetch.ts` | Smart routing | `smartFetch`, `extensionFetch`, `proxyFetch`, `isProxyConnected`, `checkProxyStatus` |
| `bulk-query.ts` | Bulk API v2 query export | `createBulkQueryJob`, `executeBulkQueryExport` |
| `debug-logs.ts` | Trace flags & debug logs | `ensureTraceFlag`, `getDebugLogStats`, `deleteDebugLogs`, `getDebugLogsSince`, `getLogBody` |
| `streaming.ts` | Streaming channel discovery | `getAllStreamingChannels`, `publishPlatformEvent` |
| `cors-detection.ts` | CORS error detection | `isCorsError`, `showCorsErrorModal` |
| `index.ts` | Barrel exports | Re-exports all public functions |
