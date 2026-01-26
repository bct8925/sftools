# Types - sftools TypeScript Definitions

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains **TypeScript type definitions** for the sftools extension. All types are declared using `.d.ts` files to provide type safety across the codebase without generating JavaScript output.

## Directory Structure

```
types/
├── salesforce.d.ts   # Salesforce API types (connections, queries, objects, etc.)
├── components.d.ts   # Custom event types and DOM extensions
└── vite-env.d.ts     # Vite environment type references
```

## File Purposes

### salesforce.d.ts - Salesforce API Types

The primary type definition file containing all Salesforce-related interfaces:

```typescript
// Connection
SalesforceConnection     // Multi-org connection storage

// Query
QueryResult<T>           // SOQL query response with generics
ColumnMetadata           // Query result column metadata
SObject                  // Generic Salesforce object

// Describe
DescribeGlobalResult     // Global describe response
SObjectDescribe          // Object-level describe
ObjectDescribeResult     // Full object describe with fields
FieldDescribe            // Field metadata
FieldType                // All Salesforce field types (union)
PicklistValue            // Picklist option
ChildRelationship        // Related object info
RecordTypeInfo           // Record type metadata

// Apex
ApexExecutionResult      // Anonymous Apex response

// Request/Response
SalesforceRequestOptions // Request configuration
SalesforceRequestResult  // Generic response wrapper
RestApiResponse          // REST API response structure

// Tooling API
ToolingQueryResult<T>    // Tooling API query response
DebugLog                 // Debug log record
FlowDefinition           // Flow metadata
FlowVersion              // Flow version info
```

### components.d.ts - Custom Event Types

Extends the DOM event system with custom event types:

```typescript
// Custom events dispatched by the app
ConnectionChangedEvent   // Fired when active connection changes
ThemeChangedEvent        // Fired when theme changes

// Global type extensions
declare global {
  interface DocumentEventMap {
    'connection-changed': ConnectionChangedEvent;
    'theme-changed': ThemeChangedEvent;
  }
}
```

### vite-env.d.ts - Vite Types

References Vite's client types for environment variables and module imports.

## Usage Patterns

### Importing Types

Always use `import type` for type-only imports:

```typescript
// GOOD - type-only import
import type {
  SalesforceConnection,
  QueryResult,
  SObject,
  FieldDescribe,
} from '../types/salesforce';

// GOOD - mixed import
import { executeQuery, type QueryResult } from '../lib/salesforce';

// BAD - regular import for types (wastes bundle size)
import { SalesforceConnection } from '../types/salesforce';
```

### Generic Query Results

Use generics for type-safe query results:

```typescript
// Define expected record shape
interface AccountRecord extends SObject {
  Name: string;
  Industry: string | null;
  AnnualRevenue: number | null;
}

// Use generic parameter
const result = await executeQuery<AccountRecord>(
  'SELECT Id, Name, Industry, AnnualRevenue FROM Account'
);

// TypeScript knows the shape
result.records.forEach(account => {
  console.log(account.Name);      // string
  console.log(account.Industry);  // string | null
});
```

### Type Guards

Create type guards for runtime type checking:

```typescript
import type { SObject, FieldDescribe } from '../types/salesforce';

function isSObject(value: unknown): value is SObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'Id' in value &&
    typeof (value as SObject).Id === 'string'
  );
}

function isFieldDescribe(value: unknown): value is FieldDescribe {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value
  );
}
```

### Extending SObject

Create specific record types by extending SObject:

```typescript
import type { SObject } from '../types/salesforce';

// Account with specific fields
interface Account extends SObject {
  Name: string;
  Type: string | null;
  Industry: string | null;
  Phone: string | null;
  Website: string | null;
}

// Contact with relationships
interface Contact extends SObject {
  FirstName: string | null;
  LastName: string;
  Email: string | null;
  Account?: Account;  // Relationship query result
}

// With nested query results
interface AccountWithContacts extends Account {
  Contacts?: {
    totalSize: number;
    done: boolean;
    records: Contact[];
  };
}
```

## Adding New Types

### 1. Add to Existing File

For Salesforce API types, add to `salesforce.d.ts`:

```typescript
// Add after existing interfaces

// My new API response type
export interface MyApiResponse {
  success: boolean;
  data: MyDataType[];
  nextUrl?: string;
}

export interface MyDataType {
  id: string;
  name: string;
  attributes: Record<string, unknown>;
}
```

### 2. Create New Type File

For a new domain, create a new `.d.ts` file:

```typescript
// src/types/my-feature.d.ts

/**
 * Types for My Feature
 */

export interface MyFeatureConfig {
  enabled: boolean;
  options: MyFeatureOptions;
}

export interface MyFeatureOptions {
  setting1: string;
  setting2: number;
}
```

### 3. Add Custom Events

Extend the global event maps in `components.d.ts`:

```typescript
// Add to components.d.ts

export interface MyFeatureEvent extends CustomEvent<MyFeatureData> {
  type: 'my-feature-event';
}

declare global {
  interface DocumentEventMap {
    // ... existing events
    'my-feature-event': MyFeatureEvent;
  }
}
```

## Best Practices

### MUST Follow

1. **Use `export interface`** - Never use `export type` for object shapes
2. **Document with JSDoc** - Add descriptions for complex types
3. **Use union types** - For known sets of values (like FieldType)
4. **Extend SObject** - For record types, always extend the base interface
5. **Use generics** - For flexible, reusable types

### SHOULD Follow

1. **Group related types** - Keep interfaces that work together close
2. **Use `| null`** - Explicitly mark nullable fields
3. **Prefer `unknown` over `any`** - For truly dynamic values
4. **Add index signatures carefully** - Only when truly needed (`[key: string]: unknown`)

### MUST NOT

1. **Don't use `any`** - Use `unknown` and type guards instead
2. **Don't duplicate types** - Import and extend existing types
3. **Don't use `namespace`** - Use ES modules with explicit exports
4. **Don't mix type and value exports** - Keep `.d.ts` files type-only

## Key Type References

### SalesforceConnection

```typescript
interface SalesforceConnection {
  id: string;              // UUID
  label: string;           // User-editable display name
  instanceUrl: string;     // https://org.my.salesforce.com
  loginDomain: string;     // login.salesforce.com or test.salesforce.com
  accessToken: string;     // OAuth access token
  refreshToken: string | null;  // OAuth refresh token (when using proxy)
  clientId: string | null;      // Per-connection OAuth client ID
  createdAt: number;       // Timestamp
  lastUsedAt: number;      // Timestamp
}
```

### QueryResult

```typescript
interface QueryResult<T = SObject> {
  totalSize: number;       // Total records matching query
  done: boolean;           // Whether all records returned
  records: T[];            // Array of records
  nextRecordsUrl?: string; // URL for next batch (if done: false)
}
```

### FieldType

```typescript
type FieldType =
  | 'string' | 'boolean' | 'int' | 'double'
  | 'date' | 'datetime' | 'time'
  | 'currency' | 'percent'
  | 'phone' | 'email' | 'url'
  | 'textarea' | 'html'
  | 'picklist' | 'multipicklist' | 'combobox'
  | 'reference' | 'id'
  | 'base64' | 'address' | 'location'
  | 'encryptedstring';
```
