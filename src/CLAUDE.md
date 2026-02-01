# src/ — Extension Source Code

> Architecture, patterns, and API reference for the extension source.
> For development rules and workflow, see the root [CLAUDE.md](../CLAUDE.md).

## Development Rules

### Code Quality (MUST)

- **MUST** write TypeScript in strict mode (all files `.ts` or `.tsx`)
- **MUST** use React functional components with hooks
- **MUST** use CSS Modules for component-scoped styling (`.module.css`)
- **MUST** use CSS variables for all colors, shadows, z-index, and radii
- **MUST** use `salesforceRequest()` for all Salesforce API calls
- **MUST** use context hooks (`useConnection`, `useTheme`, `useProxy`) for global state
- **MUST** include tests for new features (unit for lib/, frontend for UI)

### Best Practices (SHOULD)

- **SHOULD** use `useCallback` for event handlers passed to children
- **SHOULD** keep components under 300 lines; extract logic to custom hooks
- **SHOULD** use shared CSS classes from `style.css` before creating new ones
- **SHOULD** prefer early returns over nested conditionals
- **SHOULD** use semantic CSS variable names (purpose, not color)

### Anti-Patterns (MUST NOT)

- **MUST NOT** use `any` type without explicit justification
- **MUST NOT** bypass TypeScript errors with `@ts-ignore`
- **MUST NOT** hard-code colors, use `var(--variable-name)` instead
- **MUST NOT** store secrets in code — use Chrome storage or `.env.test`
- **MUST NOT** use inline styles — use CSS classes or CSS Modules

## Directory Structure

```
src/
├── components/           # React Components (37 TSX files)
│   ├── apex/             # Apex tab: ApexTab, ApexHistory, ApexOutput
│   ├── button-dropdown/  # ButtonDropdown.tsx
│   ├── button-icon/      # ButtonIcon.tsx
│   ├── events/           # Events tab: EventsTab, ChannelSelector, EventPublisher
│   ├── modal/            # Modal.tsx
│   ├── monaco-editor/    # MonacoEditor.tsx + useMonacoTheme hook
│   ├── query/            # Query tab: QueryTab, QueryEditor, QueryTabs, QueryResults, QueryResultsTable, QueryHistory
│   ├── record/           # Record Viewer: RecordPage, FieldRow, RichTextModal
│   ├── rest-api/         # REST API tab: RestApiTab
│   ├── schema/           # Schema Browser: SchemaPage, ObjectList, FieldList, FormulaEditor
│   ├── settings/         # Settings tab: SettingsTab, ConnectionList, ConnectionCard, EditConnectionModal, ThemeSettings, ProxySettings, CacheSettings
│   ├── sf-icon/          # SfIcon.tsx
│   ├── utils/            # Utils tab: UtilsTab
│   └── utils-tools/      # Utility tools: SearchBox, DebugLogs, FlowCleanup, SchemaBrowserLink
│
├── contexts/             # React Context API (3 providers)
│   ├── ConnectionContext.tsx  # Multi-org state
│   ├── ThemeContext.tsx       # Dark/light mode
│   └── ProxyContext.tsx       # Native messaging proxy
│
├── hooks/                # Custom React hooks
│   ├── useFilteredResults.ts
│   └── useStatusBadge.ts
│
├── react/                # App shell (8 TSX files)
│   ├── App.tsx           # Main tabbed interface
│   ├── AppProviders.tsx  # Context provider wrapper
│   ├── TabNavigation.tsx # Tab navigation
│   ├── ConnectionSelector.tsx
│   ├── MobileMenu.tsx
│   ├── index.tsx         # Main app entry
│   ├── record.tsx        # Record page entry
│   └── schema.tsx        # Schema page entry
│
├── api/                  # Salesforce API operations (8 TS files)
│   ├── salesforce.ts     # API operations (executeQuery, executeApex, etc.)
│   ├── salesforce-request.ts # Request wrapper with error handling
│   ├── fetch.ts          # Smart routing (proxy/extension)
│   ├── bulk-query.ts     # Bulk query export
│   ├── debug-logs.ts     # Debug log operations
│   ├── streaming.ts      # Streaming API
│   └── cors-detection.ts # CORS detection
│
├── auth/                 # Authentication & OAuth (4 TS files)
│   ├── auth.ts           # Multi-connection storage
│   ├── start-authorization.ts
│   └── oauth-credentials.ts
│
├── lib/                  # Shared utilities
│   ├── query-utils.ts    # SOQL parsing
│   ├── apex-utils.ts     # Apex execution
│   ├── record-utils.ts   # Field manipulation
│   ├── schema-utils.ts   # Metadata operations
│   ├── history-manager.ts
│   ├── theme.ts          # Dark/light mode
│   └── ...
│
├── types/                # TypeScript definitions
│   ├── salesforce.d.ts   # Salesforce API types
│   ├── vite-env.d.ts     # Vite environment types
│   └── components.d.ts   # Component types
│
├── pages/                # HTML entry points
│   ├── app/              # Main tabbed app
│   ├── callback/         # OAuth callback
│   ├── record/           # Record Viewer
│   └── schema/           # Schema Browser
│
├── background/           # Service worker (4 TS files)
│   ├── background.ts     # Message routing, context menu
│   ├── auth.ts           # Token exchange/refresh
│   ├── native-messaging.ts
│   └── debug.ts
│
├── public/               # Static assets
└── style.css             # Global styles + CSS variables
```

