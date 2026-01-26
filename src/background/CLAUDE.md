# Background - sftools Service Worker

> **Parent context**: This extends [../../CLAUDE.md](../../CLAUDE.md)

## Overview

This directory contains the **Chrome Extension Service Worker** (Manifest V3 background script). It handles message routing, OAuth token management, native messaging with the local proxy, and context menu actions.

## Directory Structure

```
background/
├── background.ts       # Main message router and handlers
├── auth.ts            # OAuth token exchange and refresh
├── native-messaging.ts # Chrome Native Messaging to proxy
└── debug.ts           # Debug logging utilities
```

## Architecture

The service worker acts as a central hub:

```
┌─────────────┐     ┌─────────────────────┐     ┌───────────────┐
│ Extension   │────▶│  Service Worker     │────▶│ Local Proxy   │
│ Pages       │     │  (background.ts)    │     │ (Node.js)     │
└─────────────┘     └─────────────────────┘     └───────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │  Salesforce API     │
                    └─────────────────────┘
```

## Key Files

### background.ts - Message Router

The main entry point that routes messages from extension pages to appropriate handlers:

```typescript
// Message type definitions
type BackgroundRequest =
  | FetchRequest
  | ConnectProxyRequest
  | DisconnectProxyRequest
  | CheckProxyConnectionRequest
  | GetProxyInfoRequest
  | TokenExchangeRequest
  | ProxyFetchRequest
  | SubscribeRequest
  | UnsubscribeRequest
  | GetTopicRequest
  | GetSchemaRequest;

// Handler map pattern
const handlers: Record<string, (request: BackgroundRequest) => Promise<ProxyResponse>> = {
  fetch: handleFetch,
  connectProxy: () => connectNative(),
  disconnectProxy: () => { disconnectNative(); return Promise.resolve({ success: true }); },
  checkProxyConnection: () => Promise.resolve({ success: true, ...getProxyInfo() }),
  getProxyInfo: () => Promise.resolve({ success: true, ...getProxyInfo() }),
  tokenExchange: handleTokenExchange,
  proxyFetch: proxyRequired(handleProxyFetch),
  subscribe: proxyRequired(handleSubscribe),
  unsubscribe: proxyRequired(handleUnsubscribe),
  getTopic: proxyRequired(handleGetTopic),
  getSchema: proxyRequired(handleGetSchema),
};

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = handlers[request.type];
  if (!handler) return false;

  Promise.resolve(handler(request))
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true; // Async response
});
```

**Key Features:**
- Handler map pattern for clean message routing
- `proxyRequired` wrapper for handlers that need proxy connection
- Automatic 401 handling with token refresh
- Context menu setup for "View/Edit Record"
- Auto-connect to proxy on startup (if enabled)

### auth.ts - OAuth Token Management

Handles OAuth flows in the service worker context:

```typescript
// Exchange authorization code for tokens
exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  loginDomain: string,
  clientId: string
): Promise<TokenExchangeResult>

// Refresh expired access token
refreshAccessToken(
  connection: SalesforceConnection
): Promise<TokenRefreshResult>

// Update stored token after refresh
updateConnectionToken(
  connectionId: string,
  accessToken: string
): Promise<void>

// Clear all auth tokens
clearAuthTokens(): Promise<void>
```

**Key Features:**
- Mutex pattern to prevent concurrent refresh attempts per connection
- Routes through proxy to bypass CORS
- Handles both exchange and refresh flows

### native-messaging.ts - Proxy Communication

Manages the Native Messaging connection to the local proxy:

```typescript
// Connect to native host with init handshake
connectNative(): Promise<InitResponse>

// Disconnect from native host
disconnectNative(): void

// Send request to proxy
sendProxyRequest(message: ProxyRequest): Promise<ProxyResponse>

// Check connection status
isProxyConnected(): boolean

// Get connection info
getProxyInfo(): { connected: boolean; httpPort: number | null; hasSecret: boolean }
```

**Key Features:**
- Request-response pattern with IDs and timeouts
- Streaming event forwarding (`streamEvent`, `streamError`, `streamEnd`)
- Large payload handling via HTTP server
- Automatic reconnection handling

### debug.ts - Debug Utilities

```typescript
// Conditional debug logging
debugInfo(...args: unknown[]): void

// Enabled via storage flag
// chrome.storage.local.set({ debugEnabled: true })
```

## Message Types

### Fetch Requests

```typescript
// Direct fetch (bypasses CORS via extension)
{ type: 'fetch', url: string, options: RequestInit, connectionId?: string }

// Proxy fetch (routes through local proxy)
{ type: 'proxyFetch', url: string, method: string, headers: object, body?: string, connectionId?: string }
```

### Proxy Connection

