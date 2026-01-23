# sftools-proxy - Native Messaging Host

> **Parent context**: This extends [../CLAUDE.md](../CLAUDE.md)

## Overview

| Aspect | Details |
|--------|---------|
| **Runtime** | Node.js >= 18.0.0 |
| **Protocol** | Chrome Native Messaging |
| **Purpose** | gRPC, CometD streaming, CORS bypass |

sftools-proxy is a Node.js native messaging host for the sftools Chrome extension. It enables capabilities that browsers cannot provide directly:

- **gRPC/HTTP2 connections** for Salesforce Pub/Sub API (Platform Events)
- **CometD/Bayeux protocol** for PushTopics, Change Data Capture, and System Topics
- **REST API proxying** to bypass CORS restrictions
- **Large payload handling** via HTTP fallback (Native Messaging has 1MB limit)

## Quick Commands

```bash
npm install           # Install dependencies
npm start             # Run the proxy (normally launched by Chrome)
npm run install-host  # Install native messaging host manifest
node install.js -u    # Uninstall native messaging host manifest
npm run logs          # Tail proxy logs
```

## Installation

The installer creates:

1. **Shell wrapper** (`sftools-proxy.sh`) with correct Node.js path
2. **Native host manifest** at:
   - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`
   - Linux: `~/.config/google-chrome/NativeMessagingHosts/com.sftools.proxy.json`

```bash
cd sftools-proxy
npm install
node install.js
```

## Project Structure

```
sftools-proxy/
├── src/
│   ├── index.js              # Entry point, message routing
│   ├── native-messaging.js   # Chrome native messaging protocol
│   ├── http-server.js        # HTTP server for large payloads
│   ├── payload-store.js      # Large payload storage with TTL
│   ├── subscription-manager.js  # Central subscription registry
│   ├── handlers/
│   │   ├── rest.js           # REST API proxy handler
│   │   ├── grpc.js           # gRPC Pub/Sub handlers
│   │   ├── cometd.js         # CometD streaming handlers
│   │   └── streaming.js      # Unified subscribe/unsubscribe router
│   ├── grpc/
│   │   ├── pubsub-client.js  # Salesforce Pub/Sub API gRPC client
│   │   └── schema-cache.js   # Avro schema caching and decoding
│   ├── cometd/
│   │   └── cometd-client.js  # Salesforce CometD/Faye client
│   └── protocols/
│       └── router.js         # Channel-to-protocol routing
├── proto/
│   └── pubsub_api.proto      # Salesforce Pub/Sub API proto definition
├── install.js                # Native host manifest installer
└── sftools-proxy.sh          # Wrapper script (auto-generated)
```

## Architecture

### Message Flow

```
Chrome Extension
    ↓ Native Messaging (stdin)
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
| `init` | index.js | Start HTTP server, return port and secret |
| `ping` | index.js | Health check, returns version |
| `rest` | rest.js | Proxy HTTP request to bypass CORS |
| `subscribe` | streaming.js | Subscribe to channel (routes to gRPC or CometD) |
| `unsubscribe` | streaming.js | Cancel subscription |
| `getTopic` | grpc.js | Get Pub/Sub topic metadata |
| `getSchema` | grpc.js | Get Avro schema for event decoding |

### Protocol Routing

The protocol router (`protocols/router.js`) determines which protocol to use:

| Channel Pattern | Protocol | Use Case |
|-----------------|----------|----------|
| `/event/*` | gRPC | Platform Events |
| `/topic/*` | CometD | PushTopics |
| `/data/*` | CometD | Change Data Capture |
| `/systemTopic/*` | CometD | System Topics |

## Key Implementation Details

### Native Messaging Protocol

```javascript
// Message format: [4-byte LE length][JSON payload]
// Max message size: 1MB (threshold at 800KB for safety)

// Reading
const lengthBuffer = await readBytes(4);
const messageLength = lengthBuffer.readUInt32LE(0);
const messageBuffer = await readBytes(messageLength);

// Writing
const lengthBuffer = Buffer.alloc(4);
lengthBuffer.writeUInt32LE(messageBuffer.length, 0);
process.stdout.write(lengthBuffer);
process.stdout.write(messageBuffer);
```

### Large Payload Handling

When responses exceed 800KB:

