# Auth - sftools Authentication & Connection Management

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

The `auth/` directory contains authentication, OAuth flow, and multi-connection management for Salesforce. This module handles access tokens, connection storage, OAuth state management, and CSRF protection.

## Directory Structure

```
auth/
├── auth.ts                # Multi-connection storage and state
├── start-authorization.ts # OAuth flow initiation
├── oauth-credentials.ts   # OAuth client configuration
└── index.ts               # Barrel exports
```

## TypeScript Patterns

All auth files use TypeScript with strict mode. Import types from `src/types/salesforce.d.ts`:

```typescript
import type { SalesforceConnection } from '../types/salesforce';
```

## Key Modules

### auth.ts - Multi-Connection Storage

Manages multiple Salesforce connections with per-instance active connection state. Provides synchronous access to auth tokens and async operations for connection management.

```typescript
import {
  // Synchronous getters (use cached state)
  getAccessToken,
  getInstanceUrl,
  isAuthenticated,
  getActiveConnectionId,

  // Connection management (async)
  loadConnections,
  setActiveConnection,
  addConnection,
  updateConnection,
  removeConnection,

  // OAuth state management
  generateOAuthState,
  setPendingAuth,
  consumePendingAuth,
  validateOAuthState,

  // Credentials
  getOAuthCredentials,

  // Auth expiration handling
  onAuthExpired,
  triggerAuthExpired,

  // Migration utilities
  migrateFromSingleConnection,
  migrateCustomConnectedApp,

  // Types
  type ConnectionData,
  type PendingAuth,
  type OAuthValidationResult,
} from '../auth/auth';
```

#### Module-Level State

Each sftools instance maintains isolated auth state in memory for fast synchronous access:

```typescript
// Module-level variables (cached)
let ACCESS_TOKEN = '';
let INSTANCE_URL = '';
let ACTIVE_CONNECTION_ID: string | null = null;

// Synchronous access (no async calls needed)
const token = getAccessToken();      // Returns cached token
const url = getInstanceUrl();        // Returns cached instance URL
const authenticated = isAuthenticated(); // Returns !!(ACCESS_TOKEN && INSTANCE_URL)
const connectionId = getActiveConnectionId(); // Returns active connection ID
```

#### Connection Storage Schema

```typescript
interface SalesforceConnection {
  id: string;              // UUID v4
  label: string;           // User-editable label
  instanceUrl: string;     // https://org.my.salesforce.com
  loginDomain?: string;    // login.salesforce.com or test.salesforce.com
  accessToken: string;
  refreshToken: string | null;
  clientId: string | null; // Per-connection OAuth Client ID
  createdAt?: number;
  lastUsedAt?: number;
}

// Storage format
{
  connections: SalesforceConnection[];
  // No activeConnectionId - each instance tracks its own active connection
}
```

#### Connection Management

```typescript
// Load all connections from storage
const connections = await loadConnections();
// Returns: SalesforceConnection[]

// Set active connection (updates module state)
setActiveConnection(connection);
// Updates ACCESS_TOKEN, INSTANCE_URL, ACTIVE_CONNECTION_ID

// Add new connection
const newConnection = await addConnection({
  instanceUrl: 'https://org.my.salesforce.com',
  accessToken: 'token',
  refreshToken: 'refresh',
  clientId: null, // Optional custom OAuth client
  label: 'Production Org' // Optional label
});
// Generates UUID, saves to storage, returns SalesforceConnection

// Update connection
await updateConnection(connectionId, {
  label: 'New Label',
  accessToken: 'newToken'
});
// Merges updates, updates lastUsedAt

// Remove connection
await removeConnection(connectionId);
// Removes from storage and cleans up describe cache
```

#### OAuth State Management

OAuth flow uses state parameter for CSRF protection:

```typescript
// 1. Generate state for OAuth flow
const state = generateOAuthState();
// Returns: crypto.randomUUID() (cryptographically random)

// 2. Store pending auth before redirect
await setPendingAuth({
  loginDomain: 'https://login.salesforce.com',
  clientId: 'customClientId', // null = use default
  connectionId: 'existing-id', // null = new connection
  state: state // For CSRF validation
});

// 3. Validate and consume on callback
const validation = await validateOAuthState(receivedState);
if (validation.valid) {
  const { loginDomain, clientId, connectionId } = validation.pendingAuth;
  // Complete OAuth flow
}
// State is automatically cleared and expires after 5 minutes
```

#### Auth Expiration Handling

