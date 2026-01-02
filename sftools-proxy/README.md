# sftools Local Proxy

Native messaging host for the sftools Chrome extension. Enables advanced features like gRPC/HTTP2 for Salesforce Pub/Sub API and bypasses CORS restrictions.

## Requirements

- Node.js 18 or later
- Chrome browser
- sftools Chrome extension installed

## Installation

1. Install dependencies (none required for Phase 1):

```bash
cd sftools-proxy
```

2. Install the native host manifest:

```bash
npm run install-host
```

This will:
- Detect your extension ID from the parent `manifest.json`
- Create the native messaging host manifest in the correct location for your OS
- Make the proxy script executable (macOS/Linux)

If auto-detection fails, you can provide the extension ID manually:

```bash
node install.js <extension-id>
```

To find your extension ID:
1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Find "Salesforce Dev Tools" and copy its ID

## Usage

The proxy runs automatically when the extension connects to it. You don't need to start it manually.

To test the connection:
1. Open the sftools extension
2. Go to Settings (options page)
3. Click "Connect to Proxy"

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Chrome Extension                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    background.js                            │ │
│  │  - connectNative() - establishes connection                 │ │
│  │  - sendProxyRequest() - sends requests, handles large data  │ │
│  │  - fetchLargePayload() - retrieves >800KB responses         │ │
│  └──────────────────────┬─────────────────────────────────────┘ │
│                         │                                        │
│                         ▼                                        │
│                 Native Messaging API                             │
└─────────────────────────┬────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    sftools-proxy (Node.js)                       │
│                                                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │  Native Messaging   │    │   HTTP Server (localhost:PORT)  │ │
│  │  - stdin/stdout     │    │   - Secret-authenticated        │ │
│  │  - JSON messages    │    │   - Large payload retrieval     │ │
│  │  - <1MB limit       │    │   - One-time fetch, auto-delete │ │
│  └─────────────────────┘    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Message Protocol

### Init (handshake)

```javascript
// Request
{ id: 1, type: 'init' }

// Response
{
    id: 1,
    success: true,
    version: '1.0.0',
    httpPort: 54321,      // OS-assigned port
    secret: 'abc123...'   // 64-char hex string
}
```

### Ping (health check)

```javascript
// Request
{ id: 2, type: 'ping' }

// Response
{ id: 2, success: true, version: '1.0.0' }
```

## Large Payload Handling

Native Messaging has a 1MB message limit. For responses ≥800KB:

1. Proxy stores the response in memory with a UUID
2. Returns `{ largePayload: 'uuid' }` via Native Messaging
3. Extension fetches from `http://127.0.0.1:{port}/payload/{uuid}`
4. Request must include `X-Proxy-Secret` header
5. Payload is deleted after retrieval (one-time use)
6. Payloads expire after 60 seconds if not fetched

## Uninstalling

```bash
npm run install-host -- --uninstall
# or
node install.js --uninstall
```

## Development

The proxy logs to stderr (stdout is reserved for Native Messaging protocol):

```bash
# Run directly for testing (will fail without stdin from Chrome)
node src/index.js
```

## Files

```
sftools-proxy/
├── package.json
├── install.js              # Native host manifest installer
├── README.md
└── src/
    ├── index.js            # Main entry point
    ├── native-messaging.js # stdin/stdout protocol
    ├── http-server.js      # Large payload HTTP server
    ├── payload-store.js    # In-memory payload storage
    └── handlers/           # Message handlers (future: rest.js, grpc.js)
```
