---
title: State Management
type: project
category: architecture
tags:
  - architecture
  - react-context
  - state
  - chrome-storage
aliases:
  - Contexts
  - React Context
created: 2026-02-08
updated: 2026-02-28
status: active
related-code:
  - src/contexts/ConnectionContext.tsx
  - src/contexts/ThemeContext.tsx
  - src/contexts/ProxyContext.tsx
  - src/contexts/ToastContext.tsx
  - src/react/AppProviders.tsx
confidence: high
---

# State Management

## Overview

Global state is managed via three [[React]] Context providers, wrapped in `AppProviders`. No external state library (Redux, Zustand, etc.) is used. All contexts are accessed via custom hooks that throw if used outside their provider.

## How It Works

### Provider Hierarchy

```typescript
// src/react/AppProviders.tsx
<ConnectionProvider>     // Outermost — Salesforce org connections
  <ThemeProvider>        // Dark/light mode
    <ProxyProvider>      // Native proxy connection
      <ToastProvider>    // Global notifications — innermost
        {children}
      </ToastProvider>
    </ProxyProvider>
  </ThemeProvider>
</ConnectionProvider>
```

### ConnectionContext — Multi-Org Salesforce State

The most important context. Manages multiple Salesforce connections with Chrome storage persistence.

```typescript
const {
  connections,         // SalesforceConnection[] — all stored connections
  activeConnection,    // SalesforceConnection | null — currently selected
  isAuthenticated,     // boolean — has valid active connection
  isLoading,           // boolean — loading from storage
  setActiveConnection, // switch active org
  addConnection,       // add new org after OAuth
  updateConnection,    // update connection details
  removeConnection,    // remove org
  refreshConnections,  // reload from storage
} = useConnection();
```

**Storage sync**: Listens to `chrome.storage.onChanged` to sync across tabs. When a token is refreshed in one tab, all tabs receive the update.

**Connection data**:
```typescript
interface SalesforceConnection {
  id: string;              // UUID v4
  label: string;           // User-editable display name
  instanceUrl: string;     // https://org.my.salesforce.com
  loginDomain?: string;    // login.salesforce.com or test.salesforce.com
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null; // Per-connection OAuth Client ID
  createdAt?: number;
  lastUsedAt?: number;
}
```

### ThemeContext — Dark/Light Mode

```typescript
const {
  theme,           // 'light' | 'dark' | 'system'
  effectiveTheme,  // 'light' | 'dark' (resolved from system preference)
  setTheme,        // change theme preference
} = useTheme();
```

Listens to `window.matchMedia('(prefers-color-scheme: dark)')` for system preference changes.

### ProxyContext — Native Proxy Connection

```typescript
const {
  isConnected,    // boolean — proxy connection status
  isConnecting,   // boolean — currently connecting
  httpPort,       // number | null — proxy HTTP port
  version,        // string | null — proxy version
  error,          // string | null — connection error
  connect,        // establish proxy connection
  disconnect,     // close proxy connection
  checkStatus,    // refresh status
} = useProxy();
```

Events tab requires `isConnected === true` to function.

### ToastContext — Global Notifications

Replaced the old `StatusBadge` / `useStatusBadge` pattern (removed in PR #142). Provides a single app-wide toast notification system used across all feature tabs.

```typescript
const {
  show,    // (message: string, type: ToastType, options?: ToastOptions) => string — returns toast id
  update,  // (id: string, updates: Partial<ToastState>) => void
  dismiss, // (id: string) => void
} = useToast();
```

**Toast types:** `'success' | 'error' | 'info' | 'warning'`

**Features:**
- Auto-close with animated progress bar
- Slide-in animation
- Themed accent border matching toast type
- Fixed top-right position (above all content)

**Test selector:** `[role="alert"][data-type]`

**Used by:** [[apex-executor|ApexTab]], [[query-editor|QueryTab]], DebugLogsTab, EventsTab, EventPublisher, RestApiTab, RecordPage

### Creating a New Context

1. Create `src/contexts/ExampleContext.tsx`
2. Define `ExampleContextType` interface
3. Create `ExampleProvider` component with `useState`/`useCallback`
4. Create `useExample()` hook with `useContext` + null check (throw on missing provider)
5. Add to `AppProviders` component

### MUST Patterns

- Always use custom hooks (`useConnection`, `useTheme`, `useProxy`) — never `useContext` directly
- Hooks must throw if used outside provider
- Memoize all action functions with `useCallback`
- Components must reset state on `activeConnection?.id` change:
  ```typescript
  useEffect(() => { setData(null); setError(null); }, [activeConnection?.id]);
  ```

## Key Files

- `src/contexts/ConnectionContext.tsx` — Multi-org state
- `src/contexts/ThemeContext.tsx` — Theme state
- `src/contexts/ProxyContext.tsx` — Proxy state
- `src/contexts/ToastContext.tsx` — Global notifications
- `src/react/AppProviders.tsx` — Provider wrapper

## Related

- [[overview|System Architecture Overview]]
- [[component-architecture|Component Architecture]]
- [[authentication-oauth|Authentication and OAuth]]
- [[native-proxy|Native Proxy]]
- [[settings-and-connections|Settings and Connections]]
- [[chrome-extension-mv3|Chrome Extension MV3]]
- [[typescript-types|TypeScript Type Definitions]]

## Notes

- Keep contexts focused: one concern per context
- Include `isLoading` and `error` states for async operations
- Don't store derived state — compute in components
- Don't nest too deeply — flatten provider hierarchy when possible