```typescript
// Register callback for auth expiration
onAuthExpired((connectionId, error) => {
  console.log(`Auth expired for connection ${connectionId}: ${error}`);
  // Trigger re-authentication or show error
});

// Trigger auth expiration (called by salesforceRequest on 401)
triggerAuthExpired(connectionId, 'Session expired');
// Calls registered callback

// Auth expiration is also broadcast via chrome.runtime.onMessage
// and chrome.storage.onChanged for cross-instance synchronization
```

#### Migration Functions

```typescript
// Migrate from legacy single-connection format
const migrated = await migrateFromSingleConnection();
// Moves accessToken, instanceUrl, etc. to connections array
// Returns: true if migration performed, false if already migrated

// Migrate from global customConnectedApp to per-connection clientId
const migrated = await migrateCustomConnectedApp();
// Applies custom clientId to all connections that don't have one
// Removes deprecated customConnectedApp storage key
// Returns: true if migration performed
```

### start-authorization.ts - OAuth Flow Initiation

Shared utility for starting the Salesforce OAuth authorization flow.

```typescript
import { startAuthorization } from '../auth/start-authorization';

/**
 * Start OAuth authorization flow
 * @param overrideLoginDomain - Login domain or null to auto-detect
 * @param overrideClientId - Custom client ID or null to use default
 * @param connectionId - Connection ID if re-authorizing existing connection
 */
await startAuthorization(
  'https://test.salesforce.com', // or null to detect from current tab
  'customClientId',              // or null to use default
  'connection-id-to-update'      // or null for new connection
);
```

#### Flow Details

1. **Domain Detection**: Uses provided domain or detects from active tab URL
2. **Flow Selection**: Checks proxy availability (code flow vs implicit flow)
3. **Client ID**: Uses override or falls back to connection's clientId or manifest default
4. **State Generation**: Generates CSRF state parameter via `generateOAuthState()`
5. **Pending Auth**: Stores parameters via `setPendingAuth()` for callback
6. **Redirect**: Opens OAuth URL in new tab via `chrome.tabs.create()`

```typescript
// Auto-detect flow
await startAuthorization(null, null, null);
// Detects login domain from current tab, uses default client, creates new connection

// Custom client for sandbox
await startAuthorization('https://test.salesforce.com', 'customClientId', null);

// Re-authorize existing connection
await startAuthorization(null, null, 'existing-connection-id');
```

### oauth-credentials.ts - OAuth Client Configuration

Context-agnostic OAuth credentials helper used in both frontend pages and service workers.

```typescript
import { getOAuthCredentials } from '../auth/oauth-credentials';

// Get credentials for a specific connection
const { clientId, isCustom } = await getOAuthCredentials('connection-id');
// Returns per-connection clientId if available, otherwise manifest default

// Get default credentials
const { clientId, isCustom } = await getOAuthCredentials();
// Returns manifest default OAuth client ID
```

#### Return Interface

```typescript
interface OAuthCredentials {
  clientId: string;  // OAuth Client ID to use
  isCustom: boolean; // true if per-connection, false if manifest default
}
```

## Common Operations

### Initialize Auth on App Load

```typescript
import {
  migrateFromSingleConnection,
  migrateCustomConnectedApp,
  loadConnections,
  setActiveConnection,
} from '../auth/auth';

// Run migrations (idempotent - safe to call every time)
await migrateFromSingleConnection();
await migrateCustomConnectedApp();

// Load connections
const connections = await loadConnections();

// Set active connection (e.g., last used or first)
if (connections.length > 0) {
  const lastUsed = connections.sort((a, b) =>
    (b.lastUsedAt || 0) - (a.lastUsedAt || 0)
  )[0];
  setActiveConnection(lastUsed);
}
```

### Handle OAuth Callback

```typescript
import { validateOAuthState, addConnection, updateConnection } from '../auth/auth';

// Parse URL hash
const params = new URLSearchParams(window.location.hash.substring(1));
const accessToken = params.get('access_token');
const instanceUrl = params.get('instance_url');
const state = params.get('state');

if (!accessToken || !instanceUrl || !state) {
  throw new Error('Missing OAuth parameters');
}

// Validate state (CSRF protection)
const validation = await validateOAuthState(state);
if (!validation.valid) {
  throw new Error('Invalid OAuth state - possible CSRF attack');
}

const { loginDomain, clientId, connectionId } = validation.pendingAuth;

if (connectionId) {
  // Update existing connection
  await updateConnection(connectionId, { accessToken, instanceUrl });
} else {
  // Create new connection
  await addConnection({
    instanceUrl,
    accessToken,
    refreshToken: null, // Implicit flow has no refresh token
    clientId,
    loginDomain,
  });
}
```

