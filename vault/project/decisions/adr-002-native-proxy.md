---
title: "ADR-002: Native Proxy for Advanced Features"
type: decision
category: decisions
tags:
  - vault/project/decisions
  - adr
  - proxy
  - native-messaging
  - grpc
  - cometd
aliases:
  - Proxy Decision
created: 2026-02-08
updated: 2026-02-08
status: accepted
confidence: high
---

# ADR-002: Native Proxy for Advanced Features

## Status

Accepted

## Context

Chrome extensions run in a sandboxed environment with limitations:
1. **CORS restrictions** — Extension fetch requests can fail for certain Salesforce endpoints
2. **No gRPC support** — Browser cannot make gRPC calls needed for Salesforce Pub/Sub API
3. **No CometD/WebSocket persistence** — Service workers can be terminated, breaking long-lived connections
4. **No TCP sockets** — Cannot implement Bayeux protocol directly

These limitations block key features:
- Platform Event streaming (requires gRPC Pub/Sub API)
- Change Data Capture streaming
- PushTopic subscriptions (requires CometD/Bayeux)
- Debug log auto-refresh via streaming
- Some REST endpoints with CORS issues

## Decision

Implement an optional Node.js native proxy that communicates with the extension via Chrome Native Messaging.

### Architecture

```
Extension ←→ Chrome Native Messaging ←→ sftools-proxy (Node.js)
                                              ↓
                                    Salesforce APIs (REST, gRPC, CometD)
```

The proxy is:
- **Optional** — Core features (query, apex, REST) work without it
- **Installed separately** — Node.js application in `sftools-proxy/` directory
- **Connected via Native Messaging** — Chrome's `chrome.runtime.connectNative()` API
- **Feature gating** — Extension UI shows/hides features based on proxy connection status

### Communication

Extension sends messages via `chrome.runtime.sendMessage()` → background service worker → native messaging port → proxy.

Message types: `fetch`, `subscribe`, `unsubscribe`, `checkStatus`.

## Consequences

### Positive
- Unlocks gRPC streaming (Platform Events, CDC)
- Enables CometD long-polling (PushTopics, system topics)
- CORS bypass for problematic endpoints
- Debug log auto-refresh via `/systemTopic/Logging` subscription
- Progressive enhancement — extension works without proxy

### Negative
- Additional installation step for users (Node.js + proxy setup)
- Two codebases to maintain (extension + proxy)
- Native messaging setup varies by OS (registry on Windows, JSON manifest on macOS/Linux)
- Debugging cross-process communication is more complex
- Must handle proxy disconnection gracefully in all features

## Alternatives Considered

### Extension-only (no proxy)
- Simpler architecture
- Cannot support gRPC or persistent CometD
- Would lose streaming features entirely
- Rejected because streaming is a key differentiator

### WebSocket relay server (cloud-hosted)
- Would work without local installation
- Requires hosting infrastructure and costs
- Security concerns with routing Salesforce tokens through third-party server
- Rejected due to security and hosting complexity

### Browser extension with background page (MV2)
- Manifest V2 had persistent background pages
- Could maintain WebSocket connections
- MV2 is deprecated by Chrome
- Rejected due to MV3 migration requirement
