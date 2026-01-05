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
5. The manifest references `dist/` for all built assets

## Project Structure

```
src/
├── components/               # Reusable UI components (custom elements)
│   ├── monaco-editor/        # Monaco editor web component
│   │   └── monaco-editor.js
│   ├── query/                # Query tab component
│   │   ├── query-tab.js
│   │   ├── query.html
│   │   └── query.css
│   ├── apex/                 # Apex tab component
│   │   ├── apex-tab.js
│   │   └── apex.html
│   ├── rest-api/             # REST API tab component
│   │   ├── rest-api-tab.js
│   │   └── rest-api.html
│   └── events/               # Events tab component
│       ├── events-tab.js
│       └── events.html
├── pages/                    # Full page entry points
│   ├── app/                  # Main tabbed interface
│   │   ├── app.html
│   │   └── app.js
│   ├── popup/                # Extension popup
│   │   ├── popup.html
│   │   └── popup.js
│   ├── callback/             # OAuth callback
│   │   ├── callback.html
│   │   └── callback.js
│   ├── options/              # Extension settings
│   │   ├── options.html
│   │   └── options.js
│   └── aura/                 # Standalone Aura Debugger
│       ├── aura.html
│       └── aura.js
├── background/               # Service worker
│   ├── background.js
│   ├── native-messaging.js
│   └── auth.js
├── lib/                      # Shared utilities
│   ├── auth.js               # Frontend auth state
│   ├── salesforce.js         # Salesforce API helpers
│   └── utils.js              # Shared utilities
├── public/                   # Static assets (copied to dist/)
│   └── icon.png
└── style.css                 # Global styles
```

### Build Output (`dist/`)

```
dist/
├── pages/
│   ├── app/app.html, app.js
│   ├── popup/popup.html, popup.js
│   ├── callback/callback.html, callback.js
│   ├── options/options.html, options.js
│   └── aura/aura.html, aura.js
├── chunks/                   # Shared code chunks
├── assets/                   # Monaco workers, fonts
├── background.js             # Service worker
├── style.css                 # Global styles
├── app.css                   # Component styles (bundled)
└── icon.png                  # Copied from public/
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

### Aura Debugger (`src/pages/aura/`)

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

Side panel support is configured in `manifest.json` via the `sidePanel` permission and `side_panel.default_path` pointing to `dist/pages/app/app.html`.

## Header Features

- **Open Org Button** - Icon button in the top-right of the nav header that opens the authenticated org in a new browser tab using `frontdoor.jsp` with the current session token
- **Side Panel Button** - Icon button to the right of Open Org that opens the app in Chrome's side panel
- **Responsive Nav** - Tab navigation with overflow dropdown. When tabs don't fit (e.g., in side panel), excess tabs move to a "More" dropdown menu

## Component Architecture

Tool tabs are implemented as Custom Elements (Web Components) without Shadow DOM. This keeps CSS simple while providing encapsulation for JS logic.

### Monaco Editor Component

The `<monaco-editor>` custom element wraps Monaco Editor:

```html
<!-- In template HTML -->
<monaco-editor class="monaco-container" language="json"></monaco-editor>
<monaco-editor class="monaco-container" language="apex" readonly></monaco-editor>
```

```javascript
// In component JS
import '../monaco-editor/monaco-editor.js';

// Get reference and use
const editor = this.querySelector('.my-editor');
editor.setValue('content');
const value = editor.getValue();

// Listen for Ctrl/Cmd+Enter
editor.addEventListener('execute', () => this.handleExecute());

// Access underlying Monaco instance if needed
editor.editor?.getModel().getLineCount();
```

**Attributes:**
- `language` - Editor language (json, sql, apex, text, etc.)
- `readonly` - Makes editor read-only

**Methods:**
- `getValue()` / `setValue(value)` - Get/set editor content
- `appendValue(text)` - Append text and scroll to bottom
- `clear()` - Clear editor content
- `setMarkers(markers)` / `clearMarkers()` - Set/clear error markers

**Events:**
- `execute` - Fired on Ctrl/Cmd+Enter

**Property:**
- `editor` - Access the underlying Monaco editor instance

### Tab Component Pattern

Each tab is a custom element that loads its HTML template via Vite's `?raw` import:

```javascript
// src/components/query/query-tab.js
import template from './query.html?raw';
import './query.css';
import '../monaco-editor/monaco-editor.js';

class QueryTab extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        this.editor = this.querySelector('.query-editor');
        this.executeBtn = this.querySelector('.query-execute-btn');
    }
    // ...
}

customElements.define('query-tab', QueryTab);
```

```html
<!-- src/components/query/query.html -->
<div class="card">
    <div class="card-header">...</div>
    <div class="card-body">
        <monaco-editor class="query-editor monaco-container" language="sql"></monaco-editor>
        <button class="query-execute-btn button-brand">Execute</button>
    </div>
</div>
```

```html
<!-- src/pages/app/app.html -->
<main class="content-area">
    <query-tab id="query" class="tab-content active"></query-tab>
    <apex-tab id="apex" class="tab-content"></apex-tab>
    <!-- ... -->
</main>
```

### Adding a New Tool Tab

1. Create component folder: `src/components/<name>/`
2. Create files:
   - `<name>-tab.js` - Custom element class
   - `<name>.html` - Template HTML
   - `<name>.css` - Component-specific styles (optional)
3. Import in `src/pages/app/app.js`:
   ```javascript
   import '../../components/<name>/<name>-tab.js';
   ```
4. Add to `src/pages/app/app.html`:
   ```html
   <button class="tab-link" data-tab="<name>">Tab Name</button>
   <!-- ... -->
   <<name>-tab id="<name>" class="tab-content"></<name>-tab>
   ```

### Adding a New Standalone Tool

1. Create page folder: `src/pages/<name>/`
2. Create `<name>.html` with full HTML structure (imports `../../style.css`)
3. Create `<name>.js` with tool logic
4. Add to `vite.config.js` `rollupOptions.input`:
   ```javascript
   <name>: resolve(__dirname, 'src/pages/<name>/<name>.html'),
   ```
5. Add button in `src/pages/popup/popup.html` under `#standalone-group`
6. Add click handler in `src/pages/popup/popup.js`:
   ```javascript
   chrome.tabs.create({ url: chrome.runtime.getURL('dist/pages/<name>/<name>.html') });
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

**Auth utilities** (`src/lib/utils.js`):
```javascript
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../../lib/utils.js';
```

## CSS Specificity for Component Overrides

When component CSS needs to override global styles, use compound selectors for higher specificity:

```css
/* In query.css - overrides .card-body from style.css */
.card-body.query-card-body {
    padding: 0;
}
```

Component CSS is bundled into `app.css` by Vite. Global `style.css` loads via HTML link, so component CSS may load in different order. Using compound selectors ensures overrides work regardless of load order.

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
- `src/pages/popup/popup.js` - Checks proxy status, chooses OAuth flow
- `src/pages/callback/callback.js` - Handles both code and token responses
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

Monaco editor markers are used to highlight compilation errors with line/column info. Access the underlying editor via `this.codeEditor.editor` for marker APIs.

## Events Tab Implementation

The Events tab uses the Salesforce Pub/Sub API (gRPC) for real-time Platform Event streaming. This requires the local proxy since browsers cannot make gRPC/HTTP2 connections directly.

**Architecture:**
1. **Frontend** (`src/components/events/events-tab.js`) - UI for channel selection, subscribe/unsubscribe, event display
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