1. Payload stored in memory with UUID and 60-second TTL
2. Response contains `{ largePayload: uuid }` instead of data
3. Extension fetches via HTTP: `GET http://127.0.0.1:{port}/payload/{uuid}`
4. Requires `X-Proxy-Secret` header for authentication
5. Payload deleted after retrieval (one-time use)

### Subscription Manager

Central registry for all active subscriptions regardless of protocol:

```javascript
subscriptionManager.add(subscriptionId, {
    protocol: 'grpc' | 'cometd',
    channel: '/event/MyEvent__e',
    cleanup: () => { /* cancel stream */ }
});
```

### Streaming Event Messages

Events pushed to extension via Native Messaging:

```javascript
// Success
{ type: 'streamEvent', subscriptionId, event: { payload, replayId, channel, protocol } }

// Error
{ type: 'streamError', subscriptionId, error, code }

// Stream ended
{ type: 'streamEnd', subscriptionId }
```

## gRPC Pub/Sub API

- Connects to `api.pubsub.salesforce.com:443`
- Uses bidirectional streaming for subscriptions
- Events are Avro-encoded; schemas are fetched and cached
- Org ID extracted from session token format (`00Dxxxxxx!...`)

### Key Files

- `grpc/pubsub-client.js` - gRPC client for subscriptions
- `grpc/schema-cache.js` - Avro schema caching and decoding
- `proto/pubsub_api.proto` - Protocol definitions

## CometD Streaming

- Uses Faye client library
- Clients are pooled by instance URL + token
- Supports replay IDs: -1 (LATEST), -2 (EARLIEST), or custom

### Key Files

- `cometd/cometd-client.js` - Faye-based client
- `handlers/cometd.js` - CometD message handlers

## Dependencies

| Package | Purpose |
|---------|---------|
| `@grpc/grpc-js` | gRPC client for Node.js |
| `@grpc/proto-loader` | Load .proto files dynamically |
| `avsc` | Avro schema parsing and encoding/decoding |
| `faye` | CometD/Bayeux protocol client |

## Logging

All logs go to stderr (stdout reserved for Native Messaging):

```javascript
console.error(`[gRPC] Subscribing to ${topicName}`);
console.error(`[CometD] Event received on ${channel}`);
console.error(`[Schema] Cache hit for schema ${schemaId}`);
```

Logs are written to `/tmp/sftools-proxy.log` by the shell wrapper.

```bash
# View logs
tail -f /tmp/sftools-proxy.log

# Or use npm script
npm run logs
```

## Adding a New Handler

1. **Create handler in `src/handlers/`**:

```javascript
// src/handlers/my-handler.js

/**
 * Handle my custom message type.
 * @param {Object} request - Message from extension
 * @returns {Promise<Object>} Response to send back
 */
async function handleMyType(request) {
    const { requiredField } = request;

    if (!requiredField) {
        return { success: false, error: 'Missing requiredField' };
    }

    try {
        // Do work
        const result = await doSomething(requiredField);
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { handleMyType };
```

2. **Register in `src/index.js`**:

```javascript
const { handleMyType } = require('./handlers/my-handler');

const handlers = {
    // ...existing handlers
    myType: handleMyType
};
```

## Adding a New Streaming Protocol

1. Create client in `src/<protocol>/<protocol>-client.js`
2. Create handler in `src/handlers/<protocol>.js`
3. Update `src/protocols/router.js` with routing logic
4. Update `src/handlers/streaming.js` to route to new handler

## Error Handling

- All handlers return `{ success: true/false, ... }`
- Errors include descriptive `error` message
- Uncaught exceptions logged and cause process exit
- Streaming errors sent via `streamError` message type

## Security

- HTTP server binds only to `127.0.0.1` (localhost)
- Secret shared only via Native Messaging (secure channel)
- Payloads are one-time retrieval
- No external network exposure

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Proxy not starting | Check native host manifest exists |
| Connection refused | Verify port 7443 not blocked |
| Events not received | Check proxy logs for errors |
| Large payload timeout | Increase TTL in payload-store.js |

### Verify Installation

```bash
# Check manifest exists
ls ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json

# Check Node.js version
node --version  # Should be >= 18.0.0

# Test manual start
node src/index.js  # Should wait for stdin
```

### Chrome Extension Errors

Check `chrome://extensions` > Errors for native messaging issues:
- "Native host has exited" - Check proxy logs
- "Specified native messaging host not found" - Run install.js
