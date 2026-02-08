---
title: Native Proxy
type: project
category: architecture
tags:
  - proxy
  - native-messaging
  - grpc
  - cometd
  - streaming
  - cors
  - large-payload
aliases:
  - sftools-proxy
  - Proxy
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - sftools-proxy/
  - src/background/native-messaging.ts
confidence: high
---

# Native Proxy

## Overview

sftools-proxy is an optional Node.js (>=18) native messaging host that enables capabilities browsers cannot provide: gRPC/HTTP2 for Salesforce Pub/Sub API, CometD/Bayeux for PushTopics, REST API proxying to bypass CORS, and large payload handling (>1MB Native Messaging limit).

## How It Works

### Message Flow

```
Chrome Extension
    ↓ Native Messaging (stdin, 4-byte LE length + JSON)
native-messaging.js
    ↓ JSON parse
index.js (message router)
    ↓ Route by type
handlers/*
    ↓ Process
Response (stdout)
```

### Message Types

| Type | Handler | Description |
|------|---------|-------------|
| `init` | index.js | Start HTTP server → return port + secret |
| `ping` | index.js | Health check → version |
| `rest` | rest.js | Proxy HTTP request (CORS bypass) |
| `subscribe` | streaming.js | Subscribe (routes to gRPC or CometD) |
| `unsubscribe` | streaming.js | Cancel subscription |
| `getTopic` | grpc.js | Pub/Sub topic metadata |
| `getSchema` | grpc.js | Avro schema for event decoding |

### Protocol Routing

Channel pattern determines protocol:

| Channel | Protocol | Use Case |
|---------|----------|----------|
| `/event/*` | gRPC | Platform Events |
| `/topic/*` | CometD | PushTopics |
| `/data/*` | CometD | Change Data Capture |
| `/systemTopic/*` | CometD | System Topics |

### gRPC Pub/Sub API

- Connects to `api.pubsub.salesforce.com:443`
- Bidirectional streaming for subscriptions
- Avro-encoded events; schemas fetched and cached (`schema-cache.js`)
- Org ID extracted from session token format (`00Dxxxxxx!...`)

### CometD Streaming

- Faye client library
- Clients pooled by instance URL + token
- Replay IDs: -1 (LATEST), -2 (EARLIEST), or custom

### Large Payload Handling

When responses exceed 800KB (Native Messaging 1MB limit):
1. Payload stored in memory with UUID + 60-second TTL
2. Response: `{ largePayload: uuid }`
3. Extension fetches: `GET http://127.0.0.1:{port}/payload/{uuid}`
4. Requires `X-Proxy-Secret` header
5. One-time retrieval (deleted after fetch)

### Streaming Events

Pushed to extension via Native Messaging:
```javascript
{ type: 'streamEvent', subscriptionId, event: { payload, replayId, channel, protocol } }
{ type: 'streamError', subscriptionId, error, code }
{ type: 'streamEnd', subscriptionId }
```

### Security

- HTTP server binds only to `127.0.0.1` (localhost)
- Secret shared only via Native Messaging (secure channel)
- Payloads are one-time retrieval
- No external network exposure

### Project Structure

```
sftools-proxy/
├── src/
│   ├── index.js              # Entry, message routing
│   ├── native-messaging.js   # Chrome NM protocol (4-byte LE)
│   ├── http-server.js        # Large payload HTTP server
│   ├── payload-store.js      # UUID + TTL payload storage
│   ├── subscription-manager.js # Central subscription registry
│   ├── handlers/             # rest.js, grpc.js, cometd.js, streaming.js
│   ├── grpc/                 # pubsub-client.js, schema-cache.js
│   ├── cometd/               # cometd-client.js (Faye-based)
│   └── protocols/            # router.js (channel→protocol)
├── proto/                    # pubsub_api.proto
├── install.js                # Native host manifest installer
└── package.json
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `@grpc/grpc-js` | gRPC client |
| `@grpc/proto-loader` | Load .proto files |
| `avsc` | Avro schema parsing/decoding |
| `faye` | CometD/Bayeux client |

## Key Files

- `sftools-proxy/src/index.js` — Message router entry point
- `sftools-proxy/src/native-messaging.js` — NM protocol
- `sftools-proxy/src/handlers/streaming.js` — Unified subscribe/unsubscribe
- `sftools-proxy/src/grpc/pubsub-client.js` — gRPC Pub/Sub client
- `sftools-proxy/src/cometd/cometd-client.js` — Faye CometD client

## Related

- [[overview|System Architecture Overview]]
- [[background-service-worker|Background Service Worker]]
- [[event-streaming|Event Streaming]]
- [[salesforce-apis|Salesforce APIs]]
- [[chrome-extension-mv3|Chrome Extension MV3]]
- [[salesforce-api-client|Salesforce API Client]]
- [[authentication-oauth|Authentication and OAuth]]
- [[settings-and-connections|Settings and Connections]]

## Notes

- Logging goes to stderr (`/tmp/sftools-proxy.log`); stdout reserved for Native Messaging
- Install: `cd sftools-proxy && npm install && node install.js`
- Verify: `ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`
- All handlers return `{ success: true/false, ... }`
