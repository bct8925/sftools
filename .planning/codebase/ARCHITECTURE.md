# Architecture

**Analysis Date:** 2026-01-15

## Pattern Overview

**Overall:** Modular Chrome Extension with Custom Elements + Native Messaging Proxy

**Key Characteristics:**
- Web Components (Custom Elements) without Shadow DOM for UI
- Service Worker for background processing and message routing
- Optional Native Messaging host for advanced features (gRPC, CORS bypass)
- Multi-connection support with per-instance active connection

## Layers

**Pages Layer (Entry Points):**
- Purpose: Minimal HTML shells that load custom element components
- Contains: `src/pages/app/`, `src/pages/callback/`, `src/pages/record/`, `src/pages/schema/`
- Depends on: Component layer
- Used by: Chrome extension (manifest references these HTML files)

**Component Layer:**
- Purpose: Custom elements providing UI and user interaction
- Contains: Tab components (`query-tab`, `apex-tab`, etc.), page components (`record-page`, `schema-page`), utility components (`monaco-editor`, `button-dropdown`)
- Location: `src/components/*/`
- Depends on: Service layer (lib/)
- Used by: Pages layer

**Service Layer (lib/):**
- Purpose: Shared utilities, API wrappers, state management
- Contains: `auth.js`, `salesforce.js`, `fetch.js`, `salesforce-request.js`
- Location: `src/lib/`
- Depends on: Background layer (via chrome.runtime.sendMessage)
- Used by: Component layer

**Background Layer:**
- Purpose: Service worker for background processing, OAuth, message routing
- Contains: `background.js` (message router), `auth.js` (token exchange/refresh), `native-messaging.js`
- Location: `src/background/`
- Depends on: Chrome APIs, Native Messaging (optional)
- Used by: Service layer (via messaging)

**Proxy Layer (Optional):**
- Purpose: CORS bypass, gRPC/CometD streaming
- Contains: Message router, protocol handlers, subscription manager
- Location: `sftools-proxy/`
- Depends on: Node.js runtime, Chrome Native Messaging
- Used by: Background layer

## Data Flow

**API Request Flow (e.g., SOQL Query):**

1. User triggers action in component (QueryTab.executeQuery)
2. Component calls `salesforceRequest()` - `src/lib/salesforce-request.js`
3. `salesforceRequest()` calls `smartFetch()` - `src/lib/fetch.js`
4. `smartFetch()` routes based on proxy availability:
   - With proxy: `proxyFetch()` → sendMessage → proxy → Salesforce
   - Without proxy: `extensionFetch()` → sendMessage → background fetch
5. Background handles fetch, 401 retry with token refresh
6. Response returned to component
7. Component updates UI

**OAuth Flow:**

1. User clicks Authorize in header
2. `setPendingAuth()` stores login domain, client ID
3. OAuth window opens (login.salesforce.com)
4. Salesforce redirects to callback with code/token
5. `callback.js` handles response:
   - With proxy: Exchange code for tokens via proxy
   - Without proxy: Extract tokens from URL hash
6. `addConnection()` saves to storage
7. All instances notified via `chrome.storage.onChanged`

**Streaming Flow (Platform Events):**

1. EventsTab subscribes to channel
2. Background forwards to proxy via Native Messaging
3. Proxy routes to gRPC or CometD based on channel prefix
4. Proxy establishes streaming connection
5. Events flow: Salesforce → Proxy → Native Messaging → Background → All tabs
6. EventsTab filters by subscriptionId and displays

**State Management:**
- Per-instance: Module-level state in `auth.js` (ACCESS_TOKEN, INSTANCE_URL, ACTIVE_CONNECTION_ID)
- Shared: Chrome storage (connections array, caches)
- Each sftools tab/panel can have different active connection

## Key Abstractions

**Custom Elements:**
- Purpose: Encapsulate UI logic without Shadow DOM complexity
- Examples: `QueryTab`, `ApexTab`, `RecordPage`, `SettingsTab`
- Pattern: `connectedCallback()` loads template, `initElements()`, `attachEventListeners()`
- Location: `src/components/*/`

**Service Modules:**
- Purpose: Provide domain-specific API operations
- Examples: `salesforce.js` (all SF API calls), `auth.js` (connection management)
- Pattern: Export async functions, use `salesforceRequest()` internally
- Location: `src/lib/`

**Message Handlers:**
- Purpose: Route messages between frontend and background/proxy
- Examples: `handlers` map in `background.js`, `handleMessage()` in proxy
- Pattern: Type-based dispatch to handler functions

**Smart Fetch:**
- Purpose: Automatically route requests via proxy when available
- Location: `src/lib/fetch.js`
- Logic: `isProxyConnected()` → proxyFetch or extensionFetch

## Entry Points

**Extension UI:**
- Location: `src/pages/app/app.html` → loads tab components
- Triggers: Click extension icon (opens side panel), navigation
- Responsibilities: Connection selector, tab navigation, message routing

**Service Worker:**
- Location: `src/background/background.js`
- Triggers: Extension load, runtime messages
- Responsibilities: Fetch handling, OAuth token exchange/refresh, native messaging, context menus

**OAuth Callback:**
- Location: `src/pages/callback/callback.html`
- Triggers: Salesforce OAuth redirect
- Responsibilities: Parse code/token, save connection, close window

**Standalone Pages:**
- Record Viewer: `src/pages/record/record.html` (context menu → view/edit record)
- Schema Browser: `src/pages/schema/schema.html` (linked from Utils tab)

**Native Proxy:**
- Location: `sftools-proxy/src/index.js`
- Triggers: Native messaging connection from extension
- Responsibilities: REST proxy, gRPC, CometD, large payload handling

## Error Handling

**Strategy:** Try/catch at operation boundaries, show user-friendly errors in UI

**Patterns:**
- Components: try/catch in async handlers, update status UI
- Service layer: Throw errors with descriptive messages
- Background: Return success/error in message responses
- 401 handling: Background intercepts, refreshes token, retries

## Cross-Cutting Concerns

**Logging:**
- Console logging throughout (console.log, console.error)
- Proxy: File logging to `/tmp/sftools-proxy.log`

**Validation:**
- Input escaping via `escapeHtml()` - `src/lib/text-utils.js`
- SOQL string escaping via `escapeSoql()` - `src/lib/salesforce.js`

**Connection Management:**
- Multi-connection: Array of connections in Chrome storage
- Per-instance active: Module state in `auth.js`
- Events: `connection-changed` custom event on switch

**Caching:**
- Describe cache per connection - `src/lib/salesforce.js`
- Cleared on connection switch

---

*Architecture analysis: 2026-01-15*
*Update when major patterns change*
