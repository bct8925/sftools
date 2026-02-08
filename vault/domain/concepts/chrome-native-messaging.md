---
title: Chrome Native Messaging
type: domain
category: concepts
tags:
  - vault/domain/concepts
  - chrome-extension
  - native-messaging
  - ipc
  - proxy
aliases:
  - Native Messaging
  - Chrome Native Host
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# Chrome Native Messaging

Chrome Native Messaging is a Chrome Extension API that enables communication between a browser extension and a native application installed on the user's computer. sftools uses this for the extension-to-proxy communication channel.

## Definition

Chrome Native Messaging (`chrome.runtime.connectNative()`) provides a bidirectional message-passing channel between a Chrome extension and a locally-installed native host application. Messages are serialized as JSON with a 4-byte length prefix. The native host is a separate process (Node.js in sftools' case) registered with Chrome via a manifest file.

## How It Works

### Architecture

```
Chrome Extension (Service Worker)
    ↓ chrome.runtime.connectNative('com.sftools.proxy')
    ↓ JSON messages (stdin/stdout)
Native Host (Node.js process - sftools-proxy)
    ↓ HTTP/gRPC/CometD
Salesforce APIs
```

### Connection Lifecycle

1. Extension calls `chrome.runtime.connectNative(NATIVE_HOST_NAME)` with host ID `com.sftools.proxy`
2. Chrome looks up host manifest in OS-specific location
3. Chrome launches the native host process specified in the manifest
4. Communication via stdin/stdout with JSON messages (4-byte length prefix)
5. Port stays open until either side disconnects

### Message Format

- Each message is a JSON object
- Prefixed with 4-byte unsigned integer (message length in bytes)
- Maximum message size: 1MB (Chrome limitation)
- sftools handles this with a "large payload" system — responses over the limit are served via HTTP instead

### Native Host Manifest

OS-specific location:

```json
{
  "name": "com.sftools.proxy",
  "description": "sftools local proxy",
  "path": "/path/to/sftools-proxy/proxy.js",
  "type": "stdio",
  "allowed_origins": ["chrome-extension://EXTENSION_ID/"]
}
```

**Manifest locations:**
- **macOS**: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`
- **Linux**: `~/.config/google-chrome/NativeMessagingHosts/com.sftools.proxy.json`
- **Windows**: Registry key `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.sftools.proxy`

### sftools Implementation

**Source**: `src/background/native-messaging.ts`

Request-response pattern with IDs:
```typescript
// Outgoing: { id: 1, type: 'fetch', url: '...', method: 'GET', headers: {...} }
// Incoming: { id: 1, success: true, data: '...' }
```

**Message types:**
- `init` — Handshake, returns HTTP port + secret + version
- `fetch` — Proxy a REST API request
- `subscribe` — Subscribe to streaming channel (gRPC/CometD)
- `unsubscribe` — Unsubscribe from channel
- `getTopic` — Get Pub/Sub topic metadata
- `getSchema` — Get event schema

**Streaming events** (no request ID — pushed from proxy):
- `streamEvent` — New event received
- `streamError` — Subscription error
- `streamEnd` — Subscription ended

### Large Payload Handling

- Chrome Native Messaging has 1MB message limit
- sftools-proxy runs an HTTP server on a random port
- For large responses, proxy returns `{ largePayload: "payload-id" }`
- Extension fetches payload via `http://127.0.0.1:{port}/payload/{id}` with secret header
- Secret (`X-Proxy-Secret`) prevents unauthorized access to payload server

### Init Handshake

```typescript
// Extension sends: { type: 'init' }
// Proxy responds: { success: true, version: '1.0.0', httpPort: 54321, secret: 'random-uuid' }
```

## Security Model

- `allowed_origins` in host manifest restricts which extensions can connect
- Payload HTTP server bound to `127.0.0.1` (localhost only)
- Secret token required for HTTP payload requests
- No authentication tokens stored by proxy — passed per-request from extension

## Example

```typescript
// In background service worker
import { connectNative, sendProxyRequest, isProxyConnected } from './native-messaging';

// Connect to proxy
const initResult = await connectNative();
// { success: true, version: '1.0.0', httpPort: 54321, secret: '...' }

// Check connection
if (isProxyConnected()) {
  // Send API request through proxy
  const response = await sendProxyRequest({
    type: 'fetch',
    url: 'https://org.salesforce.com/services/data/v62.0/query?q=SELECT+Id+FROM+Account',
    method: 'GET',
    headers: { Authorization: 'Bearer ...' }
  });
  // { success: true, data: '{"records":[...]}' }
}
```

## See Also

- [[chrome-extension-mv3|Chrome Extension MV3]]
- [[native-proxy|Native Proxy]]
- [[background-service-worker|Background Service Worker]]
- [[event-streaming|Event Streaming]]
