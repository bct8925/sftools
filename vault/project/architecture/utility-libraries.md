---
title: Utility Libraries
type: project
category: architecture
tags:
  - utilities
  - lib
  - helpers
aliases:
  - lib/
  - Shared Utilities
created: 2026-02-08
updated: 2026-02-28
status: active
related-code:
  - src/lib/
confidence: high
---

# Utility Libraries

## Overview

`src/lib/` contains shared TypeScript utility functions organized by domain. These are pure helpers used across components, separate from the API layer (`src/api/`) and auth layer (`src/auth/`).

## How It Works

### Module Overview

| File | Purpose | Key Exports |
|------|---------|-------------|
| `query-utils.ts` | SOQL parsing | `parseQueryResults`, `flattenColumnMetadata`, `formatCellValue`, `normalizeQuery` |
| `apex-utils.ts` | Apex helpers | `parseCompileError`, `formatDebugLog` |
| `record-utils.ts` | Record manipulation | `sortFields`, `getFieldValue` |
| `schema-utils.ts` | Metadata helpers | `formatFieldType`, `isFormulaField` |
| `rest-api-utils.ts` | REST request building | `buildRequestUrl`, `parseResponse` |
| `settings-utils.ts` | Settings storage | `getSettings`, `updateSettings` |
| `events-utils.ts` | Event subscription | `parseChannel`, `formatEvent` |
| `history-manager.ts` | Query/Apex history | `HistoryManager` class (history + favorites) |
| `theme.ts` | Dark/light mode | `initTheme`, `setTheme`, `getTheme`, `onThemeChange` |
| `background-utils.ts` | Service worker helpers | `sendToBackground` |
| `column-utils.ts` | Column manipulation | Column helpers for query results |
| `csv-utils.ts` | CSV export | CSV formatting for export |
| `date-utils.ts` | Date formatting | Date display helpers |
| `value-utils.ts` | Value formatting | Value display helpers |
| `text-utils.ts` | Text formatting | `truncate`, `formatNumber` |
| `icons.ts` | Icon mapping | `getIconSvg` |
| `debug.ts` | Debug utilities | Debug helpers |
| `app-utils.ts` | App utilities | App-specific helpers |
| `monaco-custom.js` | Monaco editor | Custom language support (SOQL) |

### HistoryManager

Class-based manager for query/apex history with Chrome storage persistence. Includes a `loaded` flag and `ensureLoaded()` method — storage is read before any write to prevent overwriting existing history on first save after reopening the extension.

```typescript
const history = new HistoryManager('query'); // or 'apex'
await history.addEntry({ content: 'SELECT Id FROM Account', label: 'All Accounts' });
const entries = await history.getHistory(10);
const favorites = await history.getFavorites();
await history.addFavorite({ content: '...', label: 'My Query' });
const results = await history.search('account');
```

### Custom Hooks (`src/hooks/`)

| Hook | Purpose |
|------|---------|
| `useFilteredResults` | Debounced text filtering state |
| `useToast` | Access ToastContext (show/update/dismiss notifications) |

Hooks used by a single component are colocated (e.g., `query/useQueryState.ts`).

### Dead Code Detection

Dead code analysis is driven by `scripts/dead-code.sh`. To keep test-only exports out of dead-code results without polluting production modules, they live in `.testing.ts` companion files (e.g., `fetch.testing.ts` re-exports internals from `fetch.ts`). Production code imports from the main module; test code imports from the `.testing` companion. When adding a new test-only export, add it to the corresponding `.testing.ts` file (create one if needed).

## Key Files

- `src/lib/` — All utility modules
- `src/hooks/` — Shared React hooks

## Related

- [[component-architecture|Component Architecture]]
- [[salesforce-api-client|Salesforce API Client]]
- [[overview|System Architecture Overview]]
- [[query-editor|Query Editor]]
- [[apex-executor|Apex Executor]]
- [[typescript-types|TypeScript Type Definitions]]
- [[css-variables-theming|CSS Variables and Theming]]

## Notes

- `utils.ts` is a deprecated central re-export point — import directly from specific files
- Prefer pure functions for easier testing
- Use generics for type-safe helpers
- All files use TypeScript strict mode
- Import types with `import type { ... }` from `src/types/salesforce.d.ts`
