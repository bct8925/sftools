# Components - sftools

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

All UI components are **React functional components** with TypeScript. Components use CSS Modules for scoped styling and React Context for global state.

## Component Types

| Type | Pattern | Location | Example |
|------|---------|----------|---------|
| **Tab** | `*Tab.tsx` | `components/<name>/` | `QueryTab.tsx` |
| **Standalone Page** | `*Page.tsx` | `components/<name>/` | `RecordPage.tsx` |
| **Utility Tool** | `*.tsx` | `components/utils-tools/` | `DebugLogs.tsx` |
| **Reusable** | `*.tsx` | `components/<name>/` | `MonacoEditor.tsx` |

## Directory Structure

```
components/
├── apex/                 # Apex tab
│   ├── ApexTab.tsx       # Main component
│   ├── ApexHistory.tsx   # History dropdown
│   ├── ApexOutput.tsx    # Execution output
│   └── ApexTab.module.css
│
├── button-dropdown/      # Reusable dropdown
│   └── ButtonDropdown.tsx
│
├── button-icon/          # Reusable icon button
│   ├── ButtonIcon.tsx
│   └── ButtonIcon.module.css
│
├── events/               # Events tab
│   ├── EventsTab.tsx     # Main component
│   ├── ChannelSelector.tsx
│   ├── EventPublisher.tsx
│   └── EventsTab.module.css
│
├── modal/                # Reusable modal
│   ├── Modal.tsx
│   └── Modal.module.css
│
├── monaco-editor/        # Monaco wrapper
│   ├── MonacoEditor.tsx
│   └── MonacoEditor.module.css
│
├── query/                # Query tab (most complex)
│   ├── QueryTab.tsx      # Main component
│   ├── QueryEditor.tsx   # SOQL editor with autocomplete
│   ├── QueryTabs.tsx     # Result tab management
│   ├── QueryResults.tsx  # Results container
│   ├── QueryResultsTable.tsx # Data table
│   ├── QueryHistory.tsx  # History dropdown
│   ├── useQueryState.ts  # State hook with useReducer
│   └── QueryTab.module.css
│
├── record/               # Record Viewer (standalone)
│   ├── RecordPage.tsx    # Main component
│   ├── FieldRow.tsx      # Individual field editor
│   ├── RichTextModal.tsx # Rich text field modal
│   └── RecordPage.module.css
│
├── rest-api/             # REST API tab
│   ├── RestApiTab.tsx
│   └── RestApiTab.module.css
│
├── schema/               # Schema Browser (standalone)
│   ├── SchemaPage.tsx    # Main component
│   ├── ObjectList.tsx    # Object sidebar
│   ├── FieldList.tsx     # Field details
│   ├── FormulaEditor.tsx # Formula viewer
│   └── SchemaPage.module.css
│
├── settings/             # Settings tab
│   ├── SettingsTab.tsx   # Main component
│   ├── ConnectionList.tsx
│   ├── ConnectionCard.tsx
│   ├── EditConnectionModal.tsx
│   ├── ThemeSettings.tsx
│   ├── ProxySettings.tsx
│   ├── CacheSettings.tsx
│   └── SettingsTab.module.css
│
├── sf-icon/              # Icon component
│   └── SfIcon.tsx
│
├── utils/                # Utils tab container
│   ├── UtilsTab.tsx
│   └── UtilsTab.module.css
│
├── utils-tools/          # Individual utilities
│   ├── SearchBox.tsx
│   ├── DebugLogs.tsx
│   ├── FlowCleanup.tsx
│   ├── SchemaBrowserLink.tsx
│   └── UtilsTools.module.css
│
└── index.ts              # Barrel exports
```

## Component Pattern

### Standard Component Template

```typescript
// src/components/example/ExampleTab.tsx
import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts';
import { salesforceRequest } from '../../lib/salesforce-request';
import styles from './ExampleTab.module.css';

interface ExampleTabProps {
  initialValue?: string;
}

export function ExampleTab({ initialValue = '' }: ExampleTabProps) {
  // Global state from contexts
  const { activeConnection, isAuthenticated } = useConnection();

  // Local state
  const [data, setData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on connection change
  useEffect(() => {
    setData(null);
    setError(null);
  }, [activeConnection?.id]);

  // Load data on mount (if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  // Handlers wrapped in useCallback
  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await salesforceRequest('/services/data/v62.0/endpoint');
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const handleClick = useCallback(() => {
    loadData();
  }, [loadData]);

  return (
    <div className={styles.container}>
      <div className="card">
        <div className="card-header">
          <div className="card-header-icon" style={{ backgroundColor: '#0070d2' }}>
            E
          </div>
          <h2>Example</h2>
        </div>
        <div className="card-body">
          {error && <div className={styles.error}>{error}</div>}
          {data && <div className={styles.results}>{data}</div>}
          <button
            className="button-brand"
            onClick={handleClick}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Execute'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### CSS Module Template

```css
/* src/components/example/ExampleTab.module.css */

.container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.results {
  background: var(--bg-secondary);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
}

.results:hover {
  background: var(--bg-hover);
}

