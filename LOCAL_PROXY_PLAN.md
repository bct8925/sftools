# Local Proxy Implementation Plan

## Overview

This plan introduces a local NodeJS proxy application that communicates with the sftools Chrome extension via Chrome's Native Messaging API. The proxy enables advanced features (gRPC/HTTP2 for Platform Events) while maintaining the existing "Lite" tier functionality that works without it.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │  Query   │  │   Apex   │  │ REST API │  │ Platform Events │ │
│  │  (Lite)  │  │  (Lite)  │  │  (Lite)  │  │    (Advanced)   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬─────────┘ │
│       │             │             │                │            │
│       └─────────────┴─────────────┤                │            │
│                                   ▼                ▼            │
│                          ┌────────────────────────────┐         │
│                          │   background.js            │         │
│                          │   - extensionFetch (Lite)  │         │
│                          │   - nativeProxyFetch       │         │
│                          └─────────────┬──────────────┘         │
│                                        │                        │
│                                        ▼                        │
│                              Native Messaging API               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │   Local Proxy (Node)   │
                    │   - REST fetch         │
                    │   - gRPC/HTTP2         │
                    │   - Pub/Sub API        │
                    └────────────────────────┘
```

### Feature Tiers

| Feature | Lite (No Proxy) | Advanced (With Proxy) |
|---------|-----------------|----------------------|
| SOQL Query | ✅ | ✅ |
| Anonymous Apex | ✅ | ✅ |
| REST API Explorer | ✅ | ✅ (via proxy) |
| Platform Events Subscribe | ❌ | ✅ (gRPC Pub/Sub) |
| Platform Events Publish | ✅ (REST) | ✅ |

---

## Large Payload Handling

Chrome's Native Messaging API has a **1MB message size limit**. To handle larger payloads (debug logs, large query results, etc.), we use a hybrid approach:

### Strategy

1. **Small payloads (< 800KB)**: Send directly via Native Messaging
2. **Large payloads (≥ 800KB)**: Store on local HTTP server, return URL reference

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Local Proxy                                  │
│  ┌─────────────────────┐         ┌────────────────────────────────┐ │
│  │  Native Messaging   │         │  HTTP Server (localhost:PORT)  │ │
│  │  - Commands         │         │  - Large payload retrieval     │ │
│  │  - Small responses  │         │  - Secret-authenticated        │ │
│  │  - Payload URLs     │         │  - One-time fetch, auto-delete │ │
│  └─────────────────────┘         └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                │                              ▲
                │ init response:               │ GET /payload/{id}
                │ { port, secret }             │ X-Proxy-Secret: {secret}
                ▼                              │
┌─────────────────────────────────────────────────────────────────────┐
│                       Chrome Extension                               │
│  Stores port + secret in memory, uses for large payload fetches     │
└─────────────────────────────────────────────────────────────────────┘
```

### Initialization Handshake

On connection, the proxy:
1. Starts HTTP server on port `0` (OS assigns an available ephemeral port)
2. Reads the assigned port from `server.address().port`
3. Generates a cryptographically secure secret (32-byte hex string)
4. Returns both in the `init` response

```javascript
// Proxy sends on init:
{
    type: 'init',
    success: true,
    version: '1.0.0',
    httpPort: 19876,
    secret: 'a1b2c3d4e5f6...' // 64 hex chars
}
```

### Secret Authentication

The HTTP server validates every request:
- Requires `X-Proxy-Secret` header matching the generated secret
- Rejects requests without valid secret (returns 401)
- Secret is only shared via Native Messaging (secure channel)

```javascript
// Extension fetches large payload:
fetch(`http://127.0.0.1:${httpPort}/payload/${payloadId}`, {
    headers: { 'X-Proxy-Secret': secret }
});
```

### Payload Lifecycle

1. Proxy generates response > 800KB
2. Proxy stores payload in memory with UUID key
3. Proxy returns `{ largePayload: payloadId }` via Native Messaging
4. Extension fetches from HTTP server with secret header
5. Proxy deletes payload after successful fetch (one-time retrieval)
6. Payloads auto-expire after 60 seconds if not fetched

### Response Format

All proxy responses use a consistent format:

```typescript
interface ProxyResponse {
    id: number;              // Request ID for correlation
    success: boolean;

    // For small responses (< 800KB):
    data?: string;           // Response body
    status?: number;         // HTTP status
    headers?: object;        // Response headers

    // For large responses (≥ 800KB):
    largePayload?: string;   // UUID to fetch from HTTP server

