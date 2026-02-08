---
title: Query Editor
type: project
category: features
tags:
  - feature
  - soql
  - query
  - monaco
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
  - src/lib/query-utils.ts
confidence: high
---

# Query Editor

## Overview

The Query tab provides a full-featured SOQL editor with [[monaco-editor|Monaco Editor]] syntax highlighting, SOQL autocomplete, tabbed results display, query history/favorites, pagination, and bulk query export via Salesforce Bulk API v2.

## How It Works

- **Monaco editor** with `sql` language mode and custom SOQL autocomplete (`soql-autocomplete.ts`)
- **Ctrl/Cmd+Enter** to execute query
- **Tabbed results**: Each query opens a new result tab; tabs can be closed independently
- **Column metadata**: Parses query columns including nested relationships (e.g., `Account.Owner.Name`)
- **Pagination**: Automatic `fetchQueryMore()` for queries with `done: false`
- **Bulk export**: Large datasets exported via Bulk API v2 as CSV
- **History & Favorites**: Managed by `HistoryManager` class in `lib/history-manager.ts`

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
- [[component-architecture|Component Architecture]]