.error {
  color: var(--error-color);
  padding: var(--spacing-sm);
  background: var(--error-bg);
  border-radius: var(--radius-sm);
}

/* ALWAYS use CSS variables - NEVER hard-code colors */
/* BAD: color: #333; */
/* GOOD: color: var(--text-main); */
```

## Monaco Editor Component

The `<MonacoEditor>` wrapper provides a consistent editor experience with React:

### Usage

```tsx
import { useRef, useCallback } from 'react';
import { MonacoEditor, MonacoEditorRef } from '../monaco-editor/MonacoEditor';

function MyComponent() {
  const editorRef = useRef<MonacoEditorRef>(null);

  const handleExecute = useCallback(() => {
    const value = editorRef.current?.getValue();
    console.log('Execute:', value);
  }, []);

  return (
    <MonacoEditor
      ref={editorRef}
      language="sql"
      value="SELECT Id FROM Account"
      onChange={(value) => console.log('Changed:', value)}
      onExecute={handleExecute}
      className={styles.editor}
    />
  );
}
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `language` | `'sql' \| 'apex' \| 'json' \| 'text'` | Editor language mode |
| `value` | `string` | Controlled value |
| `onChange` | `(value: string) => void` | Value change callback |
| `onExecute` | `() => void` | Ctrl/Cmd+Enter handler |
| `readonly` | `boolean` | Read-only mode |
| `className` | `string` | CSS class for container |

### Ref Methods

```typescript
interface MonacoEditorRef {
  getValue(): string;
  setValue(value: string): void;
  appendValue(value: string): void;  // Appends and scrolls to bottom
  clear(): void;
  setMarkers(markers: MarkerData[]): void;
  clearMarkers(): void;
  focus(): void;
}
```

### Error Markers

```typescript
editorRef.current?.setMarkers([{
  startLineNumber: 1,
  startColumn: 1,
  endLineNumber: 1,
  endColumn: 10,
  message: 'Error message',
  severity: 8  // MarkerSeverity.Error
}]);

// Clear markers
editorRef.current?.clearMarkers();
```

## Adding Components

### New Tab Component

1. **Create component folder**: `src/components/<name>/`

2. **Create files**:
   - `<Name>Tab.tsx` - Component
   - `<Name>Tab.module.css` - Styles

3. **Import in App.tsx**:
   ```typescript
   // src/react/App.tsx
   import { NameTab } from '../components/<name>/<Name>Tab';
   ```

4. **Add to App.tsx render**:
   ```tsx
   // In tab buttons
   <button
     className={`tab-link ${activeTab === 'name' ? 'active' : ''}`}
     onClick={() => setActiveTab('name')}
   >
     Tab Name
   </button>

   // In tab content
   {activeTab === 'name' && <NameTab />}
   ```

### New Standalone Page

1. **Create component folder**: `src/components/<name>/`

2. **Create component files**:
   - `<Name>Page.tsx` - Component
   - `<Name>Page.module.css` - Styles

3. **Create entry point**: `src/react/<name>.tsx`

   ```typescript
   import { createRoot } from 'react-dom/client';
   import { AppProviders } from './AppProviders';
   import { NamePage } from '../components/<name>/<Name>Page';
   import { initTheme } from '../lib/theme';
   import '../style.css';

   initTheme();

   const container = document.getElementById('root');
   if (container) {
     const root = createRoot(container);
     root.render(
       <AppProviders>
         <NamePage />
       </AppProviders>
     );
   }
   ```

4. **Create HTML shell**: `src/pages/<name>/<name>.html`

   ```html
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <title>Tool Name - sftools</title>
       <link rel="stylesheet" href="../../style.css">
   </head>
   <body>
       <div id="root"></div>
       <script type="module" src="../../react/<name>.tsx"></script>
   </body>
   </html>
   ```

5. **Add to vite.config.ts**:
   ```typescript
   rollupOptions: {
       input: {
           // ...existing entries
           <name>: resolve(__dirname, 'src/pages/<name>/<name>.html'),
       }
   }
   ```

### New Utility Tool

1. **Create files in utils-tools/**:
   - `<Name>.tsx` - Component

2. **Import in UtilsTab.tsx**:
   ```typescript
   import { Name } from '../utils-tools/<Name>';
   ```

3. **Add to UtilsTab render**:
   ```tsx
   <Name />
   ```

## Required Patterns

### Context Hook Usage

**MUST** use context hooks for global state:

```typescript
import { useConnection, useTheme, useProxy } from '../../contexts';

function MyComponent() {
  const { activeConnection, isAuthenticated } = useConnection();
  const { effectiveTheme } = useTheme();
  const { isConnected } = useProxy();

  // Use these values in your component
}
```

### Connection Change Handling

**MUST** reset component state when connection changes:

```typescript
function MyComponent() {
  const { activeConnection } = useConnection();
  const [data, setData] = useState(null);

  // Reset on connection change
  useEffect(() => {
    setData(null);
    // Optionally reload data for new org
  }, [activeConnection?.id]);
}
```

### useCallback for Event Handlers

**MUST** wrap event handlers in useCallback when passed to children:

```typescript
// GOOD - prevents unnecessary re-renders
const handleClick = useCallback(() => {
  doSomething();
}, [dependency]);

// BAD - creates new function on every render
const handleClick = () => {
  doSomething();
};

return <Child onClick={handleClick} />;
```

### CSS Variable Usage

**MUST** use CSS variables for all visual properties:

```css
/* CORRECT */
.my-component {
  background: var(--card-bg);
  color: var(--text-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-sm);
}

