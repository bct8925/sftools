# React Migration Plan

> **Status:** In Progress
> **Started:** 2026-01-23
> **Branch:** `typescript` (continuing from TS migration)

## Overview

Incremental migration from Web Components to React for the sftools Chrome extension. Web Components and React coexist during migration, with cleanup at the end.

| Metric | Count |
|--------|-------|
| Components to migrate | ~17 |
| New React files | ~65 |
| Test files to update | ~45 |

**Approach:**
- CSS Modules for component styles
- React Context for global state (connections, theme, proxy)
- @monaco-editor/react instead of custom wrapper
- Keep Playwright E2E tests, update selectors

---

## Progress Tracker

### Phase 1: Foundation Setup
- [x] Install React dependencies
- [x] Configure Vite for React (@vitejs/plugin-react)
- [x] Update tsconfig.json for JSX
- [x] Create `src/contexts/ConnectionContext.tsx`
- [x] Create `src/contexts/ThemeContext.tsx`
- [x] Create `src/contexts/ProxyContext.tsx`
- [x] Create `src/hooks/index.ts` (re-exports hooks from contexts)
- [x] Create `src/contexts/index.ts` (barrel export)
- [x] Add `getTheme` and `setTheme` to `src/lib/theme.ts`
- [x] Verify: build succeeds, contexts provide values

### Phase 2: Wave 1 - Simple Reusable Components
- [x] `src/components/sf-icon/SfIcon.tsx`
- [x] `src/components/sf-icon/SfIcon.module.css`
- [x] `src/components/modal-popup/Modal.tsx`
- [x] `src/components/modal-popup/Modal.module.css`
- [x] `src/components/button-icon/ButtonIcon.tsx`
- [x] `src/components/button-icon/ButtonIcon.module.css`
- [x] `src/components/button-dropdown/ButtonDropdown.tsx`
- [x] `src/components/button-dropdown/ButtonDropdown.module.css`
- [x] `src/components/index.ts` (barrel export)
- [x] Verify: build succeeds, types check

### Phase 2: Wave 2 - Monaco Editor
- [x] `src/components/monaco-editor/MonacoEditor.tsx`
- [x] `src/components/monaco-editor/MonacoEditor.module.css`
- [x] `src/components/monaco-editor/useMonacoTheme.ts`
- [x] Implement forwardRef with imperative handle
- [x] Add Ctrl+Enter execute via onExecute prop
- [x] Add resize handle functionality
- [x] Integrate with ThemeContext (via useMonacoTheme hook)
- [x] Uses @monaco-editor/react with custom Monaco instance
- [x] Verify: build succeeds, types check

### Phase 2: Wave 3 - Utils Tab Tools
- [x] `src/components/utils-tools/SearchBox.tsx` + `.module.css`
- [x] `src/components/utils-tools/SchemaBrowserLink.tsx`
- [x] `src/components/utils-tools/DebugLogs.tsx` + `.module.css`
- [x] `src/components/utils-tools/FlowCleanup.tsx` + `.module.css`
- [x] Verify: build succeeds, types check

### Phase 2: Wave 4 - Settings Tab
- [x] `src/components/settings/ConnectionList.tsx` + `.module.css`
- [x] `src/components/settings/ConnectionCard.tsx` + `.module.css`
- [x] `src/components/settings/ProxySettings.tsx` + `.module.css`
- [x] `src/components/settings/ThemeSettings.tsx` + `.module.css`
- [x] `src/components/settings/CacheSettings.tsx` + `.module.css`
- [x] `src/components/settings/EditConnectionModal.tsx` + `.module.css`
- [x] `src/components/settings/SettingsTab.tsx` + `.module.css`
- [x] Verify: build succeeds, types check

### Phase 2: Wave 5 - Simple Tabs
- [x] `src/components/rest-api/RestApiTab.tsx` + `.module.css`
- [x] `src/components/utils/UtilsTab.tsx` + `.module.css`
- [x] Verify: build succeeds, types check

### Phase 2: Wave 6 - Events Tab
- [x] `src/components/events/ChannelSelector.tsx`
- [x] `src/components/events/EventPublisher.tsx`
- [x] `src/components/events/EventsTab.tsx` + `.module.css`
- [x] Handle chrome.runtime message listeners with useEffect
- [x] Verify: build succeeds, types check

### Phase 2: Wave 7 - Apex Tab
- [x] `src/components/apex/ApexHistory.tsx`
- [x] `src/components/apex/ApexOutput.tsx`
- [x] `src/components/apex/ApexTab.tsx` + `.module.css`
- [x] Integrate HistoryManager with useMemo
- [x] Verify: build succeeds, types check