```typescript
// Connect to proxy
{ type: 'connectProxy' }

// Disconnect from proxy
{ type: 'disconnectProxy' }

// Check connection status
{ type: 'checkProxyConnection' }

// Get full proxy info
{ type: 'getProxyInfo' }
```

### OAuth

```typescript
// Exchange code for tokens
{
  type: 'tokenExchange',
  code: string,
  redirectUri: string,
  loginDomain: string,
  clientId: string
}
```

### Streaming (Proxy Required)

```typescript
// Subscribe to channel
{
  type: 'subscribe',
  accessToken: string,
  instanceUrl: string,
  channel: string,
  replayPreset?: string,
  replayId?: string | number
}

// Unsubscribe from channel
{ type: 'unsubscribe', subscriptionId: string }

// Get topic metadata
{
  type: 'getTopic',
  accessToken: string,
  instanceUrl: string,
  topicName: string,
  tenantId: string
}

// Get event schema
{
  type: 'getSchema',
  accessToken: string,
  instanceUrl: string,
  schemaId: string,
  tenantId: string
}
```

## Sending Messages

From extension pages, use `chrome.runtime.sendMessage`:

```typescript
// Simple fetch
const response = await chrome.runtime.sendMessage({
  type: 'fetch',
  url: 'https://org.salesforce.com/services/data/v62.0/query',
  options: {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  },
  connectionId: activeConnection.id
});

// Connect to proxy
const result = await chrome.runtime.sendMessage({ type: 'connectProxy' });
if (result.success) {
  console.log('Connected, HTTP port:', result.httpPort);
}
```

## 401 Handling

The service worker automatically handles 401 responses:

1. Receives 401 from Salesforce API
2. Checks if connection has refresh token and proxy is connected
3. Calls `refreshAccessToken()` with mutex to prevent concurrent refreshes
4. Updates stored token via `updateConnectionToken()`
5. Retries original request with new token
6. If refresh fails, returns `{ authExpired: true, connectionId: '...' }`

```typescript
// Automatic 401 handling in fetchWithRetry
async function fetchWithRetry(
  fetchFn: (headers: Record<string, string>) => Promise<Response>,
  convertFn: (response: Response) => Promise<FetchResponse>,
  headers: Record<string, string> | undefined,
  connectionId: string | undefined
): Promise<FetchResponse> {
  const response = await fetchFn(headers || {});
  const converted = await convertFn(response);

  return await handle401WithRefresh(
    converted,
    connectionId,
    hasAuth,
    async (newAccessToken: string) => {
      // Retry with new token
      const retryResponse = await fetchFn({
        ...headers,
        Authorization: `Bearer ${newAccessToken}`,
      });
      return convertFn(retryResponse);
    }
  );
}
```

## Context Menu

The service worker sets up context menu items:

```typescript
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu on Salesforce pages
  chrome.contextMenus.create({
    id: 'sftools-parent',
    title: 'sftools',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.my.salesforce.com/*', '*://*.lightning.force.com/*'],
  });

  // View/Edit Record action
  chrome.contextMenus.create({
    id: 'view-edit-record',
    parentId: 'sftools-parent',
    title: 'View/Edit Record',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.my.salesforce.com/*', '*://*.lightning.force.com/*'],
  });
});
```

## Streaming Events

The proxy forwards streaming events through the service worker:

```typescript
// Received from proxy
{ type: 'streamEvent', subscriptionId: string, event: object }
{ type: 'streamError', subscriptionId: string, error: string }
{ type: 'streamEnd', subscriptionId: string }

// Forwarded to extension pages
chrome.runtime.sendMessage(msg).catch(() => { /* ignore */ });
```

Listen in extension pages:

```typescript
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'streamEvent') {
    console.log('Event received:', message.event);
  }
});
```

## Best Practices

### MUST Follow

1. **Return `true` for async handlers** - Required for `sendResponse` to work
2. **Handle disconnections** - Clean up pending requests on disconnect
3. **Use mutex for token refresh** - Prevent concurrent refresh attempts
4. **Always include `connectionId`** - Required for proper 401 handling

### SHOULD Follow

1. **Use handler map pattern** - Clean routing without switch statements
2. **Wrap proxy-required handlers** - Use `proxyRequired` helper
3. **Handle timeouts** - Set reasonable timeouts for native messages
4. **Forward streaming events** - Don't process them in service worker

### SHOULD NOT

1. **Don't hold large state** - Service workers can restart
2. **Don't use fetch for internal messages** - Use `chrome.runtime.sendMessage`
3. **Don't block on synchronous operations** - Keep handlers async

## Testing

Service worker code can be tested via:

1. **Unit tests** - Mock `chrome.runtime.sendMessage` responses
2. **Manual testing** - Use Chrome DevTools > Extensions > Service Worker
3. **Debug logging** - Enable via `chrome.storage.local.set({ debugEnabled: true })`
