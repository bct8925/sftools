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
│   ├── events/               # Events tab component
│   │   ├── events-tab.js
│   │   └── events.html
│   ├── settings/             # Settings tab component
│   │   ├── settings-tab.js
│   │   ├── settings.html
│   │   └── settings.css
│   ├── aura/                 # Aura Debugger page component
│   │   ├── aura-page.js
│   │   ├── aura.html
│   │   └── aura.css
│   └── record/               # Record Viewer page component
│       ├── record-page.js
│       ├── record.html
│       └── record.css
├── pages/                    # Page entry points (minimal shells)
│   ├── app/                  # Main tabbed interface
│   │   ├── app.html
│   │   └── app.js
│   ├── callback/             # OAuth callback
│   │   ├── callback.html
│   │   └── callback.js
│   ├── aura/                 # Aura Debugger entry (loads <aura-page>)
│   │   ├── aura.html
│   │   └── aura.js
│   └── record/               # Record Viewer entry (loads <record-page>)
│       ├── record.html
│       └── record.js
├── background/               # Service worker
│   ├── background.js
│   ├── native-messaging.js
│   └── auth.js
├── lib/                      # Shared utilities
│   ├── auth.js               # Multi-connection storage, active connection context
│   ├── salesforce.js         # Salesforce API helpers
│   └── utils.js              # Shared utilities, re-exports auth functions
├── public/                   # Static assets (copied to dist/)
│   └── icon.png
└── style.css                 # Global styles
```

### Build Output (`dist/`)

```
dist/
├── pages/
│   ├── app/app.html, app.js
│   ├── callback/callback.html, callback.js
│   ├── aura/aura.html, aura.js
│   └── record/record.html, record.js
├── chunks/                   # Shared code chunks
├── assets/                   # Monaco workers, fonts
├── background.js             # Service worker
├── style.css                 # Global styles
├── app.css                   # Tab component styles (bundled)
├── aura.css                  # Aura page component styles
├── record.css                # Record page component styles
└── icon.png                  # Copied from public/
```

### Local Proxy (`sftools-proxy/`)

A Node.js native messaging host that enables gRPC/CometD streaming and bypasses CORS restrictions. See `sftools-proxy/CLAUDE.md` for detailed architecture and implementation documentation.

Root files:
- `manifest.json` - Extension manifest (MV3) with OAuth2 config
- `rules.json` - Declarative net request rules
- `vite.config.js` - Vite build config (root: 'src')

## Tool Tabs (OAuth-authenticated)

Implemented:
- **REST API** - Salesforce REST API explorer with Monaco editors
- **Apex** - Anonymous Apex execution with debug log retrieval
- **Query** - SOQL query editor with tabbed results
- **Events** - Unified streaming for Platform Events (gRPC), PushTopics, and System Topics (CometD) - requires local proxy

Planned:
- **Dev Console** - Debug log viewer

## Standalone Tools

Standalone tools use the same custom element pattern as tabs. Each tool has a component in `src/components/` and a minimal entry point in `src/pages/`.

### Aura Debugger (`src/components/aura/`)

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

### Record Viewer (`src/components/record/`)

A standalone tool for viewing and editing field values on a Salesforce record. Accessed via context menu when right-clicking the extension icon.

**How to Use:**
1. Navigate to a Lightning record page (e.g., `/lightning/r/Account/001.../view`)
2. Right-click the sftools extension icon
3. Click "View/Edit Record"
4. A new tab opens showing all fields with their values

**Features:**
- Displays all fields with Label, API Name, Type, and Value columns
- Fields sorted: Id first, Name second, then alphabetically by API name
- Text inputs for updateable fields, disabled for read-only
- Modified fields highlighted visually
- Save button sends only changed fields via PATCH
- Refresh button reloads current values

**Context Menu Setup** (`src/background/background.js`):
- Registered via `chrome.contextMenus.create()` with `contexts: ['action']`
- `parseLightningUrl()` extracts object type and record ID from URL
- `findConnectionByDomain()` matches tab domain against saved connections
- Opens record viewer with URL params: `?objectType=X&recordId=Y&connectionId=Z`

**API Methods** (`src/lib/salesforce.js`):
- `getObjectDescribe(objectType)` - Gets field metadata
- `getRecord(objectType, recordId)` - Gets record data
- `updateRecord(objectType, recordId, fields)` - Updates record fields

## Local Proxy Setup

The local proxy enables gRPC and CometD streaming connections for all Salesforce event types.

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
2. Enable the "Local Proxy" toggle
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

Clicking the extension icon opens sftools in the side panel. Authorization is handled directly in the app header via the connection selector dropdown.

Side panel support is configured in `manifest.json` via the `sidePanel` permission and `side_panel.default_path` pointing to `dist/pages/app/app.html`.

## Header Features

- **Connection Selector** - Dropdown in the header to switch between saved Salesforce connections. Shows "Authorize" button if no connections exist. Each sftools instance (browser tab or sidepanel) can have its own active connection. Connection labels and Client IDs are managed in Settings → Connections.
- **Open Org Button** - Icon button that opens the authenticated org in a new browser tab using `frontdoor.jsp` with the current session token
- **Open in Tab Button** - Icon button that opens sftools in a new browser tab
- **Responsive Nav** - Tab navigation with overflow dropdown. When tabs don't fit (e.g., in side panel), excess tabs move to a "More" dropdown menu

## Component Architecture

Both tool tabs and standalone pages are implemented as Custom Elements (Web Components) without Shadow DOM. This keeps CSS simple while providing encapsulation for JS logic. All components follow the same pattern: template loaded via `?raw` import, CSS in separate file, state as class properties.

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

### Standalone Page Component Pattern

Standalone pages use the same custom element pattern as tabs. The page entry point is a minimal HTML shell that loads a custom element:

```html
<!-- src/pages/aura/aura.html (entry point - minimal shell) -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Aura Debugger - sftools</title>
    <link rel="stylesheet" href="../../style.css">