### Switch Connections

```typescript
import { loadConnections, setActiveConnection } from '../auth/auth';

const connections = await loadConnections();
const targetConnection = connections.find(c => c.id === targetId);

if (targetConnection) {
  setActiveConnection(targetConnection);
  // ACCESS_TOKEN and INSTANCE_URL are now updated
  // All subsequent API calls use this connection
}
```

### Listen for Auth Changes

Auth module automatically syncs across instances via storage listeners:

```typescript
// In auth.ts - listens to storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.connections?.newValue && ACTIVE_CONNECTION_ID) {
    const updatedConnections = changes.connections.newValue;
    const activeConn = updatedConnections.find(c => c.id === ACTIVE_CONNECTION_ID);

    if (activeConn) {
      // Token was refreshed - update module state
      ACCESS_TOKEN = activeConn.accessToken;
      INSTANCE_URL = activeConn.instanceUrl;
    } else {
      // Connection was removed - trigger auth expired
      triggerAuthExpired();
    }
  }
});
```

## Best Practices

### Always Use Module Getters

```typescript
// GOOD - use module getters for synchronous access
import { getAccessToken, getInstanceUrl } from '../auth/auth';
const token = getAccessToken();
const url = getInstanceUrl();

// BAD - don't directly access storage for every request
const data = await chrome.storage.local.get(['connections']);
const connection = data.connections[0];
const token = connection.accessToken; // Slow, no guarantee this is active
```

### Set Active Connection After Load

```typescript
// GOOD - set active connection to populate module state
const connections = await loadConnections();
setActiveConnection(connections[0]);
// Now getAccessToken() and getInstanceUrl() work

// BAD - don't skip setActiveConnection
const connections = await loadConnections();
const token = connections[0].accessToken; // Module state not updated
```

### Handle Auth Expiration

```typescript
// GOOD - register callback to handle expiration
import { onAuthExpired } from '../auth/auth';

onAuthExpired((connectionId, error) => {
  // Show error to user
  // Clear active connection
  // Redirect to login
});

// BAD - ignore auth expiration
// User will see confusing "401 Unauthorized" errors
```

### Validate OAuth State

```typescript
// GOOD - validate state parameter
const validation = await validateOAuthState(state);
if (!validation.valid) {
  throw new Error('CSRF validation failed');
}

// BAD - skip state validation
const pendingAuth = await consumePendingAuth();
// Vulnerable to CSRF attacks
```

### Use Per-Connection ClientId

```typescript
// GOOD - support per-connection OAuth clients
await addConnection({
  instanceUrl: 'https://org.my.salesforce.com',
  accessToken: 'token',
  clientId: 'custom-client-id' // Per-connection custom client
});

// ALSO GOOD - use default client
await addConnection({
  instanceUrl: 'https://org.my.salesforce.com',
  accessToken: 'token',
  clientId: null // Will use manifest default
});
```

## Testing Considerations

### Mocking Auth State

```typescript
// In tests, mock chrome.storage.local
import { chromeMock } from '../tests/unit/mocks/chrome';

beforeEach(() => {
  chromeMock._setStorageData({
    connections: [{
      id: 'test-id',
      label: 'Test Org',
      instanceUrl: 'https://test.my.salesforce.com',
      accessToken: 'test-token',
      refreshToken: null,
      clientId: null,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
    }]
  });
});
```

### Testing OAuth Flow

```typescript
// Mock pending auth state
await setPendingAuth({
  loginDomain: 'https://test.salesforce.com',
  clientId: null,
  connectionId: null,
  state: 'test-state',
});

// Validate state
const validation = await validateOAuthState('test-state');
expect(validation.valid).toBe(true);
expect(validation.pendingAuth?.loginDomain).toBe('https://test.salesforce.com');
```

## File-by-File Reference

| File | Purpose | Key Exports |
|------|---------|-------------|
| `auth.ts` | Multi-connection storage & state | `getAccessToken`, `loadConnections`, `setActiveConnection`, `generateOAuthState`, `setPendingAuth`, `validateOAuthState`, `onAuthExpired` |
| `start-authorization.ts` | OAuth flow initiation | `startAuthorization` |
| `oauth-credentials.ts` | OAuth client configuration | `getOAuthCredentials` |
| `index.ts` | Barrel exports | Re-exports all public functions |
