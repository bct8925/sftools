---
title: SOQL Autocomplete
type: project
category: features
tags:
  - feature
  - soql
  - autocomplete
  - monaco
  - intelligent-completion
  - metadata
aliases:
  - SOQL Code Completion
  - Query Autocomplete
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/api/soql-autocomplete.ts
  - src/components/query/QueryEditor.tsx
  - src/api/salesforce.ts
confidence: high
---

# SOQL Autocomplete

## Purpose

Intelligent code completion for SOQL queries in the [[query-editor|Query Editor]], providing context-aware suggestions for Salesforce objects, fields, relationships, keywords, and functions through [[monaco-editor|Monaco Editor]].

## User Flow

1. User types in Query Editor (Monaco with `sql` language mode)
2. Autocomplete triggers on `.` (dot) or ` ` (space)
3. System detects cursor context (SELECT, FROM, WHERE, etc.)
4. Provides relevant suggestions based on context and FROM object metadata
5. User selects suggestion to complete code

### Example Completions

```sql
-- Typing in FROM clause
SELECT Id FROM Acc|
-- Shows: Account, AccountContactRelation, AccountHistory, etc.

-- Typing in SELECT clause (after FROM Account)
SELECT Name, |
-- Shows: Account fields, relationships (Owner, CreatedBy), aggregate functions

-- Typing relationship traversal
SELECT Account.|
-- Shows: Account fields + sub-relationships (Owner, Parent, etc.)

-- Typing in WHERE clause
WHERE CreatedDate = |
-- Shows: Fields, relationships, date literals (TODAY, YESTERDAY, LAST_N_DAYS:n)
```

## Implementation

### Architecture

**Singleton state** - `AutocompleteState` manages:
- `active` / `providerRegistered` - lifecycle flags
- `globalDescribe` - cached list of all org objects (lazy-loaded)
- `fromObject` - currently detected FROM object
- `fields` - fields of the FROM object
- `relationships` - Map of relationship metadata for traversal (keyed by relationshipName)

**SOQL parsing** - uses `@jetstreamapp/soql-parser-js` with `allowPartialQuery: true` to extract FROM object from incomplete queries.

**Monaco provider** - registers `CompletionItemProvider` for `sql` language with trigger chars `.` and ` `.

### Core Functions

| Function | Purpose |
|----------|---------|
| `parseSOQL(text)` | Parse SOQL with error tolerance |
| `extractFromObject(text)` | Detect FROM object in query |
| `detectClause(text, offset)` | Determine cursor context (SELECT, FROM, WHERE, etc.) via regex |
| `extractDotChain(text, offset)` | Extract relationship traversal (e.g., "Account.Owner.") |
| `resolveRelationshipChain(baseObject, chain)` | Async walk through relationship chain to target object |
| `loadFromObject(objectName)` | Load describe metadata + relationships with stale request detection |
| `registerSOQLCompletionProvider()` | Register Monaco completion provider (one-time) |

### Suggestion Types by Context

| Clause | Suggestions |
|--------|-------------|
| `SELECT` | Fields, relationships, aggregate functions (COUNT, SUM, AVG, etc.) |
| `FROM` | Queryable objects (from global describe, lazy-loaded) |
| `WHERE` / `HAVING` | Fields, relationships, date literals (TODAY, LAST_N_DAYS:n, etc.) |
| `ORDER BY` / `GROUP BY` | Fields, relationships |
| Dot chain (any clause) | Target object fields + sub-relationships |

### Data Sets

**SOQL_KEYWORDS** (22 keywords):
- SELECT, FROM, WHERE, AND, OR, NOT, IN, LIKE
- ORDER BY, GROUP BY, HAVING, LIMIT, OFFSET
- ASC, DESC, NULLS FIRST, NULLS LAST
- TRUE, FALSE, null, INCLUDES, EXCLUDES

**AGGREGATE_FUNCTIONS** (7 functions with snippets):
- COUNT(), COUNT(field), COUNT_DISTINCT(field)
- SUM(field), AVG(field), MIN(field), MAX(field)

**DATE_LITERALS** (21 date literals):
- TODAY, YESTERDAY, TOMORROW
- LAST_WEEK, THIS_WEEK, NEXT_WEEK
- LAST_MONTH, THIS_MONTH, NEXT_MONTH
- LAST_QUARTER, THIS_QUARTER, NEXT_QUARTER
- LAST_YEAR, THIS_YEAR, NEXT_YEAR
- LAST_N_DAYS:n, NEXT_N_DAYS:n, LAST_N_WEEKS:n, NEXT_N_WEEKS:n, LAST_N_MONTHS:n, NEXT_N_MONTHS:n

**UNIVERSAL_FIELDS** - shown before FROM object loaded:
- Id (id type)
- Name (string type)

### Field Type Icons

Maps Salesforce field types to Monaco `CompletionItemKind`:

| Field Type | Icon Kind |
|------------|-----------|
| Formula fields (calculated) | Constant |
| Reference fields | Reference |
| Boolean | Value |
| Picklist/Multi-picklist | Enum |
| ID | Keyword |
| Numeric (int, double, currency, percent) | Unit |
| Date/DateTime/Time | Event |
| Other | Field |

### Relationship Traversal

When user types `Account.Owner.`, the system:

1. Extracts dot chain: `["Account", "Owner"]`
2. Resolves chain starting from FROM object
3. For each segment, loads describe metadata if not cached
4. Finds field with matching `relationshipName`
5. Extracts `referenceTo[0]` as next object
6. Caches relationship metadata in `state.relationships` Map
7. Returns final target object fields + sub-relationships

### Stale Request Detection

Uses incrementing `fromObjectLoadId` to discard stale async loads:

```typescript
const thisLoadId = ++state.fromObjectLoadId;
// ... async load ...
if (thisLoadId !== state.fromObjectLoadId) return; // Discard
```

Prevents race conditions when FROM object changes rapidly.

## API Surface

```typescript
// Register provider (call once on editor init)
registerSOQLCompletionProvider(): void

// Enable/disable completions
activateSOQLAutocomplete(): void
deactivateSOQLAutocomplete(): void

// Clear state (on connection change)
clearState(): void
```

## Data Model

### AutocompleteState

```typescript
interface AutocompleteState {
  active: boolean;
  providerRegistered: boolean;
  globalDescribe: DescribeGlobalResult | null;
  globalDescribePromise: Promise<DescribeGlobalResult | null> | null;
  fromObject: string | null;
  fromObjectLoadId: number;
  fields: FieldDescribe[];
  relationships: Map<string, RelationshipMetadata>;
}
```

### RelationshipMetadata

```typescript
interface RelationshipMetadata {
  targetObject: string;
  fields: FieldDescribe[];
  relationshipName: string;
}
```

## Domain Concepts

- **Monaco Completion Provider** - VS Code-style autocomplete API provided by Monaco Editor
- **SOQL Context** - clause position in query (SELECT, FROM, WHERE, etc.)
- **Relationship Traversal** - walking through parent/child object references via dot notation
- **Global Describe** - [[salesforce-apis|Salesforce API]] metadata listing all objects in org
- **Object Describe** - [[salesforce-apis|Salesforce API]] metadata for single object (fields, relationships)
- **Trigger Characters** - characters that activate autocomplete (`.`, ` `)
- **Completion Item** - Monaco suggestion with label, kind, detail, documentation, insertText

Leverages [[salesforce-api-client|Salesforce API Client]] (`getGlobalDescribe`, `getObjectDescribe`) with per-connection caching.

## Edge Cases & Gotchas

### Partial Query Parsing
- Uses `allowPartialQuery: true` to parse incomplete queries
- Falls back to regex-based FROM extraction if parser fails
- Gracefully handles syntax errors during typing

### Lazy Loading
- Global describe loaded only when FROM clause is first accessed
- Uses promise caching to prevent duplicate loads
- Returns empty suggestions if describe not yet loaded

### Race Conditions
- Incrementing load ID prevents stale metadata from older FROM object
- Checks load ID before and after async operations
- Discards results if newer request started

### Relationship Caching
- Caches relationship metadata in Map for fast lookup
- Reloads target object describe for dot chain completions
- Cache cleared on connection change via `clearState()`

### Performance
- Parallel loading of relationship target objects (Promise.all)
- Suggest filtering by Monaco (built-in fuzzy matching)
- Minimal re-parsing (only on space/dot trigger)

### Context Detection
- Uses regex with word boundaries to handle newlines and whitespace
- Finds last occurrence of clause keyword before cursor
- Defaults to SELECT if no clause detected

## Testing

**Unit tests** should cover:
- SOQL parsing with `allowPartialQuery`
- FROM object extraction from partial queries
- Clause detection at various cursor positions
- Dot chain extraction from line text
- Relationship chain resolution with mock describes
- Stale request detection with load IDs

**Frontend tests** (Playwright):
- Monaco autocomplete triggering on `.` and ` `
- Completion item rendering by context
- FROM object metadata loading
- Relationship traversal suggestions
- Keyword and function suggestions
- Date literal suggestions in WHERE clause

**Integration** with [[query-editor|Query Editor]]:
- `activateSOQLAutocomplete()` called on editor mount
- `registerSOQLCompletionProvider()` called once
- `clearState()` called on connection change
- Monaco editor `sql` language mode required

---

**Related Entries:**
- [[query-editor|Query Editor]] - Host component for SOQL autocomplete
- [[monaco-editor|Monaco Editor]] - Code editor providing completion API
- [[salesforce-api-client|Salesforce API Client]] - Metadata retrieval
- [[salesforce-apis|Salesforce APIs]] - Describe APIs
- [[typescript-types|TypeScript Type Definitions]] - FieldDescribe, DescribeGlobalResult