    // For errors:
    error?: string;
}
```

---

## Phase 1: Local Proxy Foundation & Native Messaging

**Goal:** Create the Node.js proxy application and establish bidirectional communication with the extension.

### 1.1 Create Proxy Package Structure

```
sftools-proxy/
├── package.json
├── src/
│   ├── index.js              # Entry point, initialization
│   ├── native-messaging.js   # stdin/stdout protocol handling
│   ├── http-server.js        # Large payload HTTP server
│   ├── payload-store.js      # In-memory payload storage with TTL
│   └── handlers/
│       └── ping.js           # Health check handler
├── install.js                # Native host manifest installer
└── README.md
```

### 1.2 Implement Native Messaging Protocol

Native Messaging uses stdin/stdout with a specific message format:
- Messages are prefixed with a 4-byte little-endian message length
- Messages are JSON encoded
- Max message size: 1MB

**`src/native-messaging.js`:**
```javascript
const { stdin, stdout } = process;

// Read 4-byte length prefix, then read message
function readMessage() {
    return new Promise((resolve, reject) => {
        let lengthBuffer = Buffer.alloc(4);
        let bytesRead = 0;

        const readLength = () => {
            const chunk = stdin.read(4 - bytesRead);
            if (chunk) {
                chunk.copy(lengthBuffer, bytesRead);
                bytesRead += chunk.length;
                if (bytesRead === 4) {
                    const length = lengthBuffer.readUInt32LE(0);
                    readContent(length);
                }
            }
        };

        const readContent = (length) => {
            const messageBuffer = stdin.read(length);
            if (messageBuffer) {
                resolve(JSON.parse(messageBuffer.toString()));
            } else {
                stdin.once('readable', () => readContent(length));
            }
        };

        stdin.once('readable', readLength);
    });
}

function sendMessage(message) {
    const json = JSON.stringify(message);
    const buffer = Buffer.from(json);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(buffer.length, 0);
    stdout.write(lengthBuffer);
    stdout.write(buffer);
}

module.exports = { readMessage, sendMessage };
```

### 1.3 HTTP Server for Large Payloads

**`src/http-server.js`:**
```javascript
const http = require('http');
const { getPayload, deletePayload } = require('./payload-store');

let server = null;
let serverPort = null;
let serverSecret = null;

function generateSecret() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}

function startServer() {
    return new Promise((resolve, reject) => {
        serverSecret = generateSecret();

        server = http.createServer((req, res) => {
            // CORS headers for extension access
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'X-Proxy-Secret');

            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }

            // Validate secret
            const providedSecret = req.headers['x-proxy-secret'];
            if (providedSecret !== serverSecret) {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid secret' }));
                return;
            }

            // Extract payload ID from URL: /payload/{id}
            const match = req.url.match(/^\/payload\/([a-f0-9-]+)$/);
            if (!match) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not found' }));
                return;
            }

            const payloadId = match[1];
            const payload = getPayload(payloadId);

            if (!payload) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Payload not found or expired' }));
                return;
            }

            // Return payload and delete (one-time retrieval)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(payload);
            deletePayload(payloadId);
        });

        // Listen on port 0 - OS assigns an available ephemeral port
        server.listen(0, '127.0.0.1', () => {
            serverPort = server.address().port;
            resolve({ port: serverPort, secret: serverSecret });
        });

        server.on('error', reject);
    });
}

function getServerInfo() {
    return { port: serverPort, secret: serverSecret };
}

module.exports = { startServer, getServerInfo };
```

### 1.4 Payload Store with TTL

**`src/payload-store.js`:**
```javascript
const PAYLOAD_TTL_MS = 60000; // 60 seconds
const MAX_PAYLOAD_SIZE = 800 * 1024; // 800KB threshold

const payloads = new Map();

function storePayload(data) {
    const crypto = require('crypto');
    const id = crypto.randomUUID();

    payloads.set(id, {
        data,
        expiresAt: Date.now() + PAYLOAD_TTL_MS
    });

    // Schedule cleanup
    setTimeout(() => deletePayload(id), PAYLOAD_TTL_MS);

    return id;
}

function getPayload(id) {
    const entry = payloads.get(id);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
        payloads.delete(id);
        return null;
    }

    return entry.data;
}

function deletePayload(id) {
    payloads.delete(id);
}

function shouldUseLargePayload(data) {
    return Buffer.byteLength(data, 'utf8') >= MAX_PAYLOAD_SIZE;
}

