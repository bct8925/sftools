# Contexts - sftools

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains **React Context providers** that manage global application state. All contexts follow a consistent pattern using the Context API with custom hooks.

## Directory Structure

```
contexts/
├── ConnectionContext.tsx  # Multi-org Salesforce connection state
├── ThemeContext.tsx       # Dark/light mode management
└── ProxyContext.tsx       # Native messaging proxy state
```

## Usage Pattern

All contexts are wrapped in `AppProviders` component and accessed via custom hooks:

```typescript
// src/react/AppProviders.tsx
import { ConnectionProvider } from '../contexts/ConnectionContext';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ProxyProvider } from '../contexts/ProxyContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider>
      <ThemeProvider>
        <ProxyProvider>
          {children}
        </ProxyProvider>
      </ThemeProvider>
    </ConnectionProvider>
  );
}
```

```typescript
// In any component
import { useConnection } from '../contexts/ConnectionContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProxy } from '../contexts/ProxyContext';

function MyComponent() {
  const { activeConnection, isAuthenticated } = useConnection();
  const { effectiveTheme, setTheme } = useTheme();
  const { isConnected, connect } = useProxy();
}
```

## ConnectionContext

Manages multiple Salesforce org connections with persistent storage.

### Interface

```typescript
interface ConnectionContextType {
  // State
  connections: SalesforceConnection[];    // All stored connections
  activeConnection: SalesforceConnection | null;  // Currently selected
  isAuthenticated: boolean;               // Has valid active connection
  isLoading: boolean;                     // Loading from storage

  // Actions
  setActiveConnection: (conn: SalesforceConnection | null) => void;
  addConnection: (data: ConnectionData) => Promise<SalesforceConnection>;
  updateConnection: (id: string, updates: Partial<SalesforceConnection>) => Promise<void>;
  removeConnection: (id: string) => Promise<void>;
  refreshConnections: () => Promise<void>;
}
```

### Usage Examples

```typescript
import { useConnection } from '../contexts/ConnectionContext';

function ConnectionManager() {
  const {
    connections,
    activeConnection,
    isAuthenticated,
    setActiveConnection,
    addConnection,
    removeConnection,
  } = useConnection();

  // Switch to a different org
  const handleSwitch = (conn: SalesforceConnection) => {
    setActiveConnection(conn);
  };

  // Add new connection after OAuth
  const handleOAuthComplete = async (data: ConnectionData) => {
    const newConn = await addConnection(data);
    setActiveConnection(newConn);
  };

  // Remove a connection
  const handleRemove = async (id: string) => {
    await removeConnection(id);
  };

  // Check authentication before API calls
  const fetchData = async () => {
    if (!isAuthenticated) {
      alert('Please connect to a Salesforce org first');
      return;
    }
    // Make API call...
  };
}
```

### Connection Auto-Selection

`refreshConnections()` centralizes all initialization and auto-selection logic:
- Loads connections from Chrome storage
- If an active connection ID is stored, selects it
- If no active connection, auto-selects the most recently used connection
- Handles both initial load and cross-tab sync scenarios

### Storage Sync

ConnectionContext syncs with Chrome storage across tabs:

```typescript
// Automatically handles storage changes from other tabs
useEffect(() => {
  const handleStorageChange = (changes, area) => {
    if (area === 'local' && changes.connections) {
      refreshConnections();
    }
  };

  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => chrome.storage.onChanged.removeListener(handleStorageChange);
}, []);
```

### Connection Data Types

```typescript
// From src/types/salesforce.d.ts
interface SalesforceConnection {
  id: string;
  label: string;
  instanceUrl: string;
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null;
}

// For adding new connections
interface ConnectionData {
  instanceUrl: string;
  accessToken: string;
  refreshToken?: string;
  clientId?: string;
  label?: string;
}
```

## ThemeContext

Manages dark/light mode with system preference support.

### Interface

```typescript
type ThemeValue = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeValue;                    // User preference
  effectiveTheme: 'light' | 'dark';     // Resolved actual theme
  setTheme: (theme: ThemeValue) => Promise<void>;
}
```

### Usage Examples

```typescript
import { useTheme } from '../contexts/ThemeContext';

function ThemeToggle() {
  const { theme, effectiveTheme, setTheme } = useTheme();

  // Toggle between themes
  const handleToggle = async () => {
    const next = theme === 'light' ? 'dark' : 'light';
    await setTheme(next);
  };

  // Use in conditional styling
  const iconColor = effectiveTheme === 'dark' ? 'white' : 'black';

  // Theme selector dropdown
  return (
    <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeValue)}>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

### System Theme Detection

ThemeContext listens for system preference changes:

```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => updateEffectiveTheme();
  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}, []);
