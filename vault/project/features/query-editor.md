---
title: Query Editor
type: project
category: features
tags:
  - feature
  - soql
  - query
  - monaco
  - bulk-api
  - csv-export
  - pagination
  - history
aliases:
  - SOQL Editor
  - Query Tab
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/query/
  - src/api/salesforce.ts
  - src/api/bulk-query.ts
  - src/api/soql-autocomplete.ts
  - src/lib/query-utils.ts
confidence: high
---

# Query Editor

## Overview

The Query tab provides a full-featured SOQL editor with [[monaco-editor|Monaco Editor]] syntax highlighting, SOQL autocomplete, tabbed results display, query history/favorites, pagination, and bulk query export via Salesforce Bulk API v2.

## How It Works

- **Monaco editor** with `sql` language mode and custom [[soql-autocomplete|SOQL autocomplete]] (`soql-autocomplete.ts`)
- **Ctrl/Cmd+Enter** to execute query
- **Tabbed results**: Each query opens a new result tab; tabs can be closed independently
- **Column metadata**: Parses query columns including nested relationships (e.g., `Account.Owner.Name`)
- **Pagination**: Automatic `fetchQueryMore()` for queries with `done: false`
- **Bulk export**: Large datasets exported via Bulk API v2 as CSV
- **History & Favorites**: Managed by `HistoryManager` class in `lib/history-manager.ts` using [[script-list-component|Script List Component Pattern]]

### SOQL Autocomplete

The Query Editor integrates a sophisticated [[soql-autocomplete|SOQL autocomplete]] system that provides context-aware suggestions in the Monaco editor:

- **Field completion**: After FROM object is detected, suggests all fields with type icons (formula → Constant, reference → Reference, boolean → Value, picklist → Enum, etc.)
- **Object completion**: In FROM clause, suggests all queryable objects from global describe (lazy-loaded)
- **Relationship traversal**: Typing `Account.` suggests Account's fields; `Account.Owner.` resolves to User fields
- **Aggregate functions**: COUNT, SUM, AVG, MIN, MAX with snippet insertion
- **Date literals**: 20 date literals (TODAY, LAST_N_DAYS:n, etc.) in WHERE/HAVING clauses
- **Context-aware keywords**: Keywords filtered by current clause (e.g., ASC/DESC only in ORDER BY)

Implementation: `src/api/soql-autocomplete.ts` registers a Monaco completion provider with trigger characters `.` and ` `.

### Complex State

Uses `useReducer` via `useQueryState.ts` hook for managing tabs, active tab, query text, and results.

### Key Components

| Component | Purpose |
|-----------|---------|
| `QueryTab.tsx` | Main tab orchestrator |
| `QueryEditor.tsx` | Monaco editor with autocomplete |
| `QueryTabs.tsx` | Result tab management |
| `QueryResults.tsx` | Results container |
| `QueryResultsTable.tsx` | Data table with column headers |
| `QueryHistory.tsx` | History/favorites dropdown |

## Key Files

- `src/components/query/` — All query components
- `src/api/salesforce.ts` — `executeQueryWithColumns`, `fetchQueryMore`
- `src/api/bulk-query.ts` — `executeBulkQueryExport`
- `src/lib/query-utils.ts` — `parseQueryResults`, `flattenColumnMetadata`, `formatCellValue`
- `src/api/soql-autocomplete.ts` — Monaco autocomplete provider

## Related

- [[overview|System Architecture Overview]]
- [[salesforce-api-client|Salesforce API Client]]
- [[monaco-editor|Monaco Editor]]
- [[soql-autocomplete|SOQL Autocomplete]]
- [[soql|SOQL]]
- [[component-architecture|Component Architecture]]
- [[salesforce-apis|Salesforce APIs]]
- [[typescript-types|TypeScript Type Definitions]]
- [[state-management|State Management]]
- [[utility-libraries|Utility Libraries]]
- [[script-list-component|Script List Component Pattern]]
- [[testing|Testing Framework]]
