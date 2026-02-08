---
title: "ADR-003: Dual OAuth Flow Strategy"
type: decision
category: decisions
tags:
  - vault/project/decisions
  - adr
  - oauth
  - authentication
  - security
aliases:
  - OAuth Decision
created: 2026-02-08
updated: 2026-02-08
status: accepted
confidence: high
---

# ADR-003: Dual OAuth Flow Strategy

## Status

Accepted

## Context

Chrome extensions cannot make cross-origin POST requests to Salesforce token endpoints due to CORS restrictions. sftools supports two user scenarios: with proxy (full features including event streaming) and without proxy (basic features only).

Key requirements:
- Support OAuth authentication in both scenarios
- Enable token refresh for long sessions (when possible)
- Maintain security with CSRF protection
- Progressive enhancement — basic functionality without proxy, advanced features with proxy

Salesforce OAuth 2.0 supports:
- **Implicit flow** (`response_type=token`) — Returns access token directly in URL fragment, no refresh token possible
- **Authorization code flow** (`response_type=code`) — Returns authorization code in URL query parameter, must exchange code for tokens (requires server-side endpoint), includes refresh token

Chrome extension CORS limitations:
- Cannot POST to `https://login.salesforce.com/services/oauth2/token` from extension context
- URL fragments and query parameters can be read from callback URL
- Background service worker can communicate with native proxy

## Decision

Support both OAuth flows, automatically selecting based on proxy availability:

### Without Proxy: Implicit Flow
- Use `response_type=token`
- Access token returned directly in callback URL fragment
- No refresh token — session ends when token expires
- User must re-authenticate when token expires (typically after hours)
- Simpler flow, no server-side exchange needed

### With Proxy: Authorization Code Flow
- Use `response_type=code`
- Authorization code returned in callback URL query parameter
- Code exchanged for access token + refresh token via proxy (bypasses CORS)
- Background service worker handles automatic token refresh
- Mutex prevents concurrent refresh requests
- Longer sessions without re-authentication

Flow selection happens automatically in `src/auth/start-authorization.ts`:

```typescript
let useCodeFlow = false;
try {
    const proxyStatus = await chrome.runtime.sendMessage({
        type: 'checkProxyConnection'
    });
    useCodeFlow = proxyStatus?.connected ?? false;
} catch {
    // Proxy not available, use implicit flow
}

const responseType = useCodeFlow ? 'code' : 'token';
```

Both flows include CSRF protection via the `state` parameter, which is validated on callback.

## Consequences

### Positive
- Progressive enhancement — extension works without proxy, better experience with proxy
- Automatic token refresh reduces re-authentication friction (when proxy available)
- CSRF protection via state parameter in both flows
- Clean automatic selection — users don't configure flow manually
- Graceful degradation when proxy connection lost

### Negative
- Two OAuth code paths to maintain and test
- Without proxy, users must re-authenticate when access token expires (no refresh)
- Token exchange creates dependency on proxy for refresh capability
- More complex authentication logic in background service worker

## Alternatives Considered

### 1. Implicit Flow Only
**Pros**: Simpler, single code path, no proxy dependency for auth
**Cons**: No refresh tokens, users constantly re-authenticate on long sessions
**Rejected**: Poor UX for users with long work sessions

### 2. Authorization Code Flow Only
**Pros**: Better security posture, refresh tokens always available
**Cons**: Requires proxy always, breaks "works without proxy" model
**Rejected**: Eliminates basic usage without proxy

### 3. PKCE Flow (Proof Key for Code Exchange)
**Pros**: More secure than implicit flow, designed for public clients
**Cons**: Salesforce CORS restrictions still block token exchange endpoint from browser context, would still require proxy
**Rejected**: No advantage over authorization code flow in this CORS-restricted environment

### 4. Device Flow
**Pros**: Designed for devices without browser
**Cons**: Not suitable for interactive browser extension, poor UX (requires separate device/browser)
**Rejected**: Wrong use case

## Related

- [[authentication-oauth]] - OAuth implementation details
- [[native-proxy]] - Proxy architecture enabling code flow
- [[background-service-worker]] - Service worker handling token refresh
- [[chrome-extension-mv3]] - Chrome extension constraints and capabilities
