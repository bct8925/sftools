# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

sftools is a Chrome Extension (Manifest V3) that combines multiple Salesforce developer tools into a single tabbed interface. Built using Vite with Monaco Editor for code/JSON editing.

## Build Commands

```bash
npm install                    # Install dependencies
npm run build                  # Build for production (outputs to dist/)
npm run watch                  # Build with watch mode for development
```

## Loading the Extension

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repository root
5. The manifest references `dist/` for built assets and `src/` for extension pages

## Project Structure

```
src/
├── app.html              # Main UI shell (Vite entry point)
├── app.js                # Entry point - tab navigation, imports tool modules
├── style.css             # Global styles
├── lib/
│   ├── auth.js           # Frontend auth state and storage listeners
│   ├── monaco.js         # Monaco editor setup and helpers
│   └── utils.js          # Shared utilities (extensionFetch, re-exports auth)
├── background/
│   ├── background.js     # Service worker entry, message routing
│   ├── native-messaging.js # Proxy connection via Chrome Native Messaging
│   └── auth.js           # Token exchange and refresh (routes via proxy)
├── popup/
│   ├── popup.html        # Extension popup UI
│   └── popup.js          # OAuth authorization logic
├── callback/
│   ├── callback.html     # OAuth callback page
│   └── callback.js       # Token extraction and storage
├── rest-api/
│   └── rest-api.js       # REST API tab module
├── apex/
│   └── apex.js           # Anonymous Apex execution tab module
├── query/
│   └── query.js          # SOQL query editor tab module
├── events/
│   └── events.js         # Platform Events tab module
└── aura/
    ├── aura.html         # Standalone Aura Debugger page
    └── aura.js           # Aura request logic
```

### Local Proxy (`sftools-proxy/`)

A Node.js native messaging host that enables gRPC and bypasses CORS restrictions:

```
sftools-proxy/
├── src/
│   ├── index.js              # Main entry, message routing
│   ├── native-messaging.js   # Chrome native messaging protocol
│   ├── http-server.js        # HTTP server for large payloads
│   ├── payload-store.js      # Large payload storage
│   ├── handlers/
│   │   ├── rest.js           # REST API proxy handler
│   │   └── grpc.js           # gRPC Pub/Sub handlers
│   └── grpc/
│       ├── pubsub-client.js  # Salesforce Pub/Sub API client
│       └── schema-cache.js   # Avro schema caching
├── proto/
│   └── pubsub_api.proto      # Salesforce Pub/Sub API proto
├── install.js                # Native host installer
└── sftools-proxy.sh          # Wrapper script (auto-generated)
```

Root files:
- `manifest.json` - Extension manifest (MV3) with OAuth2 config
- `rules.json` - Declarative net request rules
- `vite.config.js` - Vite build config (root: 'src')

## Tool Tabs (OAuth-authenticated)

Implemented:
- **REST API** - Salesforce REST API explorer with Monaco editors
- **Apex** - Anonymous Apex execution with debug log retrieval
- **Query** - SOQL query editor with tabbed results
- **Events** - Platform Events subscription via gRPC Pub/Sub API (requires local proxy)

Planned:
- **Dev Console** - Debug log viewer

## Standalone Tools

Standalone tools are accessible from the popup regardless of OAuth state. They appear in the "Standalone Tools" section of the popup.

### Aura Debugger (`src/aura/`)

A standalone tool for making Aura framework requests to Salesforce communities/orgs. Does not use OAuth - handles its own authentication.

**Features:**
- Community URL input for any Salesforce domain
- Unauthenticated/Authenticated mode toggle
- Aura Token and Session ID (SID) inputs for authenticated requests
- Preset action types: SelectableListDataProvider, RecordUiController, HostConfigController, Component Definition, ApexActionController, Custom
- Monaco editors for request parameters and response
- FWUID configuration in advanced settings

**Authentication Flow:**
1. If SID is provided manually, sets cookie before request and removes it after
2. If SID is blank, checks for existing browser cookie via `chrome.cookies` API
3. Aura token is passed in request body as `aura.token` parameter

**Key Files:**
- `src/aura/aura.html` - Standalone page (separate Vite entry point)
- `src/aura/aura.js` - Request logic, cookie management, presets
- `vite.config.js` - Includes `aura.html` in `rollupOptions.input`