### Phase 2: Wave 8 - Query Tab (Most Complex)
- [x] `src/components/query/useQueryState.ts` (useReducer for tab state)
- [x] `src/components/query/QueryEditor.tsx`
- [x] `src/components/query/QueryTabs.tsx`
- [x] `src/components/query/QueryResults.tsx`
- [x] `src/components/query/QueryResultsTable.tsx`
- [x] `src/components/query/QueryHistory.tsx`
- [x] `src/components/query/QueryTab.tsx` + `.module.css`
- [x] Integrate SOQL autocomplete
- [x] Verify: build succeeds, types check

### Phase 2: Wave 9 - Standalone Pages
- [x] `src/components/record/FieldRow.tsx`
- [x] `src/components/record/RichTextModal.tsx`
- [x] `src/components/record/RecordPage.tsx` + `.module.css`
- [x] `src/components/schema/ObjectList.tsx`
- [x] `src/components/schema/FieldList.tsx`
- [x] `src/components/schema/FormulaEditor.tsx`
- [x] `src/components/schema/SchemaPage.tsx` + `.module.css`
- [x] Verify: build succeeds, types check

### Phase 2: Wave 10 - App Shell Migration
- [x] `src/react/AppProviders.tsx` (context providers wrapper)
- [x] `src/react/TabNavigation.tsx` + `.module.css`
- [x] `src/react/ConnectionSelector.tsx` + `.module.css`
- [x] `src/react/MobileMenu.tsx` + `.module.css`
- [x] `src/react/App.tsx` + `.module.css` (main React app)
- [x] `src/react/index.tsx` (main app entry)
- [x] `src/react/record.tsx` (record page entry)
- [x] `src/react/schema.tsx` (schema page entry)
- [x] Update `src/pages/app/app.html` to mount React
- [x] Update `src/pages/record/record.html` to mount React
- [x] Update `src/pages/schema/schema.html` to mount React
- [x] Verify: build succeeds, types check

### Phase 3: Cleanup
- [ ] Delete Web Component files from `src/components/*/`
- [ ] Remove `customElements.define()` calls
- [ ] Delete `.html` template files
- [ ] Remove `?raw` imports
- [ ] Add `data-testid` attributes to key elements
- [ ] Update Playwright page objects for React selectors
- [ ] Final verification: all tests pass
- [ ] Remove unused dependencies

---

## Phase 1: Foundation Setup (Detailed)

### 1.1 Install Dependencies

```bash
npm install react react-dom @monaco-editor/react
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

### 1.2 Update vite.config.ts

```typescript
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // ... existing config
});
```

### 1.3 Update tsconfig.json

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    // ... existing options
  }
}
```

### 1.4 Create src/contexts/ConnectionContext.tsx

```typescript
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { SalesforceConnection } from '../types/salesforce';
import {
  loadConnections,
  setActiveConnection as setActiveConn,
  addConnection as addConn,
  updateConnection as updateConn,
  removeConnection as removeConn,
  getActiveConnectionId,
  isAuthenticated as checkAuth,
  onAuthExpired,
  triggerAuthExpired,
} from '../lib/auth.js';

interface ConnectionContextType {
  connections: SalesforceConnection[];
  activeConnection: SalesforceConnection | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setActiveConnection: (conn: SalesforceConnection | null) => void;
  addConnection: (data: Partial<SalesforceConnection> & { instanceUrl: string; accessToken: string }) => Promise<SalesforceConnection>;
  updateConnection: (id: string, updates: Partial<SalesforceConnection>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<SalesforceConnection[]>([]);
  const [activeConnection, setActiveConnectionState] = useState<SalesforceConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshConnections = useCallback(async () => {
    const conns = await loadConnections();
    setConnections(conns);

    const activeId = getActiveConnectionId();
    const active = conns.find(c => c.id === activeId) || null;
    setActiveConnectionState(active);
  }, []);

  useEffect(() => {
    refreshConnections().finally(() => setIsLoading(false));

    // Listen for storage changes from other tabs
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.connections) {
        refreshConnections();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [refreshConnections]);

  const setActiveConnection = useCallback((conn: SalesforceConnection | null) => {
    setActiveConn(conn);
    setActiveConnectionState(conn);
  }, []);

  const addConnection = useCallback(async (data: Partial<SalesforceConnection> & { instanceUrl: string; accessToken: string }) => {
    const newConn = await addConn(data);
    await refreshConnections();
    return newConn;
  }, [refreshConnections]);

  const updateConnection = useCallback(async (id: string, updates: Partial<SalesforceConnection>) => {
    await updateConn(id, updates);
    await refreshConnections();
  }, [refreshConnections]);

  const removeConnection = useCallback(async (id: string) => {
    await removeConn(id);
    await refreshConnections();
  }, [refreshConnections]);

  return (
    <ConnectionContext.Provider value={{
      connections,
      activeConnection,
      isAuthenticated: checkAuth(),
      isLoading,
      setActiveConnection,
      addConnection,
      updateConnection,
      removeConnection,
      refreshConnections,
    }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
}
```