## Tool Tabs

| Tab | Purpose | Key Files |
|-----|---------|-----------|
| **Query** | SOQL editor with tabbed results | `components/query/QueryTab.tsx` |
| **Apex** | Anonymous Apex execution | `components/apex/ApexTab.tsx` |
| **REST API** | REST explorer with Monaco | `components/rest-api/RestApiTab.tsx` |
| **Events** | Streaming (requires proxy) | `components/events/EventsTab.tsx` |
| **Utils** | Debug logs, flow cleanup | `components/utils/UtilsTab.tsx` |
| **Settings** | Connections, appearance | `components/settings/SettingsTab.tsx` |

## Standalone Tools

| Tool | Purpose | Entry Point |
|------|---------|-------------|
| **Record Viewer** | View/edit record fields | `pages/record/record.html` |
| **Schema Browser** | Browse object metadata | `pages/schema/schema.html` |

## React Component Architecture

All components are React functional components with TypeScript.

### Component Structure

```typescript
// src/components/example/ExampleComponent.tsx
import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { salesforceRequest } from '../../api/salesforce-request';
import styles from './Example.module.css';

interface ExampleProps {
  initialValue?: string;
  onComplete?: (result: string) => void;
}

export function ExampleComponent({ initialValue = '', onComplete }: ExampleProps) {
  const { activeConnection, isAuthenticated } = useConnection();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string | null>(null);

  // Reset on connection change
  useEffect(() => {
    setData(null);
  }, [activeConnection?.id]);

  const handleAction = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    try {
      const result = await salesforceRequest('/services/data/v62.0/query', {
        params: { q: 'SELECT Id FROM Account LIMIT 10' }
      });
      setData(result);
      onComplete?.(result);
    } catch (error) {
      console.error('API error:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, onComplete]);

  return (
    <div className={styles.container}>
      <button
        className="button-brand"
        onClick={handleAction}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'Execute'}
      </button>
      {data && <div className={styles.results}>{data}</div>}
    </div>
  );
}
```

### CSS Module Pattern

```css
/* src/components/example/Example.module.css */
.container {
  padding: var(--spacing-md);
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
```

### Adding a New Tab

1. Create `src/components/<name>/`:
   - `<Name>Tab.tsx` - Component
   - `<Name>Tab.module.css` - Styles

2. Import in `src/react/App.tsx`:
   ```typescript
   import { NameTab } from '../components/<name>/<Name>Tab';
   ```

3. Add tab button and content in `App.tsx` render

### Adding a Standalone Page

1. Create `src/components/<name>/`:
   - `<Name>Page.tsx` - Component
   - `<Name>Page.module.css` - Styles

2. Create entry point `src/react/<name>.tsx`:
   ```typescript
   import { createRoot } from 'react-dom/client';
   import { AppProviders } from './AppProviders';
   import { NamePage } from '../components/<name>/<Name>Page';
   import { initTheme } from '../lib/theme';

   initTheme();
   const root = createRoot(document.getElementById('root')!);
   root.render(
     <AppProviders>
       <NamePage />
     </AppProviders>
   );
   ```

3. Create HTML shell `src/pages/<name>/<name>.html`

4. Add to `vite.config.ts` `rollupOptions.input`

## State Management

Three React Context providers manage global state:

### ConnectionContext

```typescript
import { useConnection } from '../contexts/ConnectionContext';

function MyComponent() {
  const {
    connections,           // All Salesforce connections
    activeConnection,      // Currently selected connection
    isAuthenticated,       // Has valid active connection
    isLoading,             // Loading connections
    setActiveConnection,   // Switch active connection
    addConnection,         // Add new connection
    updateConnection,      // Update connection details
    removeConnection,      // Remove connection
    refreshConnections,    // Reload from storage
  } = useConnection();
}
```

### ThemeContext

```typescript
import { useTheme } from '../contexts/ThemeContext';

function MyComponent() {
  const {
    theme,           // 'light' | 'dark' | 'system'
    effectiveTheme,  // 'light' | 'dark' (resolved)
    setTheme,        // Change theme preference
  } = useTheme();
}
```

### ProxyContext