module.exports = {
    storePayload,
    getPayload,
    deletePayload,
    shouldUseLargePayload,
    MAX_PAYLOAD_SIZE
};
```

### 1.5 Create Native Host Manifest Installer

The installer creates the manifest file and registers it with Chrome.

**Manifest location:**
- macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/`
- Linux: `~/.config/google-chrome/NativeMessagingHosts/`
- Windows: Registry + file in app directory

**`install.js`:**
```javascript
const manifest = {
    name: "com.sftools.proxy",
    description: "sftools Local Proxy",
    path: "/absolute/path/to/sftools-proxy/src/index.js",
    type: "stdio",
    allowed_origins: [
        "chrome-extension://YOUR_EXTENSION_ID/"
    ]
};
```

### 1.4 Update Extension Manifest

Add Native Messaging permission and host reference.

**`manifest.json` additions:**
```json
{
    "permissions": [
        "nativeMessaging"
    ]
}
```

### 1.5 Implement Background Script Native Messaging

**`src/background/background.js` additions:**
```javascript
let nativePort = null;
let pendingRequests = new Map();
let requestId = 0;

// HTTP server info for large payloads (received during init)
let proxyHttpPort = null;
let proxySecret = null;

// Connect to native host and perform init handshake
async function connectNative() {
    nativePort = chrome.runtime.connectNative('com.sftools.proxy');

    nativePort.onMessage.addListener((response) => {
        const pending = pendingRequests.get(response.id);
        if (pending) {
            pending.resolve(response);
            pendingRequests.delete(response.id);
        }
    });

    nativePort.onDisconnect.addListener(() => {
        nativePort = null;
        proxyHttpPort = null;
        proxySecret = null;
        // Reject all pending requests
        for (const [id, pending] of pendingRequests) {
            pending.reject(new Error('Native host disconnected'));
        }
        pendingRequests.clear();
    });

    // Perform init handshake to get HTTP server info
    const initResponse = await sendNativeMessage({ type: 'init' });
    if (initResponse.success) {
        proxyHttpPort = initResponse.httpPort;
        proxySecret = initResponse.secret;
        console.log(`Proxy connected: HTTP server on port ${proxyHttpPort}`);
    }

    return initResponse;
}

// Send message to native host (low-level)
function sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
        if (!nativePort) {
            reject(new Error('Native host not connected'));
            return;
        }
        const id = ++requestId;
        pendingRequests.set(id, { resolve, reject });
        nativePort.postMessage({ id, ...message });
    });
}

// Fetch large payload from HTTP server using secret
async function fetchLargePayload(payloadId) {
    if (!proxyHttpPort || !proxySecret) {
        throw new Error('Proxy HTTP server not available');
    }

    const response = await fetch(
        `http://127.0.0.1:${proxyHttpPort}/payload/${payloadId}`,
        { headers: { 'X-Proxy-Secret': proxySecret } }
    );

    if (!response.ok) {
        throw new Error(`Failed to fetch payload: ${response.status}`);
    }

    return await response.text();
}

// Send proxy request with automatic large payload handling
async function sendProxyRequest(message) {
    const response = await sendNativeMessage(message);

    // If response references a large payload, fetch it transparently
    if (response.largePayload) {
        response.data = await fetchLargePayload(response.largePayload);
        delete response.largePayload;
    }

    return response;
}

// Health check / connection test
async function checkNativeConnection() {
    try {
        if (!nativePort) await connectNative();
        const response = await sendNativeMessage({ type: 'ping' });
        return response.success;
    } catch {
        return false;
    }
}

// Get proxy connection info for status display
function getProxyInfo() {
    return {
        connected: !!nativePort,
        httpPort: proxyHttpPort,
        hasSecret: !!proxySecret
    };
}
```

### 1.6 Proxy Main Entry Point

**`sftools-proxy/src/index.js`:**
```javascript
const { readMessage, sendMessage } = require('./native-messaging');
const { startServer } = require('./http-server');
const { storePayload, shouldUseLargePayload } = require('./payload-store');

let httpPort = null;
let secret = null;

const handlers = {
    init: async () => {
        // Start HTTP server and return connection info
        const serverInfo = await startServer();
        httpPort = serverInfo.port;
        secret = serverInfo.secret;

        return {
            success: true,
            version: '1.0.0',
            httpPort,
            secret
        };
    },

    ping: () => ({
        success: true,
        version: '1.0.0'
    })
};

// Helper to send response, using large payload if needed
function sendResponse(id, response) {
    const json = JSON.stringify(response);

    if (shouldUseLargePayload(json)) {
        const payloadId = storePayload(json);
        sendMessage({ id, success: true, largePayload: payloadId });
    } else {
        sendMessage({ id, ...response });
    }
}