```

## ProxyContext

Manages connection to the native messaging proxy for streaming.

### Interface

```typescript
interface ProxyContextType {
  // State
  isConnected: boolean;       // Proxy connection status
  isConnecting: boolean;      // Currently establishing connection
  httpPort: number | null;    // Proxy HTTP port (when connected)
  version: string | null;     // Proxy version string
  error: string | null;       // Connection error message

  // Actions
  connect: () => Promise<void>;      // Establish proxy connection
  disconnect: () => Promise<void>;   // Close proxy connection
  checkStatus: () => Promise<void>;  // Refresh connection status
}
```

### Usage Examples

```typescript
import { useProxy } from '../contexts/ProxyContext';

function ProxyStatus() {
  const {
    isConnected,
    isConnecting,
    httpPort,
    version,
    error,
    connect,
    disconnect,
  } = useProxy();

  // Show connection status
  if (isConnecting) return <span>Connecting...</span>;
  if (error) return <span className="error">{error}</span>;
  if (isConnected) {
    return (
      <div>
        <span>Connected (v{version}, port {httpPort})</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }
  return <button onClick={connect}>Connect to Proxy</button>;
}
```

### Streaming Dependency

Certain features require the proxy to be connected:

```typescript
function EventsTab() {
  const { isConnected } = useProxy();

  if (!isConnected) {
    return (
      <div className="info">
        Connect to the local proxy to enable event streaming.
        <a href="settings">Go to Settings</a>
      </div>
    );
  }

  // Show streaming interface...
}
```

## Creating a New Context

Follow this pattern to add new global state:

### 1. Create the Context File

```typescript
// src/contexts/ExampleContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// Define the context type
interface ExampleContextType {
  value: string;
  setValue: (value: string) => void;
}

// Create context with null default
const ExampleContext = createContext<ExampleContextType | null>(null);

// Provider props
interface ExampleProviderProps {
  children: ReactNode;
}

// Provider component
export function ExampleProvider({ children }: ExampleProviderProps) {
  const [value, setValue] = useState('');

  const handleSetValue = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  return (
    <ExampleContext.Provider value={{ value, setValue: handleSetValue }}>
      {children}
    </ExampleContext.Provider>
  );
}

// Custom hook with error handling
export function useExample() {
  const context = useContext(ExampleContext);
  if (!context) {
    throw new Error('useExample must be used within ExampleProvider');
  }
  return context;
}
```

### 2. Add to AppProviders

```typescript
// src/react/AppProviders.tsx
import { ExampleProvider } from '../contexts/ExampleContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider>
      <ThemeProvider>
        <ProxyProvider>
          <ExampleProvider>
            {children}
          </ExampleProvider>
        </ProxyProvider>
      </ThemeProvider>
    </ConnectionProvider>
  );
}
```

## Best Practices

### MUST Follow

1. **Always use custom hooks** - Never access context directly with `useContext`
2. **Throw on missing provider** - Hooks must throw if used outside provider
3. **Memoize callbacks** - Wrap all action functions with `useCallback`
4. **Type everything** - Full TypeScript types for context and props

### SHOULD Follow

1. **Keep contexts focused** - One concern per context
2. **Handle loading states** - Include `isLoading` for async initialization
4. **Handle errors** - Include `error` state for async operations

### SHOULD NOT

1. **Don't nest too deeply** - Flatten provider hierarchy when possible
2. **Don't store derived state** - Compute from existing state in components
3. **Don't mutate state directly** - Always use setter functions

## Testing Contexts

### Mock Providers for Tests

```typescript
// tests/mocks/contexts.tsx
import { ReactNode } from 'react';

interface MockConnectionContextValue {
  connections: [];
  activeConnection: null;
  isAuthenticated: false;
  isLoading: false;
  // ... other fields with defaults
}

export function MockConnectionProvider({
  children,
  value = {},
}: {
  children: ReactNode;
  value?: Partial<MockConnectionContextValue>;
}) {
  const mockValue = {
    connections: [],
    activeConnection: null,
    isAuthenticated: false,
    isLoading: false,
    setActiveConnection: vi.fn(),
    addConnection: vi.fn(),
    updateConnection: vi.fn(),
    removeConnection: vi.fn(),
    refreshConnections: vi.fn(),
    ...value,
  };

  return (
    <ConnectionContext.Provider value={mockValue}>
      {children}
    </ConnectionContext.Provider>
  );
}
```

### Testing Components with Contexts

```typescript
import { render, screen } from '@testing-library/react';
import { MockConnectionProvider } from '../mocks/contexts';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('shows login prompt when not authenticated', () => {
    render(
      <MockConnectionProvider value={{ isAuthenticated: false }}>
        <MyComponent />
      </MockConnectionProvider>
    );

    expect(screen.getByText('Please log in')).toBeInTheDocument();
  });

  it('shows content when authenticated', () => {
    render(
      <MockConnectionProvider value={{ isAuthenticated: true }}>
        <MyComponent />
      </MockConnectionProvider>
    );

    expect(screen.getByText('Welcome')).toBeInTheDocument();
  });
});
```
