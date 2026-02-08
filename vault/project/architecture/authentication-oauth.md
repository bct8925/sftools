---
title: Authentication and OAuth
type: project
category: architecture
tags:
  - auth
  - oauth
  - multi-org
  - security
aliases:
  - OAuth
  - Auth
  - Multi-Connection
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/auth/auth.ts
  - src/auth/start-authorization.ts
  - src/auth/oauth-credentials.ts
  - src/background/auth.ts
  - src/pages/callback/callback.ts
confidence: high
---

# Authentication and OAuth

## Overview

sftools supports multiple Salesforce org connections with per-instance active connection tracking. Two OAuth flows are supported: **implicit flow** (without proxy) and **authorization code flow** (with proxy, supports token refresh).

## How It Works

### OAuth Flows

**Implicit Flow** (no proxy):
```
User clicks "Authorize" → Salesforce login (response_type=token)
  → Redirect to callback with #access_token=xxx&instance_url=yyy
  → Validate state → Store connection → Close tab
```
- No refresh token — session expires when Salesforce token expires
- Simpler but requires re-authentication

**Authorization Code Flow** (with proxy):
```
User clicks "Authorize" → Salesforce login (response_type=code)
  → Redirect to callback with ?code=xxx&state=yyy
  → Validate state → Send tokenExchange to service worker
  → Service worker exchanges code via proxy → Store tokens → Close tab
```
- Includes refresh token — automatic token refresh on 401
- Requires native proxy for CORS bypass on token endpoint

### Module-Level Auth State

`auth.ts` maintains synchronous module-level state for fast access:

```typescript
let ACCESS_TOKEN = '';
let INSTANCE_URL = '';
let ACTIVE_CONNECTION_ID: string | null = null;

// Synchronous getters (no async overhead)
getAccessToken()       // cached token
getInstanceUrl()       // cached instance URL
isAuthenticated()      // !!(ACCESS_TOKEN && INSTANCE_URL)
getActiveConnectionId()
```

Updated by `setActiveConnection(conn)` and storage change listeners.

### CSRF Protection

OAuth state parameter (CSRF protection):
1. `generateOAuthState()` → `crypto.randomUUID()`
2. `setPendingAuth({ loginDomain, clientId, connectionId, state })` → stored in Chrome storage
3. On callback: `validateOAuthState(receivedState)` → validates + auto-clears (5-min expiry)

### Per-Connection OAuth Clients

Each connection can have its own OAuth client ID (Connected App):
- `clientId: string | null` on `SalesforceConnection`
- `null` = use manifest default client
- `getOAuthCredentials(connectionId?)` resolves the right client ID

### Auth Expiration

```typescript
onAuthExpired(callback)     // Register handler
triggerAuthExpired(connId)  // Called by salesforceRequest on 401
```

Broadcast via `chrome.runtime.onMessage` and `chrome.storage.onChanged` for cross-instance sync.

### Migration Functions

- `migrateFromSingleConnection()` — Legacy single-connection → multi-connection array
- `migrateCustomConnectedApp()` — Global custom client → per-connection clientId

Both are idempotent, called on every app startup.

### Connection Storage Schema

```typescript
{
  connections: SalesforceConnection[];
  // No activeConnectionId stored — each instance tracks its own
}
```

Each instance (tab) independently selects its active connection.

## Key Files

| File | Purpose |
|------|---------|
| `src/auth/auth.ts` | Multi-connection storage, state, CSRF, migrations |
| `src/auth/start-authorization.ts` | Initiate OAuth flow (domain detect, flow select, redirect) |
| `src/auth/oauth-credentials.ts` | Per-connection client ID resolution |
| `src/background/auth.ts` | Token exchange + refresh (service worker side) |
| `src/pages/callback/callback.ts` | OAuth callback handler (code + implicit flows) |

## Related

- [[System Architecture Overview]]
- [[State Management]]
- [[Background Service Worker]]
- [[Salesforce API Client]]

## Notes

- **MUST** validate OAuth state parameter — CSRF protection is required
- **MUST** use module getters (`getAccessToken()`) — not direct storage reads
- **MUST** call `setActiveConnection()` after `loadConnections()` to populate module state
- Token refresh uses mutex to prevent concurrent refresh attempts per connection
- Storage change listener syncs refreshed tokens across all open tabs
