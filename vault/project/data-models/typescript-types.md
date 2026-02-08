---
title: TypeScript Type Definitions
type: project
category: data-models
tags:
  - typescript
  - types
  - salesforce
  - interfaces
aliases:
  - Type Definitions
  - Types
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/types/salesforce.d.ts
  - src/types/components.d.ts
  - src/types/vite-env.d.ts
confidence: high
---

# TypeScript Type Definitions

## Overview

All types are declared in `.d.ts` files in `src/types/` to provide type safety without generating JavaScript. The primary file is `salesforce.d.ts` which defines all Salesforce API interfaces.

## How It Works

### Core Types (`salesforce.d.ts`)

**Connection:**
```typescript
interface SalesforceConnection {
  id: string; label: string; instanceUrl: string; loginDomain: string;
  accessToken: string; refreshToken: string | null; clientId: string | null;
  createdAt: number; lastUsedAt: number;
}
```

**Query:**
```typescript
interface QueryResult<T = SObject> {
  totalSize: number; done: boolean; records: T[]; nextRecordsUrl?: string;
}
interface SObject { Id: string; attributes: { type: string; url: string }; [key: string]: unknown; }
interface ColumnMetadata { /* query column info */ }
```

**Describe:**
```typescript
interface DescribeGlobalResult { /* all objects */ }
interface ObjectDescribeResult { /* object with fields */ }
interface FieldDescribe { name: string; type: FieldType; label: string; /* ... */ }
type FieldType = 'string' | 'boolean' | 'int' | 'double' | 'date' | 'datetime'
  | 'currency' | 'percent' | 'phone' | 'email' | 'url' | 'textarea' | 'html'
  | 'picklist' | 'multipicklist' | 'reference' | 'id' | 'base64' | 'address' | /* ... */;
```

**Apex:** `ApexExecutionResult`
**Request:** `SalesforceRequestOptions`, `RestApiResponse`
**Tooling:** `ToolingQueryResult<T>`, `DebugLog`, `FlowDefinition`

### Custom Events (`components.d.ts`)

Extends DOM event system:
```typescript
declare global {
  interface DocumentEventMap {
    'connection-changed': ConnectionChangedEvent;
    'theme-changed': ThemeChangedEvent;
  }
}
```

### Usage Patterns

- **Always** use `import type { ... }` for type-only imports
- **Extend SObject** for specific record types
- **Use generics**: `salesforceRequest<QueryResult<Account>>(...)`
- **Prefer `unknown` over `any`** for dynamic values
- **Use `| null`** explicitly for nullable fields

## Key Files

| File | Contains |
|------|----------|
| `salesforce.d.ts` | All Salesforce API types |
| `components.d.ts` | Custom event types, DOM extensions |
| `vite-env.d.ts` | Vite environment type references |

## Related

- [[Salesforce API Client]]
- [[TypeScript]]
- [[Component Architecture]]