### 1.5 Create src/contexts/ThemeContext.tsx

```typescript
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { initTheme, getTheme, setTheme as setThemeStorage } from '../lib/theme.js';

type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeValue;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeValue) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeValue>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    initTheme().then(() => {
      setThemeState(getTheme() as ThemeValue);
      updateEffectiveTheme();
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => updateEffectiveTheme();
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const updateEffectiveTheme = useCallback(() => {
    const current = getTheme();
    if (current === 'system') {
      setEffectiveTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      setEffectiveTheme(current as 'light' | 'dark');
    }
  }, []);

  const setTheme = useCallback(async (newTheme: ThemeValue) => {
    await setThemeStorage(newTheme);
    setThemeState(newTheme);
    updateEffectiveTheme();
  }, [updateEffectiveTheme]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

### 1.6 Create src/contexts/ProxyContext.tsx

```typescript
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { checkProxyStatus, isProxyConnected } from '../lib/fetch.js';

interface ProxyContextType {
  isConnected: boolean;
  isConnecting: boolean;
  httpPort: number | null;
  version: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  checkStatus: () => Promise<void>;
}

const ProxyContext = createContext<ProxyContextType | null>(null);

export function ProxyProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [httpPort, setHttpPort] = useState<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    const connected = await checkProxyStatus();
    setIsConnected(connected);
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });
      if (response.success) {
        setIsConnected(true);
        setHttpPort(response.httpPort || null);
        setVersion(response.version || null);
      } else {
        setError(response.error || 'Failed to connect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'disconnectProxy' });
      setIsConnected(false);
      setHttpPort(null);
      setVersion(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  }, []);

  return (
    <ProxyContext.Provider value={{
      isConnected,
      isConnecting,
      httpPort,
      version,
      error,
      connect,
      disconnect,
      checkStatus,
    }}>
      {children}
    </ProxyContext.Provider>
  );
}

export function useProxy() {
  const context = useContext(ProxyContext);
  if (!context) {
    throw new Error('useProxy must be used within ProxyProvider');
  }
  return context;
}
```

---

## React Component Migration Pattern

### Before (Web Component)

```typescript
import template from './example.html?raw';
import './example.css';
import { salesforceRequest } from '../../lib/salesforce-request.js';

class ExampleTab extends HTMLElement {
  private button!: HTMLButtonElement;
  private data: string[] = [];

  connectedCallback(): void {
    this.innerHTML = template;
    this.button = this.querySelector<HTMLButtonElement>('.example-button')!;
    this.button.addEventListener('click', this.handleClick);
    document.addEventListener('connection-changed', this.handleConnectionChange);
  }

  disconnectedCallback(): void {
    this.button.removeEventListener('click', this.handleClick);
    document.removeEventListener('connection-changed', this.handleConnectionChange);
  }

  private handleClick = async (): Promise<void> => {
    const result = await salesforceRequest('/services/data/v62.0/query', {
      params: { q: 'SELECT Id FROM Account' }
    });
    this.data = result.json.records;
    this.render();
  };

  private handleConnectionChange = (): void => {
    this.data = [];
    this.render();
  };

  private render(): void {
    const list = this.querySelector('.data-list')!;
    list.innerHTML = this.data.map(d => `<li>${d}</li>`).join('');
  }
}

customElements.define('example-tab', ExampleTab);
```

### After (React)

```typescript
import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { salesforceRequest } from '../../lib/salesforce-request.js';
import styles from './ExampleTab.module.css';

