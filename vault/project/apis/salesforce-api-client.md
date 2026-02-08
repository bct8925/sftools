---
title: Salesforce API Client
type: project
category: apis
tags:
  - api
  - salesforce
  - rest
  - fetch
aliases:
  - API Layer
  - salesforceRequest
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/api/salesforce-request.ts
  - src/api/salesforce.ts
  - src/api/fetch.ts
  - src/api/bulk-query.ts
  - src/api/debug-logs.ts
  - src/api/streaming.ts
  - src/api/cors-detection.ts
confidence: high
---

# Salesforce API Client

## Overview

The `src/api/` directory provides a type-safe, layered interface for all Salesforce API operations. The architecture is: `salesforceRequest` (auth + error handling) → `smartFetch` (proxy/extension routing) → Salesforce REST API.

## How It Works

### Layer Architecture

```
Components
    ↓ call high-level functions
salesforce.ts (high-level operations)
    ↓ uses
salesforce-request.ts (auth, error handling, CORS detection)
    ↓ uses
fetch.ts (smart routing: proxy vs extension)
    ↓
Background Service Worker  OR  Native Proxy
    ↓
Salesforce REST API
```

### salesforce-request.ts — Authenticated REST Wrapper

The primary API for all Salesforce calls:

```typescript
const result = await salesforceRequest<QueryResult>('/services/data/v62.0/query', {
  method: 'GET',
  params: { q: 'SELECT Id FROM Account' }
});
```

**Features**: Auto auth header injection, smart routing, typed error parsing, CORS detection + modal, 401 → `triggerAuthExpired()`.

### fetch.ts — Smart Routing

```typescript
smartFetch(url, options)     // Auto-routes: proxy if connected, else extension
extensionFetch(url, options) // Force via background service worker
proxyFetch(url, options)     // Force via native proxy
```

In test mode (`chrome.runtime.id === 'test-extension-id'`): uses `directFetch` → MockRouter intercepts.

### salesforce.ts — High-Level Operations

| Function | Purpose |
|----------|---------|
| `executeQueryWithColumns(soql, tooling?)` | Query with column metadata |
| `fetchQueryMore(nextUrl)` | Pagination |
| `getGlobalDescribe(bypass?)` | All objects (cached per-connection) |
| `getObjectDescribe(name, bypass?)` | Object fields (cached) |
| `clearDescribeCache()` | Clear per-connection cache |
| `getRecord(obj, id)` / `getRecordWithRelationships(...)` | Record retrieval |
| `updateRecord(obj, id, fields)` | Record update |
| `executeAnonymousApex(code, onProgress)` | Apex execution + trace flag + log retrieval |
| `executeRestRequest(path, method, body)` | Raw REST for explorer tab |
| `getFormulaFieldMetadata(obj, field)` / `updateFormulaField(...)` | Formula field editing |

### bulk-query.ts — Bulk API v2

```typescript
const csv = await executeBulkQueryExport(soql, onProgress);
// High-level: create job → poll (150×2s) → download CSV
```

Low-level: `createBulkQueryJob`, `getBulkQueryJobStatus`, `getBulkQueryResults`, `abortBulkQueryJob`.

### debug-logs.ts — Trace Flags & Debug Logs

| Function | Purpose |
|----------|---------|
| `ensureTraceFlag(userId)` | Create/extend trace flag (30 min) |
| `enableTraceFlagForUser(userId)` | Enable debugging for user |
| `getDebugLogStats()` | Count + total size (handles >2000 pagination) |
| `deleteDebugLogs(ids)` / `deleteAllDebugLogs()` | Bulk delete via Tooling composite |
| `getLatestAnonymousLog()` | Retrieve last anonymous execution log |
| `getDebugLogsSince(timestamp)` / `getLogBody(id)` | Log viewer |

### streaming.ts — Channel Discovery & Publishing

```typescript
getAllStreamingChannels() // → { platformEvents, standardEvents, pushTopics, systemTopics }
publishPlatformEvent(eventName, fields) // → { success, id, error }
```

### cors-detection.ts — CORS Error Handling

`isCorsError(response)` detects CORS failures (status 0, CORS keywords). `showCorsErrorModal()` dispatches UI event.

## Key Files

| File | Exports | Purpose |
|------|---------|---------|
| `salesforce-request.ts` | `salesforceRequest` | Authenticated REST wrapper |
| `salesforce.ts` | `executeQueryWithColumns`, `getObjectDescribe`, etc. | High-level operations |
| `fetch.ts` | `smartFetch`, `extensionFetch`, `proxyFetch` | Request routing |
| `bulk-query.ts` | `executeBulkQueryExport`, etc. | Bulk API v2 |
| `debug-logs.ts` | `ensureTraceFlag`, `getDebugLogStats`, etc. | Debug log management |
| `streaming.ts` | `getAllStreamingChannels`, `publishPlatformEvent` | Streaming channels |
| `cors-detection.ts` | `isCorsError`, `showCorsErrorModal` | CORS handling |

## Related

- [[overview|System Architecture Overview]]
- [[background-service-worker|Background Service Worker]]
- [[authentication-oauth|Authentication and OAuth]]
- [[native-proxy|Native Proxy]]

## Notes

### Best Practices
- **MUST** use `salesforceRequest()` for all Salesforce API calls
- **MUST** use `smartFetch()` for automatic proxy routing
- Use generic types for type-safe results: `salesforceRequest<QueryResult>(...)`
- Use high-level operations (e.g., `executeAnonymousApex`) instead of composing low-level calls
- Always handle pagination (`done` + `nextRecordsUrl`)
- Use describe cache (automatic per-connection); clear on connection change

### Error Handling
All functions throw descriptive errors parsed from Salesforce responses:
- `MALFORMED_QUERY: unexpected token...`
- `NOT_FOUND: The requested resource does not exist`
- CORS errors show modal + throw
- 401 errors trigger auth expiration flow