```typescript
import { useProxy } from '../contexts/ProxyContext';

function MyComponent() {
  const {
    isConnected,    // Proxy connection status
    isConnecting,   // Currently connecting
    httpPort,       // Proxy HTTP port
    version,        // Proxy version
    error,          // Connection error
    connect,        // Connect to proxy
    disconnect,     // Disconnect from proxy
    checkStatus,    // Check connection status
  } = useProxy();
}
```

## Salesforce API Calls

Use `salesforceRequest` for all API operations:

```typescript
import { salesforceRequest } from '../api/salesforce-request';

// Query
const result = await salesforceRequest('/services/data/v62.0/query', {
  method: 'GET',
  params: { q: 'SELECT Id, Name FROM Account LIMIT 10' }
});

// Update record
await salesforceRequest(`/services/data/v62.0/sobjects/Account/${id}`, {
  method: 'PATCH',
  body: JSON.stringify({ Name: 'New Name' })
});

// Tooling API
const result = await salesforceRequest('/services/data/v62.0/tooling/query', {
  method: 'GET',
  params: { q: 'SELECT Id FROM ApexClass' }
});
```

### High-Level API Functions

```typescript
import {
  executeQuery,
  executeQueryWithColumns,
  executeBulkQueryExport,
  getObjectDescribe,
  executeApex,
  updateRecord,
  getRecord,
} from '../api/salesforce';
```

## Monaco Editor Component

The `<MonacoEditor>` wrapper provides a consistent editor experience:

```tsx
import { MonacoEditor, MonacoEditorRef } from '../components/monaco-editor/MonacoEditor';

function MyComponent() {
  const editorRef = useRef<MonacoEditorRef>(null);

  const handleExecute = useCallback(() => {
    const value = editorRef.current?.getValue();
    // Execute query...
  }, []);

  return (
    <MonacoEditor
      ref={editorRef}
      language="sql"
      value={initialQuery}
      onChange={setQuery}
      onExecute={handleExecute}  // Ctrl/Cmd+Enter
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
| `onChange` | `(value: string) => void` | Value change handler |
| `onExecute` | `() => void` | Ctrl/Cmd+Enter handler |
| `readonly` | `boolean` | Read-only mode |
| `className` | `string` | CSS class for container |

### Ref Methods

```typescript
interface MonacoEditorRef {
  getValue(): string;
  setValue(value: string): void;
  appendValue(value: string): void;
  clear(): void;
  setMarkers(markers: MarkerData[]): void;
  clearMarkers(): void;
  focus(): void;
}
```

## CSS Variables

All colors, shadows, and z-indexes use CSS variables. See `style.css` for definitions.

### Key Variables

```css
/* Colors */
--primary-color          /* Brand blue */
--bg-color               /* Page background */
--bg-secondary           /* Secondary background */
--card-bg                /* Card backgrounds */
--text-main              /* Primary text */
--text-muted             /* Secondary text */
--border-color           /* Borders */
--error-color            /* Errors */
--success-color          /* Success */

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg

/* Z-index scale */
--z-dropdown: 100
--z-sticky: 200
--z-modal-backdrop: 900
--z-modal: 1000
--z-toast: 1100

/* Border radius */
--radius-sm: 3px
--radius-md: 4px
--radius-lg: 8px

/* Spacing */
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
```

### Theming Rules

```css
/* GOOD - use CSS variables */
.my-component {
  background: var(--card-bg);
  color: var(--text-muted);
  box-shadow: 0 4px 12px var(--shadow-lg);
}

/* BAD - never hard-code */
.my-component {
  background: #ffffff;
  color: #666;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

## Shared CSS Classes

Prefer these shared classes from `style.css`:

| Pattern | Classes |
|---------|---------|
| Cards | `.card`, `.card-header`, `.card-body`, `.card-header-icon` |
| Buttons | `.button-brand`, `.button-neutral` |
| Inputs | `.input`, `.select`, `.search-input` |
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Status | `.status-badge[data-status="loading/success/error"]` |

## TypeScript Configuration

Strict mode is enabled with all strict checks:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

### Key Types (types/)

```typescript
// salesforce.d.ts
interface SalesforceConnection {
  id: string;
  label: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null;
}

interface QueryResult<T = SObject> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}

interface SObject {
  Id: string;
  attributes: { type: string; url: string };
  [key: string]: unknown;
}
```

## OAuth & Multi-Connection

Supports multiple Salesforce connections with per-instance active connection.

### Storage Schema

```typescript
{
  connections: SalesforceConnection[];
  activeConnectionId: string;
}
```

### OAuth Flows

- **Without Proxy**: Implicit flow (`response_type=token`)
- **With Proxy**: Authorization code flow with token refresh

## Background Service Worker

Handler map pattern for message routing:

```typescript
// background/background.ts
const handlers: Record<string, Handler> = {
  fetch: handleFetch,
  subscribe: handleSubscribe,
  // ...
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = handlers[request.type];
  if (handler) {
    handler(request).then(sendResponse);
    return true; // async response
  }
});
```
