---
title: Component Architecture
type: project
category: architecture
tags:
  - architecture
  - react
  - components
  - css-modules
aliases:
  - Component Patterns
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/
  - src/react/
confidence: high
---

# Component Architecture

## Overview

All UI is built with [[React]] 19 functional components using [[TypeScript]] strict mode. Components use CSS Modules for scoped styling and CSS variables for theming. Global state is accessed via context hooks (`useConnection`, `useTheme`, `useProxy`).

## How It Works

### Component Types

| Type | Pattern | Location | Example |
|------|---------|----------|---------|
| Tab | `*Tab.tsx` | `components/<name>/` | `QueryTab.tsx` |
| Standalone Page | `*Page.tsx` | `components/<name>/` | `RecordPage.tsx` |
| Utility Tool | `*.tsx` | `components/utils-tools/` | `DebugLogs.tsx` |
| Reusable | `*.tsx` | `components/<name>/` | `MonacoEditor.tsx`, `Modal.tsx` |

### Component Directory Layout

```
components/
├── query/              # Most complex - SOQL editor with tabbed results
│   ├── QueryTab.tsx    # Main component
│   ├── QueryEditor.tsx # Monaco editor with autocomplete
│   ├── QueryTabs.tsx   # Result tab management
│   ├── QueryResults.tsx / QueryResultsTable.tsx
│   ├── QueryHistory.tsx
│   ├── useQueryState.ts # useReducer state hook
│   └── QueryTab.module.css
├── apex/               # Apex execution with history
├── rest-api/           # REST API explorer
├── events/             # Event streaming (proxy required)
├── record/             # Record Viewer standalone page
├── schema/             # Schema Browser standalone page
├── settings/           # Multi-section settings (7 components)
├── utils/ + utils-tools/ # Utility tools
├── monaco-editor/      # Monaco editor wrapper
├── modal/              # Reusable modal
├── button-dropdown/    # Dropdown button
├── button-icon/        # Icon button
├── sf-icon/            # Salesforce icon component
└── status-badge/       # Status indicator
```

### Standard Component Pattern

```typescript
import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { salesforceRequest } from '../../api/salesforce-request';
import styles from './Example.module.css';

interface ExampleProps { initialValue?: string; }

export function ExampleComponent({ initialValue = '' }: ExampleProps) {
  const { activeConnection, isAuthenticated } = useConnection();
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset on connection change
  useEffect(() => { setData(null); setError(null); }, [activeConnection?.id]);

  const handleAction = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true); setError(null);
    try {
      const result = await salesforceRequest('/services/data/v62.0/query', {
        params: { q: 'SELECT Id FROM Account LIMIT 10' }
      });
      setData(result);
    } catch (err) { setError((err as Error).message); }
    finally { setIsLoading(false); }
  }, [isAuthenticated]);

  return (
    <div className={styles.container}>
      <button className="button-brand" onClick={handleAction} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Execute'}
      </button>
      {error && <div className={styles.error}>{error}</div>}
      {data && <div className={styles.results}>{data}</div>}
    </div>
  );
}
```

### CSS Module Pattern

```css
.container { padding: var(--spacing-md); }
.results {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}
/* NEVER hard-code colors — always use CSS variables */
```

### Shared CSS Classes (from `style.css`)

| Pattern | Classes |
|---------|---------|
| Cards | `.card`, `.card-header`, `.card-body`, `.card-header-icon` |
| Buttons | `.button-brand`, `.button-neutral` |
| Inputs | `.input`, `.select`, `.search-input` |
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Status | `.status-badge[data-status="loading/success/error"]` |

### Monaco Editor Component

Reusable wrapper at `components/monaco-editor/MonacoEditor.tsx`:

- Languages: `sql`, `apex`, `json`, `text`
- Uncontrolled value (use ref methods for updates)
- `onExecute` handler for Ctrl/Cmd+Enter
- Ref methods: `getValue()`, `setValue()`, `appendValue()`, `clear()`, `setMarkers()`, `clearMarkers()`, `focus()`

### Complex State with useReducer

For complex components (e.g., QueryTab), state is managed via `useReducer` in a custom hook (`useQueryState.ts`):

```typescript
type Action = { type: 'ADD_TAB'; payload: Tab } | { type: 'SET_ACTIVE'; payload: string };
function reducer(state: State, action: Action): State { ... }
export function useQueryState() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // ... return memoized action creators
}
```

## Key Files

- `src/components/` — All feature components
- `src/react/App.tsx` — Main tabbed app
- `src/react/AppProviders.tsx` — Context provider wrapper
- `src/style.css` — Global styles + CSS variables

## Related

- [[overview|System Architecture Overview]]
- [[state-management|State Management]]
- [[css-variables-theming|CSS Variables and Theming]]
- [[React]]
- [[monaco-editor|Monaco Editor]]
- [[query-editor|Query Editor]]
- [[salesforce-api-client|Salesforce API Client]]
- [[typescript-types|TypeScript Type Definitions]]

## Notes

### Required Patterns (MUST)
- TypeScript strict mode, functional components with hooks
- CSS Modules for scoped styling (`.module.css`)
- CSS variables for all colors, shadows, z-index, radii
- `salesforceRequest()` for all API calls
- `useCallback` for event handlers passed to children
- Reset component state on `activeConnection?.id` change
- Components under 300 lines; extract logic to custom hooks

### Anti-Patterns (MUST NOT)
- `any` type without justification
- `@ts-ignore` to bypass TypeScript
- Hard-coded colors (use `var(--variable-name)`)
- Inline styles (use CSS classes or CSS Modules)
- Secrets in code