/* INCORRECT - hard-coded values */
.my-component {
  background: #ffffff;
  color: #333333;
  border: 1px solid #dddddd;
  border-radius: 4px;
  padding: 8px;
}
```

## Common Patterns

### Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleAction = useCallback(async () => {
  setIsLoading(true);
  try {
    await doAsyncWork();
  } finally {
    setIsLoading(false);
  }
}, []);

return (
  <button disabled={isLoading} onClick={handleAction}>
    {isLoading ? 'Loading...' : 'Execute'}
  </button>
);
```

### Error Handling

```typescript
const [error, setError] = useState<string | null>(null);

const handleAction = useCallback(async () => {
  setError(null);
  try {
    await doAsyncWork();
  } catch (err) {
    setError((err as Error).message);
  }
}, []);

return (
  <>
    {error && <div className={styles.error}>{error}</div>}
    <button onClick={handleAction}>Execute</button>
  </>
);
```

### API Calls

```typescript
import { salesforceRequest } from '../../lib/salesforce-request';

const fetchData = useCallback(async () => {
  try {
    const result = await salesforceRequest('/services/data/v62.0/query', {
      method: 'GET',
      params: { q: 'SELECT Id FROM Account' }
    });
    return result;
  } catch (error) {
    // Error already parsed by salesforceRequest
    setError((error as Error).message);
    throw error;
  }
}, []);
```

### Complex State with useReducer

For components with complex state (like QueryTab), use useReducer:

```typescript
// useExampleState.ts
interface State {
  tabs: Tab[];
  activeTabId: string | null;
}

type Action =
  | { type: 'ADD_TAB'; payload: Tab }
  | { type: 'REMOVE_TAB'; payload: string }
  | { type: 'SET_ACTIVE'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TAB':
      return { ...state, tabs: [...state.tabs, action.payload] };
    case 'REMOVE_TAB':
      return { ...state, tabs: state.tabs.filter(t => t.id !== action.payload) };
    case 'SET_ACTIVE':
      return { ...state, activeTabId: action.payload };
    default:
      return state;
  }
}

export function useExampleState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const addTab = useCallback((tab: Tab) => {
    dispatch({ type: 'ADD_TAB', payload: tab });
  }, []);

  return { state, addTab, /* ... */ };
}
```

### Refs for Imperative Actions

```typescript
import { useRef, useImperativeHandle, forwardRef } from 'react';

export interface ComponentRef {
  focus(): void;
  getValue(): string;
}

export const Component = forwardRef<ComponentRef, Props>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    getValue: () => inputRef.current?.value || '',
  }));

  return <input ref={inputRef} />;
});
```

## Shared CSS Classes

Use these from `style.css` before creating new ones:

| Pattern | Classes |
|---------|---------|
| Cards | `.card`, `.card-header`, `.card-body`, `.card-header-icon` |
| Buttons | `.button-brand`, `.button-neutral` |
| Inputs | `.input`, `.select`, `.search-input` |
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Status | `.status-badge[data-status="loading/success/error"]` |

## CSS Module Specificity

When component CSS needs to override global styles, use more specific selectors:

```css
/* In QueryTab.module.css - overrides global .card-body */
.cardBody {
  padding: 0;
}

/* Use composes for combining with global classes */
.customButton {
  composes: button-brand from global;
  width: 100%;
}
```

## TypeScript Patterns

### Props Interface

```typescript
interface ComponentProps {
  // Required props
  value: string;
  onChange: (value: string) => void;

  // Optional props with defaults
  disabled?: boolean;
  className?: string;

  // Children
  children?: React.ReactNode;
}

export function Component({
  value,
  onChange,
  disabled = false,
  className = '',
  children,
}: ComponentProps) {
  // ...
}
```

### Event Handler Types

```typescript
// Input events
const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setValue(e.target.value);
};

// Click events
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.preventDefault();
  doAction();
};

// Keyboard events
const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') {
    submit();
  }
};
```

### Generic Components

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  keyExtractor: (item: T) => string;
}

export function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map((item) => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  );
}
```

## Examples

### Query Tab

See `query/QueryTab.tsx` for:
- Complex state management with useReducer (`useQueryState.ts`)
- Monaco editor integration
- Tabbed results display
- History/favorites dropdown
- Column metadata parsing

### Record Page

See `record/RecordPage.tsx` for:
- Standalone page pattern
- URL parameter parsing
- Field editing with dirty tracking
- Save/refresh functionality

### Settings Tab

See `settings/SettingsTab.tsx` for:
- Multi-section layout
- Connection management
- Theme switching
- Proxy settings

### Debug Logs Tool

See `utils-tools/DebugLogs.tsx` for:
- Utility tool pattern
- User search
- Status indicators
- Tooling API usage
