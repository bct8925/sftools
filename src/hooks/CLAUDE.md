# Hooks - sftools React Hooks

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains **React hook exports** for the sftools extension. Currently, it serves as a barrel export file that re-exports hooks from their context definitions for convenience.

## Directory Structure

```
hooks/
└── index.ts    # Barrel re-exports from contexts
```

## Current Exports

The `index.ts` file re-exports all context hooks:

```typescript
// src/hooks/index.ts
export { useConnection } from '../contexts/ConnectionContext';
export { useTheme } from '../contexts/ThemeContext';
export { useProxy } from '../contexts/ProxyContext';
```

## Usage

Components can import hooks from either location:

```typescript
// Option 1: Import from hooks (recommended)
import { useConnection, useTheme, useProxy } from '../hooks';

// Option 2: Import from contexts (also valid)
import { useConnection, useTheme, useProxy } from '../contexts';
```

## Available Hooks

### useConnection

Provides access to Salesforce connection state:

```typescript
const {
  connections,           // All stored connections
  activeConnection,      // Currently selected connection
  isAuthenticated,       // Has valid active connection
  isLoading,             // Loading from storage
  setActiveConnection,   // Switch active connection
  addConnection,         // Add new connection
  updateConnection,      // Update connection details
  removeConnection,      // Remove connection
  refreshConnections,    // Reload from storage
} = useConnection();
```

### useTheme

Provides access to theme state:

```typescript
const {
  theme,           // 'light' | 'dark' | 'system'
  effectiveTheme,  // 'light' | 'dark' (resolved)
  setTheme,        // Change theme preference
} = useTheme();
```

### useProxy

Provides access to proxy connection state:

```typescript
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
```

## Adding Custom Hooks

For hooks that don't belong in contexts (e.g., utility hooks, component-specific hooks):

### 1. Create Hook File

```typescript
// src/hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

### 2. Export from Index

```typescript
// src/hooks/index.ts
export { useConnection } from '../contexts/ConnectionContext';
export { useTheme } from '../contexts/ThemeContext';
export { useProxy } from '../contexts/ProxyContext';
export { useDebounce } from './useDebounce';
```

## Hook Patterns

### Component-Specific Hooks

For complex component state, create a hook in the component folder:

```typescript
// src/components/query/useQueryState.ts
// This pattern keeps related logic colocated with the component
```

### Shared Utility Hooks

For hooks used across multiple components, add them here:

```typescript
// src/hooks/useLocalStorage.ts
// src/hooks/useDebounce.ts
// src/hooks/useAsync.ts
```

## Best Practices

### MUST Follow

1. **Always export from index** - All hooks should be accessible via `../hooks`
2. **Use TypeScript** - Full type annotations for parameters and returns
3. **Follow React rules** - Hooks must start with `use`, follow rules of hooks

### SHOULD Follow

1. **Colocate component-specific hooks** - Put them in the component folder
2. **Document with JSDoc** - Describe parameters and return values
3. **Include examples** - Show usage in JSDoc comments

### SHOULD NOT

1. **Don't put context hooks here** - They belong in `contexts/`
2. **Don't create hooks for single use** - Extract only when reused