async function main() {
    while (true) {
        const message = await readMessage();
        const handler = handlers[message.type];

        let response;
        if (handler) {
            try {
                response = await handler(message);
            } catch (err) {
                response = { success: false, error: err.message };
            }
        } else {
            response = { success: false, error: `Unknown type: ${message.type}` };
        }

        sendResponse(message.id, response);
    }
}

main().catch(err => {
    console.error('Proxy fatal error:', err);
    process.exit(1);
});
```

### 1.7 Deliverables

- [ ] `sftools-proxy/` package with Native Messaging handler
- [ ] HTTP server for large payloads with secret authentication
- [ ] Payload store with 60-second TTL and one-time retrieval
- [ ] `install.js` script that sets up native host manifest
- [ ] Background script with init handshake and large payload fetching
- [ ] `sendProxyRequest()` that transparently handles large responses
- [ ] Storage of proxy connection status in `chrome.storage.local`

---

## Phase 2: Options Page & Feature Gating

**Goal:** Create an options page to configure proxy connection and implement UI gating for advanced features.

### 2.1 Create Options Page

**`src/options/options.html`:**
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="../style.css">
</head>
<body>
    <div class="options-container">
        <h1>sftools Settings</h1>

        <div class="card">
            <div class="card-header">
                <h2>Local Proxy</h2>
            </div>
            <div class="card-body">
                <p>The local proxy enables advanced features like Platform Event streaming via gRPC.</p>

                <div class="proxy-status">
                    <span id="proxy-status-indicator" class="status-indicator disconnected"></span>
                    <span id="proxy-status-text">Not connected</span>
                </div>

                <button id="connect-proxy-btn" class="button-brand">
                    Connect to Proxy
                </button>

                <details class="m-top_medium">
                    <summary>Installation Instructions</summary>
                    <ol>
                        <li>Install Node.js 18 or later</li>
                        <li>Download sftools-proxy from [link]</li>
                        <li>Run: <code>npm install && npm run install-host</code></li>
                        <li>Click "Connect to Proxy" above</li>
                    </ol>
                </details>
            </div>
        </div>
    </div>
    <script type="module" src="options.js"></script>
</body>
</html>
```

**`src/options/options.js`:**
```javascript
async function checkProxyConnection() {
    const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
    updateStatus(response.connected);
}

async function connectProxy() {
    const response = await chrome.runtime.sendMessage({ type: 'connectProxy' });
    updateStatus(response.connected);
}

function updateStatus(connected) {
    const indicator = document.getElementById('proxy-status-indicator');
    const text = document.getElementById('proxy-status-text');

    if (connected) {
        indicator.className = 'status-indicator connected';
        text.textContent = 'Connected';
    } else {
        indicator.className = 'status-indicator disconnected';
        text.textContent = 'Not connected';
    }
}

document.getElementById('connect-proxy-btn').addEventListener('click', connectProxy);
checkProxyConnection();
```

### 2.2 Update Manifest for Options Page

**`manifest.json` additions:**
```json
{
    "options_page": "dist/options/options.html"
}
```

### 2.3 Add Options Link to Popup

**`src/popup/popup.html` additions:**
```html
<button id="options-btn" class="popup-button">Settings</button>
```

**`src/popup/popup.js` additions:**
```javascript
document.getElementById('options-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});
```

### 2.4 Implement Feature Gating in Main App

**`src/lib/utils.js` additions:**
```javascript
let PROXY_CONNECTED = false;

export function isProxyConnected() {
    return PROXY_CONNECTED;
}

export async function checkProxyStatus() {
    const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
    PROXY_CONNECTED = response.connected;
    return PROXY_CONNECTED;
}
```

**`src/app.js` modifications:**

Add initialization check and apply disabled styling to advanced tabs:
```javascript
import { checkProxyStatus, isProxyConnected } from './lib/utils.js';

async function initApp() {
    await loadAuthTokens();
    await checkProxyStatus();

    // Apply feature gating
    updateFeatureGating();

    // Initialize tabs...
}

function updateFeatureGating() {
    const eventsTab = document.querySelector('[data-tab="events"]');
    const eventsContent = document.getElementById('events');

    if (!isProxyConnected()) {
        eventsTab.classList.add('tab-disabled');
        eventsContent.classList.add('feature-disabled');
        // Add overlay with message
        const overlay = document.createElement('div');
        overlay.className = 'feature-gate-overlay';
        overlay.innerHTML = `
            <div class="feature-gate-message">
                <h3>Proxy Required</h3>
                <p>Platform Events require the local proxy. Configure it in Settings.</p>
                <button onclick="chrome.runtime.openOptionsPage()">Open Settings</button>
            </div>
        `;
        eventsContent.appendChild(overlay);
    }
}
```