</head>
<body>
    <aura-page></aura-page>
    <script type="module" src="aura.js"></script>
</body>
</html>
```

```javascript
// src/pages/aura/aura.js (entry point - single import)
import '../../components/aura/aura-page.js';
```

```javascript
// src/components/aura/aura-page.js (component)
import template from './aura.html?raw';
import './aura.css';

class AuraPage extends HTMLElement {
    // State as class properties
    communityUrl = null;
    paramsEditor = null;

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        this.paramsEditor = this.querySelector('#paramsEditor');
        // ...
    }
    // ...
}

customElements.define('aura-page', AuraPage);
```

### Adding a New Standalone Tool

1. Create component folder: `src/components/<name>/`
2. Create files:
   - `<name>-page.js` - Custom element class
   - `<name>.html` - Template HTML (body content only, no DOCTYPE)
   - `<name>.css` - Component-specific styles
3. Create page entry: `src/pages/<name>/`
   - `<name>.html` - Minimal shell with `<<name>-page></<name>-page>`
   - `<name>.js` - Single import: `import '../../components/<name>/<name>-page.js';`
4. Add to `vite.config.js` `rollupOptions.input`:
   ```javascript
   <name>: resolve(__dirname, 'src/pages/<name>/<name>.html'),
   ```

## Key Patterns

**Background service worker** (`src/background/background.js`):
- ES module with handler map pattern for message routing
- `proxyRequired()` wrapper for handlers that need proxy connection
- All handlers return promises, unified error handling
- Context menu registration via `chrome.runtime.onInstalled` listener
- URL parsing and connection matching for Record Viewer

```javascript
// Frontend calls:
chrome.runtime.sendMessage({ type: 'fetch', url, options });
// Background handles actual fetch to bypass extension CORS restrictions
```

**Auth utilities** (`src/lib/utils.js`):
```javascript
import {
    extensionFetch,
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    // Multi-connection
    loadConnections,
    setActiveConnection,
    getActiveConnectionId,
    addConnection,
    updateConnection,
    removeConnection,
    // OAuth
    getOAuthCredentials,
    setPendingAuth,
    consumePendingAuth
} from '../../lib/utils.js';
```

**Connection change events:**
```javascript
// Listen for connection switches (in tool tab components)
document.addEventListener('connection-changed', (e) => {
    const connection = e.detail;
    this.reloadDataForNewOrg();
});
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

## OAuth Flow & Multi-Connection Architecture

Supports multiple saved Salesforce connections. Each sftools instance (browser tab or sidepanel) selects one active connection from the shared list. Different instances can use different connections simultaneously.

**Storage Schema:**
```javascript
{
  connections: [{
    id: string,          // UUID
    label: string,       // Editable label (defaults to hostname)
    instanceUrl: string,
    loginDomain: string,
    accessToken: string,
    refreshToken: string | null,
    clientId: string | null,  // Per-connection Client ID (null = use manifest default)
    createdAt: number,
    lastUsedAt: number
  }]
}
```

