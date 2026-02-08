---
title: Background Service Worker
type: project
category: architecture
tags:
  - architecture
  - service-worker
  - chrome-extension
  - background
aliases:
  - Service Worker
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/background/background.ts
  - src/background/auth.ts
  - src/background/native-messaging.ts
  - src/background/debug.ts
confidence: high
---

# Background Service Worker

## Overview

The Chrome Extension service worker (MV3 background script) acts as a central hub for message routing, OAuth token management, native proxy communication, and context menu actions. It bridges extension pages with external services.

## How It Works

### Message Router (Handler Map Pattern)

```typescript
// background.ts — clean handler map, no switch statements
const handlers: Record<string, Handler> = {
  fetch: handleFetch,               // Direct API fetch (CORS bypass)
  connectProxy: connectNative,      // Connect to native proxy
  disconnectProxy: disconnectNative,
  checkProxyConnection: getProxyInfo,
  getProxyInfo: getProxyInfo,
  tokenExchange: handleTokenExchange, // OAuth code → token
  proxyFetch: proxyRequired(handleProxyFetch),    // Fetch via proxy
  subscribe: proxyRequired(handleSubscribe),       // Start streaming
  unsubscribe: proxyRequired(handleUnsubscribe),   // Stop streaming
  getTopic: proxyRequired(handleGetTopic),         // PubSub metadata
  getSchema: proxyRequired(handleGetSchema),       // Event schema
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = handlers[request.type];
  if (!handler) return false;
  Promise.resolve(handler(request)).then(sendResponse).catch(/*...*/);
  return true; // async response required
});
```

`proxyRequired()` wrapper validates proxy connection before executing handler.

### 401 Handling with Token Refresh

Automatic retry flow for expired tokens:

1. API call returns 401
2. Check if connection has refresh token + proxy is connected
3. Call `refreshAccessToken()` with **mutex** (prevents concurrent refreshes per connection)
4. Update stored token via `updateConnectionToken()`
5. Retry original request with new token
6. If refresh fails → return `{ authExpired: true, connectionId }` → UI shows re-auth modal

### OAuth Token Management (`auth.ts`)

```typescript
exchangeCodeForTokens(code, redirectUri, loginDomain, clientId) // Code → tokens
refreshAccessToken(connection)                                   // Refresh expired token
updateConnectionToken(connectionId, accessToken)                 // Save new token
clearAuthTokens()                                                // Wipe all tokens
```

- Mutex pattern prevents concurrent refresh attempts per connection
- Token exchange routes through proxy to bypass CORS

### Native Messaging (`native-messaging.ts`)

Communication with the local [[Native Proxy]] via Chrome Native Messaging:

```typescript
connectNative()      // Connect + init handshake → { httpPort, secret }
disconnectNative()   // Close connection
sendProxyRequest()   // Send request with ID + timeout
isProxyConnected()   // Synchronous status check
getProxyInfo()       // { connected, httpPort, hasSecret }
```

**Streaming event forwarding**: Proxy pushes events (`streamEvent`, `streamError`, `streamEnd`) which the service worker forwards to extension pages via `chrome.runtime.sendMessage`.

### Context Menu

On install, creates "sftools > View/Edit Record" context menu on Salesforce pages (`*.my.salesforce.com`, `*.lightning.force.com`). Opens Record Viewer for the current page's record.

### Auto-Connect

On startup, checks if proxy auto-connect is enabled in settings and connects automatically.

## Key Files

| File | Purpose |
|------|---------|
| `background.ts` | Message router, 401 retry, context menu |
| `auth.ts` | OAuth token exchange and refresh |
| `native-messaging.ts` | Chrome Native Messaging protocol |
| `debug.ts` | Conditional debug logging (enable via storage flag) |

## Related

- [[System Architecture Overview]]
- [[Authentication and OAuth]]
- [[Native Proxy]]
- [[Salesforce API Client]]

## Notes

- Service workers can restart — don't hold large state
- Always return `true` for async `onMessage` handlers
- Use handler map pattern (no switch statements)
- Include `connectionId` in all messages for proper 401 handling
- Debug logging enabled via `chrome.storage.local.set({ debugEnabled: true })`