### 2.5 Add Feature Gating Styles

**`src/style.css` additions:**
```css
.tab-disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.feature-disabled {
    position: relative;
    pointer-events: none;
}

.feature-gate-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    pointer-events: auto;
}

.feature-gate-message {
    text-align: center;
    padding: 2rem;
}

.status-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 8px;
}

.status-indicator.connected {
    background-color: #4bca81;
}

.status-indicator.disconnected {
    background-color: #c23934;
}
```

### 2.6 Deliverables

- [ ] Options page (`src/options/options.html`, `options.js`)
- [ ] Updated manifest with `options_page`
- [ ] Settings button in popup
- [ ] Feature gating logic in `app.js`
- [ ] Visual indicators for disabled features
- [ ] Proxy status check on app load

---

## Phase 3: REST Proxy Support

**Goal:** Add REST API proxying through the native host, providing an alternative to `extensionFetch()`.

### 3.1 Add REST Handler to Proxy

**`sftools-proxy/src/handlers/rest.js`:**
```javascript
async function handleRest(request) {
    const { url, method, headers, body } = request;

    try {
        const response = await fetch(url, {
            method: method || 'GET',
            headers: headers || {},
            body: body ? JSON.stringify(body) : undefined
        });

        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });

        const data = await response.text();

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { handleRest };
```

### 3.2 Register REST Handler in Main Router

Add the REST handler to the handlers object in `index.js` (from Phase 1):

**`sftools-proxy/src/index.js` (add to handlers):**
```javascript
const { handleRest } = require('./handlers/rest');

const handlers = {
    init: async () => { /* ... from Phase 1 ... */ },
    ping: () => ({ success: true, version: '1.0.0' }),
    rest: handleRest  // Add this line
};

// The sendResponse() helper from Phase 1 automatically handles large payloads:
// - REST responses < 800KB: sent directly via Native Messaging
// - REST responses ≥ 800KB: stored in payload store, ID returned, extension
//   fetches via HTTP with secret header
```

The large payload handling is transparent - the REST handler just returns the response object, and `sendResponse()` in the main loop decides whether to use Native Messaging or the HTTP fallback.

### 3.3 Add proxyFetch to Utils

**`src/lib/utils.js` additions:**
```javascript
// Fetch via native proxy (bypasses all CORS restrictions)
export async function proxyFetch(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
            type: 'proxyFetch',
            url,
            method: options.method,
            headers: options.headers,
            body: options.body
        });
    }
    throw new Error('Proxy fetch requires extension context');
}

// Smart fetch: uses proxy if available, falls back to extensionFetch
export async function smartFetch(url, options = {}) {
    if (isProxyConnected()) {
        return await proxyFetch(url, options);
    }
    return await extensionFetch(url, options);
}
```

### 3.4 Update Background Script

**`src/background/background.js` additions:**
```javascript
// Handle proxyFetch requests from extension pages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'proxyFetch') {
        // Use sendProxyRequest (from Phase 1) which automatically handles
        // large payloads by fetching them from the HTTP server
        sendProxyRequest({
            type: 'rest',
            url: request.url,
            method: request.method,
            headers: request.headers,
            body: request.body
        })
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});
```

Note: `sendProxyRequest()` (defined in Phase 1) transparently handles large payloads:
1. Sends request to proxy via Native Messaging
2. If response contains `largePayload` ID, fetches data from HTTP server using secret
3. Returns complete response to caller

### 3.5 Deliverables

- [ ] REST handler in proxy (`handlers/rest.js`)
- [ ] Handler registered in main router
- [ ] `proxyFetch()` function in utils
- [ ] `smartFetch()` function for automatic fallback
- [ ] Background script routing using `sendProxyRequest()`
- [ ] Large payloads (≥800KB) automatically handled via HTTP fallback

---

## Phase 4: gRPC Support

**Goal:** Add generic gRPC/HTTP2 support to the proxy for Salesforce Pub/Sub API.

### 4.1 Add gRPC Dependencies

**`sftools-proxy/package.json`:**
```json
{
    "dependencies": {
        "@grpc/grpc-js": "^1.9.0",
        "@grpc/proto-loader": "^0.7.0"
    }
}
```

### 4.2 Add Salesforce Pub/Sub Proto