**Per-Instance Connection State:**
- Each sftools instance has isolated module-level state (`ACCESS_TOKEN`, `INSTANCE_URL`, `ACTIVE_CONNECTION_ID`)
- `setActiveConnection(connection)` sets the active connection for that instance
- Components call `getAccessToken()` / `getInstanceUrl()` which return the instance's active connection

**OAuth Flows (based on proxy availability):**

*Without Proxy (Implicit Flow):*
- Uses `response_type=token` - tokens returned directly in URL hash
- No refresh tokens - user must re-authorize when session expires

*With Proxy (Authorization Code Flow):*
- Uses `response_type=code` - authorization code exchanged for tokens via proxy
- Automatic token refresh on 401 responses (transparent to frontend)
- Token exchange routed through proxy to bypass CORS on Salesforce token endpoint

**Key Files:**
- `src/lib/auth.js` - Connection storage functions, active connection context, migration
- `src/pages/app/app.js` - Connection selector UI, authorization flow
- `src/pages/callback/callback.js` - Handles both code and token responses, adds/updates connections
- `src/background/auth.js` - Token exchange and refresh (per-connection)
- `src/background/background.js` - Fetch handler with connection-targeted 401 retry

**Token Refresh Flow:**
1. Frontend request includes `connectionId`
2. Background receives 401, finds connection by ID
3. If refresh token exists + proxy connected, refreshes that connection's token
4. Updates specific connection in storage array
5. Retries original request with new token
6. Frontend's in-memory token updated via `chrome.storage.onChanged` listener

**Authorization Flow:**
1. User clicks "Authorize" button (or "+ Add Connection" in dropdown)
2. OAuth redirect opens in new tab
3. Callback page adds connection to storage (or updates if same instanceUrl)
4. All sftools instances refresh their connection list via storage listener
5. If no prior connections, the new connection is auto-selected

**Configuration:**
- Callback URL: `https://sftools.dev/sftools-callback`
- Default Client ID: `manifest.json` `oauth2.client_id`

**Per-Connection Client ID:**

Each connection can have its own Client ID for Salesforce External Client Apps (or Connected Apps). This is configured in Settings → Connections.

- If a connection has a `clientId` set, that ID is used for authorization and token refresh
- If `clientId` is null, the default Client ID from `manifest.json` is used
- Changing a connection's Client ID requires re-authorization

Key functions in `src/lib/auth.js`:
- `getOAuthCredentials(connectionId?)` - Returns connection's client ID if set, otherwise manifest default
- `setPendingAuth(params)` / `consumePendingAuth()` - Store/retrieve OAuth flow state (loginDomain, clientId, connectionId)

The background service worker has its own `getBackgroundOAuthCredentials(connectionId?)` helper for token refresh.

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

The Events tab provides unified streaming across multiple Salesforce protocols. Protocol selection is transparent to users - they select a channel and the proxy routes to the appropriate client.

**Channel Types & Protocols:**
| Channel Pattern | Protocol | Example |
|----------------|----------|---------|
| `/event/*` | gRPC Pub/Sub | `/event/Order_Event__e` |
| `/topic/*` | CometD | `/topic/InvoiceUpdates` |
| `/systemTopic/*` | CometD | `/systemTopic/Logging` |

**Architecture:**
1. **Frontend** (`src/components/events/events-tab.js`) - Grouped dropdown for all channel types, subscribe/unsubscribe, event display
2. **Background** (`src/background/background.js`) - Routes messages between frontend and native host, forwards streaming events
3. **Local Proxy** (`sftools-proxy/`) - Routes to gRPC or CometD based on channel prefix

**Subscription Flow:**
1. Frontend sends `{ type: 'subscribe', channel, accessToken, instanceUrl, replayPreset }` to background
2. Background generates a `subscriptionId` and forwards to proxy
3. Proxy routes based on channel: `/event/*` → gRPC, others → CometD
4. Proxy sends streaming events back via native messaging with `{ type: 'streamEvent', subscriptionId, event }`
5. Background forwards these to all extension pages via `chrome.runtime.sendMessage`
6. Frontend filters by `subscriptionId` and displays events

**Key Proxy Components:**
- `subscription-manager.js` - Central registry for all subscriptions
- `protocols/router.js` - Routes channels to correct protocol
- `grpc/pubsub-client.js` - gRPC client for Platform Events
- `cometd/cometd-client.js` - Faye-based CometD client for PushTopics/System Topics

**Unified Message Types:**
- `streamEvent` - Event received from either protocol
- `streamError` - Error from stream
- `streamEnd` - Stream closed by server

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