### Adding a New Standalone Tool

1. Create `src/<tool-name>/<tool-name>.html` with full HTML structure (imports `../style.css`)
2. Create `src/<tool-name>/<tool-name>.js` with tool logic
3. Add the HTML file to `vite.config.js` `rollupOptions.input`
4. Add a button in `src/popup/popup.html` under `#standalone-group`
5. Add click handler in `src/popup/popup.js` to open `dist/<tool-name>/<tool-name>.html`

## Local Proxy Setup

The local proxy enables gRPC connections and bypasses CORS for advanced features like Platform Events.

**Installation:**
```bash
cd sftools-proxy
npm install
node install.js
```

This installs the native messaging host manifest at:
- macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`

**Connecting:**
1. Open sftools Settings tab
2. Click "Connect to Proxy"
3. Status shows "Connected" when successful

**Logging:**
Proxy logs are written to `/tmp/sftools-proxy.log`. To view:
```bash
tail -f /tmp/sftools-proxy.log
```

**Troubleshooting:**
- If port 7443 is blocked (corporate firewall), the proxy uses port 443 instead
- Verify native host is installed: check the manifest file exists
- Check Chrome's native messaging errors in `chrome://extensions` > Errors

## Opening the Extension

The popup provides a way to open sftools after authorization:

- **Open sftools** - Opens in a new browser tab (full page)

Side panel support is configured in `manifest.json` via the `sidePanel` permission and `side_panel.default_path` pointing to `dist/app.html`.

## Header Features

- **Open Org Button** - Icon button in the top-right of the nav header that opens the authenticated org in a new browser tab using `frontdoor.jsp` with the current session token
- **Side Panel Button** - Icon button to the right of Open Org that opens the app in Chrome's side panel
- **Responsive Nav** - Tab navigation with overflow dropdown. When tabs don't fit (e.g., in side panel), excess tabs move to a "More" dropdown menu

## Adding a New Tool Tab

1. Create `src/<tool-name>/<tool-name>.js` with an `init()` export
2. Add HTML for the tab content in `src/app.html`
3. Import and call `init()` in `src/app.js`

Example:
```javascript
// src/query/query.js
import { createEditor } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl } from '../lib/utils.js';

export function init() {
    // Initialize the tab
}
```

## Key Patterns

**Background service worker** (`src/background/background.js`):
- ES module with handler map pattern for message routing
- `proxyRequired()` wrapper for handlers that need proxy connection
- All handlers return promises, unified error handling

```javascript
// Frontend calls:
chrome.runtime.sendMessage({ type: 'fetch', url, options });
// Background handles actual fetch to bypass extension CORS restrictions
```

**Monaco Editor helpers** (`src/lib/monaco.js`):
```javascript
import { createEditor, createReadOnlyEditor } from '../lib/monaco.js';
const editor = createEditor(container, { language: 'json', value: '{}' });
```

**Auth utilities** (`src/lib/utils.js`):
```javascript
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';
```

## OAuth Flow

Uses a hybrid approach based on proxy availability:

**Without Proxy (Implicit Flow):**
- Uses `response_type=token` - tokens returned directly in URL hash
- Stores `accessToken` and `instanceUrl` in `chrome.storage.local`
- No refresh tokens - user must re-authorize when session expires

**With Proxy (Authorization Code Flow):**
- Uses `response_type=code` - authorization code exchanged for tokens via proxy
- Stores `accessToken`, `refreshToken`, `instanceUrl`, and `loginDomain`
- Automatic token refresh on 401 responses (transparent to frontend)
- Token exchange routed through proxy to bypass CORS on Salesforce token endpoint

**Key Files:**
- `src/popup/popup.js` - Checks proxy status, chooses OAuth flow
- `src/callback/callback.js` - Handles both code and token responses
- `src/background/auth.js` - Token exchange and refresh via proxy
- `src/lib/auth.js` - Frontend auth state with storage change listener

**Token Refresh Flow:**
1. Frontend request returns 401
2. Background checks for refresh token + proxy connection
3. If available, exchanges refresh token for new access token via proxy
4. Retries original request with new token
5. Frontend's in-memory token updated via `chrome.storage.onChanged` listener