Download and include the Salesforce Pub/Sub API proto file:

**`sftools-proxy/proto/pubsub_api.proto`:**
(Salesforce provides this at their developer docs)

### 4.3 Create gRPC Client Wrapper

**`sftools-proxy/src/grpc/pubsub-client.js`:**
```javascript
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../proto/pubsub_api.proto');

// Active subscriptions by ID
const subscriptions = new Map();

async function loadProto() {
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
    return grpc.loadPackageDefinition(packageDefinition);
}

function createClient(instanceUrl, accessToken) {
    const proto = loadProto();
    const PubSub = proto.eventbus.v1.PubSub;

    // Salesforce Pub/Sub endpoint
    const endpoint = instanceUrl.replace('https://', '').replace('.my.salesforce.com', '.my.salesforce.com:443');

    const credentials = grpc.credentials.createSsl();
    const metadata = new grpc.Metadata();
    metadata.add('accesstoken', accessToken);
    metadata.add('instanceurl', instanceUrl);
    metadata.add('tenantid', extractOrgId(accessToken));

    return new PubSub(endpoint, credentials);
}

function extractOrgId(accessToken) {
    // Extract org ID from access token (it's in the JWT payload)
    // Format: header.payload.signature
    const parts = accessToken.split('.');
    if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.organization_id;
    }
    return '';
}

module.exports = { createClient, subscriptions };
```

### 4.4 Add gRPC Handler

**`sftools-proxy/src/handlers/grpc.js`:**
```javascript
const { createClient, subscriptions } = require('../grpc/pubsub-client');
const { sendMessage } = require('../native-messaging');

async function handleGrpcSubscribe(request, sendStreamEvent) {
    const { subscriptionId, instanceUrl, accessToken, topic, replayPreset } = request;

    const client = createClient(instanceUrl, accessToken);

    const subscribeRequest = {
        topic_name: topic,
        replay_preset: replayPreset || 'LATEST',
        num_requested: 100
    };

    const call = client.Subscribe();

    call.on('data', (event) => {
        sendStreamEvent({
            type: 'grpcEvent',
            subscriptionId,
            event: decodeEvent(event)
        });
    });

    call.on('error', (error) => {
        sendStreamEvent({
            type: 'grpcError',
            subscriptionId,
            error: error.message
        });
        subscriptions.delete(subscriptionId);
    });

    call.on('end', () => {
        sendStreamEvent({
            type: 'grpcEnd',
            subscriptionId
        });
        subscriptions.delete(subscriptionId);
    });

    // Start the subscription
    call.write(subscribeRequest);

    subscriptions.set(subscriptionId, { call, client });

    return { success: true, subscriptionId };
}

async function handleGrpcUnsubscribe(request) {
    const { subscriptionId } = request;
    const sub = subscriptions.get(subscriptionId);

    if (sub) {
        sub.call.end();
        subscriptions.delete(subscriptionId);
        return { success: true };
    }

    return { success: false, error: 'Subscription not found' };
}

function decodeEvent(event) {
    // Decode Avro payload from Salesforce
    // The event contains schema_id and payload
    return {
        replayId: event.replay_id,
        schemaId: event.schema_id,
        payload: event.payload // Will need Avro decoding
    };
}

module.exports = { handleGrpcSubscribe, handleGrpcUnsubscribe };
```

### 4.5 Add Schema Cache Handler

Salesforce Pub/Sub API uses Avro encoding. We need to fetch and cache schemas.

**`sftools-proxy/src/handlers/schema.js`:**
```javascript
const avro = require('avsc');

const schemaCache = new Map();

async function getSchema(client, schemaId) {
    if (schemaCache.has(schemaId)) {
        return schemaCache.get(schemaId);
    }

    return new Promise((resolve, reject) => {
        client.GetSchema({ schema_id: schemaId }, (error, response) => {
            if (error) {
                reject(error);
            } else {
                const schema = avro.Type.forSchema(JSON.parse(response.schema_json));
                schemaCache.set(schemaId, schema);
                resolve(schema);
            }
        });
    });
}

function decodePayload(schema, payload) {
    return schema.fromBuffer(Buffer.from(payload));
}

module.exports = { getSchema, decodePayload };
```

### 4.6 Deliverables

- [ ] gRPC dependencies installed
- [ ] Pub/Sub API proto file included
- [ ] gRPC client wrapper for Salesforce
- [ ] Subscribe/Unsubscribe handlers
- [ ] Avro schema caching and decoding
- [ ] Stream event forwarding to extension

---

## Phase 5: Platform Events Tab with Pub/Sub API