export function ExampleTab() {
  const { activeConnection, isAuthenticated } = useConnection();
  const [data, setData] = useState<string[]>([]);

  // Clear data when connection changes
  useEffect(() => {
    setData([]);
  }, [activeConnection?.id]);

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) return;

    const result = await salesforceRequest('/services/data/v62.0/query', {
      params: { q: 'SELECT Id FROM Account' }
    });
    setData(result.json.records);
  }, [isAuthenticated]);

  return (
    <div className={styles.exampleTab}>
      <button className={styles.exampleButton} onClick={handleClick}>
        Load Data
      </button>
      <ul className={styles.dataList}>
        {data.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
```

### Key Patterns

1. **CSS Modules**: `import styles from './Component.module.css'`
2. **Context instead of events**: `useConnection()` instead of `document.addEventListener('connection-changed')`
3. **useState for local state**: `const [data, setData] = useState([])`
4. **useEffect for connection changes**: `useEffect(() => { ... }, [activeConnection?.id])`
5. **useCallback for handlers**: Stable references, proper dependencies
6. **No cleanup needed**: React handles listener cleanup via useEffect return

---

## Monaco Editor React Pattern

```typescript
import { forwardRef, useImperativeHandle, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './MonacoEditor.module.css';

export interface MonacoEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
  appendValue: (text: string) => void;
  clear: () => void;
  setMarkers: (markers: editor.IMarkerData[]) => void;
  clearMarkers: () => void;
  focus: () => void;
  getEditor: () => editor.IStandaloneCodeEditor | null;
}

interface MonacoEditorProps {
  language?: 'sql' | 'apex' | 'json' | 'xml' | 'javascript' | 'text';
  value?: string;
  onChange?: (value: string) => void;
  onExecute?: () => void;
  readonly?: boolean;
  resizable?: boolean;
  className?: string;
}

export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(
  ({ language = 'text', value = '', onChange, onExecute, readonly = false, resizable = true, className }, ref) => {
    const { effectiveTheme } = useTheme();
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => editorRef.current?.getValue() ?? '',
      setValue: (val) => editorRef.current?.setValue(val),
      appendValue: (text) => {
        const ed = editorRef.current;
        if (ed) {
          const model = ed.getModel();
          if (model) {
            const lastLine = model.getLineCount();
            const lastCol = model.getLineMaxColumn(lastLine);
            ed.executeEdits('append', [{
              range: { startLineNumber: lastLine, startColumn: lastCol, endLineNumber: lastLine, endColumn: lastCol },
              text,
            }]);
            ed.revealLine(model.getLineCount());
          }
        }
      },
      clear: () => editorRef.current?.setValue(''),
      setMarkers: (markers) => {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'sftools', markers);
        }
      },
      clearMarkers: () => {
        const model = editorRef.current?.getModel();
        if (model) {
          monaco.editor.setModelMarkers(model, 'sftools', []);
        }
      },
      focus: () => editorRef.current?.focus(),
      getEditor: () => editorRef.current,
    }));

    const handleMount: OnMount = useCallback((editor, monaco) => {
      editorRef.current = editor;

      // Add Ctrl+Enter action
      if (onExecute) {
        editor.addAction({
          id: 'execute',
          label: 'Execute',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
          run: () => onExecute(),
        });
      }
    }, [onExecute]);

    return (
      <div ref={containerRef} className={`${styles.container} ${className || ''}`}>
        <Editor
          language={language === 'text' ? 'plaintext' : language}
          value={value}
          onChange={(val) => onChange?.(val ?? '')}
          onMount={handleMount}
          theme={effectiveTheme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            readOnly: readonly,
            minimap: { enabled: false },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            fontSize: 13,
          }}
        />
        {resizable && <div className={styles.resizeHandle} />}
      </div>
    );
  }
);

MonacoEditor.displayName = 'MonacoEditor';
```

---

## Verification Commands

```bash
# Type check only
npm run typecheck

# After each wave
npm run typecheck && npm run build && npm run test:unit

# Full validation (before commits)
npm run typecheck && npm run build && npm run test:unit && npm run test:frontend
```

---

## Notes

- Keep this document updated as migration progresses
- Mark items with `[x]` when complete
- Add any issues or learnings in the Notes section below

### Migration Log

| Date | Wave | Files | Notes |
|------|------|-------|-------|
| 2026-01-23 | - | - | Plan created |
| 2026-01-23 | Phase 1 | 8 | Foundation: React deps, Vite config, contexts, hooks |
| 2026-01-23 | Wave 1 | 9 | Simple components: SfIcon, Modal, ButtonIcon, ButtonDropdown + barrel export |
| 2026-01-23 | Wave 2 | 3 | Monaco Editor: React wrapper with @monaco-editor/react, theme hook |
| 2026-01-23 | Wave 3 | 7 | Utils tools: SearchBox, SchemaBrowserLink, DebugLogs, FlowCleanup |
| 2026-01-23 | Wave 4 | 14 | Settings: ConnectionCard/List, ProxySettings, ThemeSettings, CacheSettings, EditConnectionModal, SettingsTab |
| 2026-01-23 | Wave 5 | 4 | Simple tabs: RestApiTab, UtilsTab |
| 2026-01-23 | Wave 6 | 4 | Events: ChannelSelector, EventPublisher, EventsTab |
| 2026-01-23 | Wave 7 | 4 | Apex: ApexHistory, ApexOutput, ApexTab |
| 2026-01-23 | Wave 8 | 8 | Query: useQueryState, QueryEditor, QueryTabs, QueryResults, QueryResultsTable, QueryHistory, QueryTab |
| 2026-01-23 | Wave 9 | 9 | Standalone: FieldRow, RichTextModal, RecordPage, ObjectList, FieldList, FormulaEditor, SchemaPage |
| 2026-01-23 | Wave 10 | 14 | App Shell: AppProviders, TabNavigation, ConnectionSelector, MobileMenu, App + entry points |

### Issues Encountered

(None yet)

### Learnings

(None yet)