**Configuration:**
- Callback URL: `https://sftools.dev/sftools-callback`
- Client ID: `manifest.json` `oauth2.client_id`

## Query Tab Implementation

The Query tab uses the REST Query API with the `columns=true` parameter to get accurate column metadata:

1. **Parallel API Calls** - Makes two simultaneous requests for better performance:
   - `?q=...&columns=true` - Returns column metadata without query results
   - `?q=...` - Returns actual query results
2. **Column Metadata** - The `columnMetadata` array provides column names, display names, and nested `joinColumns` for relationship fields
3. **Nested Relationships** - Relationship fields (e.g., `Account.Owner.Name`) are flattened recursively from the `joinColumns` structure, with the full path used as the column header

This approach is more reliable than client-side SOQL parsing, especially for aggregate functions (`COUNT()`, `SUM()`) and complex relationship queries.

## Apex Tab Implementation

The Apex tab uses the REST Tooling API for anonymous Apex execution:

1. **Trace Flag Setup** - Ensures a `TraceFlag` exists for the current user with a `DebugLevel` named `SFTOOLS_DEBUG`. Optimized to skip API calls if already configured correctly.
2. **Execute Anonymous** - Calls `/services/data/vXX/tooling/executeAnonymous/`
3. **Fetch Debug Log** - Queries `ApexLog WHERE Operation LIKE '%executeAnonymous/'` and fetches the log body

Monaco editor markers are used to highlight compilation errors with line/column info. SOAP API implementation is stubbed for potential future single-call debug log retrieval.

## Events Tab Implementation

The Events tab uses the Salesforce Pub/Sub API (gRPC) for real-time Platform Event streaming. This requires the local proxy since browsers cannot make gRPC/HTTP2 connections directly.

**Architecture:**
1. **Frontend** (`src/events/events.js`) - UI for channel selection, subscribe/unsubscribe, event display
2. **Background** (`src/background/background.js`) - Routes messages between frontend and native host, forwards streaming events
3. **Local Proxy** (`sftools-proxy/`) - Native messaging host that maintains gRPC connections

**Subscription Flow:**
1. Frontend sends `{ type: 'subscribe', topicName, accessToken, instanceUrl, replayPreset }` to background
2. Background generates a `subscriptionId` and forwards to proxy as `grpcSubscribe`
3. Proxy creates gRPC client, connects to `api.pubsub.salesforce.com:443`
4. Proxy sends streaming events back via native messaging with `{ type: 'grpcEvent', subscriptionId, event }`
5. Background forwards these to all extension pages via `chrome.runtime.sendMessage`
6. Frontend filters by `subscriptionId` and displays decoded events

**Key Components:**
- `pubsub-client.js` - gRPC client wrapper, handles bidirectional streaming
- `schema-cache.js` - Caches Avro schemas, decodes event payloads
- Org ID extracted from session token format (`00Dxxxxxx!...`)

**Replay Options:**
- LATEST - New events only (default)
- EARLIEST - All retained events
- CUSTOM - Start from specific replay ID

**Feature Gating:**
- Tab is disabled when proxy is not connected
- `isProxyConnected()` utility checks connection status
- Overlay prompts user to connect via Settings

## Styling Conventions

- Salesforce Lightning-inspired design
- CSS variables defined in `:root` for theming
- No external CSS frameworks
- Card-based layouts with `.card`, `.card-header`, `.card-body`
- Form elements use `.input`, `.select`, `.button-brand` classes
- Monaco containers use `.monaco-container` and `.monaco-container-lg`

## Responsive Nav Implementation

The tab navigation handles overflow for narrow viewports (side panel):

- `.tab-scroll-container` uses `display: flex`, `flex-wrap: nowrap`, `overflow: hidden`
- `.nav-overflow-dropdown` contains a "More" trigger button and `.nav-overflow-menu`
- JS in `app.js` (`initTabs`) measures tab widths on load/resize
- Tabs that don't fit are hidden with `.nav-hidden` and cloned into the dropdown menu
- Dropdown menu uses `position: fixed` to escape the container's `overflow: hidden`
- Menu position is set dynamically based on trigger button location