**Goal:** Rewrite the Platform Events tab to use the Pub/Sub API via the local proxy.

### 5.1 Update Background Script for Streaming

**`src/background/background.js` additions:**
```javascript
// Track active stream listeners
const streamListeners = new Map();

// Handle incoming stream events from native host
nativePort.onMessage.addListener((message) => {
    if (message.type === 'grpcEvent' || message.type === 'grpcError' || message.type === 'grpcEnd') {
        // Forward to content scripts
        chrome.runtime.sendMessage(message);
    }

    // Also handle request responses
    const pending = pendingRequests.get(message.id);
    if (pending) {
        pending.resolve(message);
        pendingRequests.delete(message.id);
    }
});

// Handle subscription requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'subscribe') {
        const subscriptionId = crypto.randomUUID();
        sendNativeMessage({
            type: 'grpcSubscribe',
            subscriptionId,
            instanceUrl: request.instanceUrl,
            accessToken: request.accessToken,
            topic: request.topic,
            replayPreset: request.replayPreset
        })
        .then(response => sendResponse({ ...response, subscriptionId }))
        .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }

    if (request.type === 'unsubscribe') {
        sendNativeMessage({
            type: 'grpcUnsubscribe',
            subscriptionId: request.subscriptionId
        })
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
});
```

### 5.2 Rewrite Events Tab

**`src/events/events.js` (rewritten):**
```javascript
import { createEditor, createReadOnlyEditor, monaco } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated, isProxyConnected } from '../lib/utils.js';

let channelSelect, subscribeBtn, streamStatus, streamEditor;
let clearBtn, publishChannelSelect, publishEditor, publishBtn, publishStatus;

let currentSubscriptionId = null;
let isSubscribed = false;

export function init() {
    // Get DOM references
    channelSelect = document.getElementById('event-channel-select');
    subscribeBtn = document.getElementById('event-subscribe-btn');
    streamStatus = document.getElementById('event-stream-status');
    clearBtn = document.getElementById('event-clear-btn');
    publishChannelSelect = document.getElementById('event-publish-channel');
    publishBtn = document.getElementById('event-publish-btn');
    publishStatus = document.getElementById('event-publish-status');

    // Initialize Monaco editors
    streamEditor = createReadOnlyEditor(document.getElementById('event-stream-editor'), {
        language: 'json',
        value: '// Waiting for events...\n',
        wordWrap: 'on'
    });

    publishEditor = createEditor(document.getElementById('event-publish-editor'), {
        language: 'json',
        value: '{\n  \n}'
    });

    publishEditor.addAction({
        id: 'publish-event',
        label: 'Publish Event',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        run: () => publishEvent()
    });

    // Event handlers
    subscribeBtn.addEventListener('click', toggleSubscription);
    clearBtn.addEventListener('click', clearStream);
    publishBtn.addEventListener('click', publishEvent);

    // Sync channel selects
    channelSelect.addEventListener('change', () => {
        publishChannelSelect.value = channelSelect.value;
    });
    publishChannelSelect.addEventListener('change', () => {
        channelSelect.value = publishChannelSelect.value;
    });

    // Listen for stream events from background
    chrome.runtime.onMessage.addListener(handleStreamMessage);

    loadEventChannels();
}

function handleStreamMessage(message) {
    if (message.subscriptionId !== currentSubscriptionId) return;

    switch (message.type) {
        case 'grpcEvent':
            appendEvent(message.event);
            break;
        case 'grpcError':
            appendSystemMessage(`Error: ${message.error}`);
            updateStreamStatus('Error', 'error');
            break;
        case 'grpcEnd':
            appendSystemMessage('Stream ended');
            handleDisconnect();
            break;
    }
}

async function toggleSubscription() {
    if (isSubscribed) {
        await unsubscribe();
    } else {
        await subscribe();
    }
}

async function subscribe() {
    const channel = channelSelect.value;
    if (!channel) {
        updateStreamStatus('Select a channel', 'error');
        return;
    }

    if (!isAuthenticated()) {
        updateStreamStatus('Not authenticated', 'error');
        return;
    }

    if (!isProxyConnected()) {
        updateStreamStatus('Proxy required', 'error');
        return;
    }

    updateStreamStatus('Connecting...', 'loading');
    subscribeBtn.disabled = true;

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'subscribe',
            instanceUrl: getInstanceUrl(),
            accessToken: getAccessToken(),
            topic: `/event/${channel}`,
            replayPreset: 'LATEST'
        });

        if (response.success) {
            currentSubscriptionId = response.subscriptionId;
            isSubscribed = true;
            updateStreamStatus('Subscribed', 'success');
            subscribeBtn.textContent = 'Unsubscribe';
            appendSystemMessage(`Subscribed to /event/${channel}`);
        } else {
            throw new Error(response.error);
        }
    } catch (err) {
        updateStreamStatus('Error', 'error');
        appendSystemMessage(`Error: ${err.message}`);
    } finally {
        subscribeBtn.disabled = false;
    }
}

async function unsubscribe() {
    if (!currentSubscriptionId) return;

    try {
        await chrome.runtime.sendMessage({
            type: 'unsubscribe',
            subscriptionId: currentSubscriptionId
        });
    } catch (err) {
        console.error('Unsubscribe error:', err);
    }

    handleDisconnect();
}

function handleDisconnect() {
    currentSubscriptionId = null;
    isSubscribed = false;
    subscribeBtn.textContent = 'Subscribe';
    subscribeBtn.disabled = false;
    updateStreamStatus('Disconnected', '');
}

// ... (keep existing loadEventChannels, buildChannelOptions, appendEvent,
//      appendSystemMessage, clearStream, publishEvent, updateStreamStatus,
//      updatePublishStatus functions)
```

### 5.3 Add Replay Options

Extend the UI to support replay options (Salesforce Pub/Sub supports replay from a specific position).

**`src/app.html` additions (in events tab):**
```html
<div class="form-element">
    <label for="event-replay-select">Replay From</label>
    <select id="event-replay-select" class="select">
        <option value="LATEST">Latest (new events only)</option>
        <option value="EARLIEST">Earliest (all retained events)</option>
        <option value="CUSTOM">Custom Replay ID</option>
    </select>
</div>
<div id="event-replay-custom" class="form-element" style="display: none;">
    <label for="event-replay-id">Replay ID</label>
    <input type="text" id="event-replay-id" class="input" placeholder="Enter replay ID">
</div>
```

### 5.4 Topic Metadata via Pub/Sub API

Add a handler to fetch topic metadata using the Pub/Sub API GetTopic RPC.

**`sftools-proxy/src/handlers/topics.js`:**
```javascript
async function handleGetTopic(request) {
    const { instanceUrl, accessToken, topicName } = request;
    const client = createClient(instanceUrl, accessToken);

    return new Promise((resolve, reject) => {
        client.GetTopic({ topic_name: topicName }, (error, response) => {
            if (error) {
                resolve({ success: false, error: error.message });
            } else {
                resolve({
                    success: true,
                    topic: {
                        name: response.topic_name,
                        schemaId: response.schema_id,
                        canPublish: response.can_publish,
                        canSubscribe: response.can_subscribe
                    }
                });
            }
        });
    });
}

module.exports = { handleGetTopic };
```

### 5.5 Deliverables

- [ ] Updated background script for streaming
- [ ] Rewritten events.js using Pub/Sub API
- [ ] Replay position support (LATEST, EARLIEST, custom)
- [ ] Topic metadata fetching
- [ ] Stream event handling and display
- [ ] Proper cleanup on unsubscribe/disconnect

---

## Testing Plan

### Phase 1 Testing
1. Run `npm run install-host` and verify manifest is created
2. Open extension options and click "Connect to Proxy"
3. Verify "ping" response is received and status shows connected

### Phase 2 Testing
1. Disconnect proxy and verify Platform Events tab shows disabled overlay
2. Connect proxy and verify overlay disappears
3. Verify status persists across extension reload

### Phase 3 Testing
1. Make REST API call via REST API tab
2. Verify it works with proxy connected
3. Verify fallback to extensionFetch when proxy disconnected

### Phase 4 Testing
1. Use a simple gRPC test endpoint to verify client works
2. Test connection to Salesforce Pub/Sub API endpoint
3. Verify schema fetching works

### Phase 5 Testing
1. Subscribe to a Platform Event channel
2. Publish an event via REST API
3. Verify event appears in stream editor
4. Test unsubscribe and reconnect flows
5. Test replay from EARLIEST
6. Test with custom replay ID

---

## Future Enhancements

1. **Auto-reconnect** - Automatically reconnect on proxy disconnect
2. **Multiple subscriptions** - Subscribe to multiple channels simultaneously
3. **Event filtering** - Filter displayed events by field values
4. **Export events** - Export received events to JSON file
5. **Change Data Capture** - Support CDC channels in addition to Platform Events
6. **Publishing via Pub/Sub** - Use Pub/Sub API for publishing (supports larger payloads)
