# Architecture

**Analysis Date:** 2026-01-15

## Pattern Overview

**Overall:** Hybrid Chrome Extension + Native Proxy with Layered Component Architecture

**Key Characteristics:**
- Chrome Extension (MV3) with side panel UI
- Custom Web Components (no Shadow DOM) for tab-based interface
- Native proxy for gRPC streaming and CORS bypass
- Multi-connection OAuth support with per-instance state
- Service worker for background message routing

## Layers

**Presentation Layer:**
- Purpose: User interface and interaction handling
- Contains: Custom Element components (tabs, pages, modals)
- Location: `src/components/**/*.js`
- Depends on: Service layer for API calls, lib utilities
- Used by: Entry point pages

**Service Layer:**
- Purpose: Salesforce API operations and business logic
- Contains: API wrappers, auth management, caching
- Location: `src/lib/*.js`
- Depends on: Fetch utilities, Chrome storage
- Used by: All components

**Background Layer:**
- Purpose: Extension message routing, OAuth handling, proxy bridge
- Contains: Service worker handlers, native messaging
- Location: `src/background/*.js`
- Depends on: Native proxy (optional), Chrome APIs
- Used by: Frontend via chrome.runtime.sendMessage()

**Proxy Layer:**
- Purpose: gRPC/CometD streaming, CORS bypass, token refresh
- Contains: Protocol clients, subscription management
- Location: `sftools-proxy/src/**/*.js`
- Depends on: Node.js, gRPC/Faye libraries
- Used by: Background worker via native messaging

## Data Flow

**API Request Flow:**

1. Component calls `salesforceRequest()` from `src/lib/salesforce-request.js`
2. `salesforceRequest()` calls `smartFetch()` from `src/lib/fetch.js`
3. `smartFetch()` checks `isProxyConnected()`:
   - If connected → `proxyFetch()` → background `proxyRequest` → proxy HTTP server
   - If not connected → `extensionFetch()` → background `fetch` → Chrome extension fetch
4. Background handles response, triggers 401 retry if needed
5. Response returned to component, parsed as JSON
6. Component updates DOM with results

**OAuth Authorization Flow:**

1. User clicks "Authorize" → `startAuthorization()` in `src/pages/app/app.js`
2. Opens new tab to `{loginDomain}/services/oauth2/authorize`
3. Salesforce redirects to `https://sftools.dev/sftools-callback`
4. Callback page (`src/pages/callback/callback.js`) receives code/token
5. If code flow: sends `tokenExchange` message to background
6. Background (`src/background/auth.js`) exchanges code via proxy
7. Connection saved to storage, all instances notified via `chrome.storage.onChanged`

**Streaming Subscription Flow:**

1. Events tab sends `subscribe` message to background
2. Background forwards to proxy via native messaging
3. Proxy router (`sftools-proxy/src/protocols/router.js`) determines protocol:
   - `/event/*` → gRPC client (`sftools-proxy/src/grpc/pubsub-client.js`)
   - `/topic/*`, `/systemTopic/*` → CometD client (`sftools-proxy/src/cometd/cometd-client.js`)
4. Events streamed back via `streamEvent` messages
5. Background broadcasts to all extension pages
6. Events tab filters by `subscriptionId` and displays

**State Management:**
- Per-instance module state: `ACCESS_TOKEN`, `INSTANCE_URL`, `ACTIVE_CONNECTION_ID` in `src/lib/auth.js`
- Chrome storage: Connections array, describe cache, history/favorites
- Each sftools instance (tab/sidepanel) can have different active connection

## Key Abstractions

**Web Component:**
- Purpose: Encapsulated UI component with template and state
- Examples: `QueryTab`, `ApexTab`, `EventsTab`, `RecordPage`, `SchemaPage`
- Pattern: Custom Element extending HTMLElement, template via `?raw` import
- Location: `src/components/**/*-tab.js`, `src/components/**/*-page.js`

**Salesforce Request:**
- Purpose: Authenticated REST API call with error handling
- Examples: `salesforceRequest()`, `smartFetch()`, `proxyFetch()`
- Pattern: Promise-based with automatic auth token injection
- Location: `src/lib/salesforce-request.js`, `src/lib/fetch.js`

**Connection:**
- Purpose: Stored Salesforce org credentials and metadata
- Examples: Connection objects with id, label, instanceUrl, tokens
- Pattern: Array in chrome.storage.local, active selected per-instance
- Location: `src/lib/auth.js`

**Subscription Manager:**
- Purpose: Registry of all active streaming subscriptions
- Examples: gRPC and CometD subscriptions tracked by ID
- Pattern: Central registry with cleanup functions
- Location: `sftools-proxy/src/subscription-manager.js`

## Entry Points

**Side Panel Entry:**
- Location: `src/pages/app/app.html`, `src/pages/app/app.js`
- Triggers: User clicks extension icon
- Responsibilities: Initialize all tabs, connection selector, OAuth UI

**Background Service Worker:**
- Location: `src/background/background.js`
- Triggers: Extension load, message from frontend
- Responsibilities: Route messages, handle OAuth, manage proxy connection

**OAuth Callback:**
- Location: `src/pages/callback/callback.html`, `src/pages/callback/callback.js`
- Triggers: Salesforce OAuth redirect
- Responsibilities: Parse tokens, exchange code, save connection

**Standalone Pages:**
- Record Viewer: `src/pages/record/record.html` → `src/components/record/record-page.js`
- Schema Browser: `src/pages/schema/schema.html` → `src/components/schema/schema-page.js`

**Native Proxy:**
- Location: `sftools-proxy/src/index.js`
- Triggers: Chrome native messaging connection
- Responsibilities: Handle REST proxy, gRPC/CometD streaming

## Error Handling

**Strategy:** Throw exceptions from service layer, catch at component level

**Patterns:**
- `salesforceRequest()` throws on non-2xx responses (except 404)
- Components wrap API calls in try/catch
- Auth expiration triggers callback via `triggerAuthExpired()` in `src/lib/auth.js`
- Background worker handles 401 retry with token refresh (proxy required)

## Cross-Cutting Concerns

**Logging:**
- Console logging throughout (console.log, console.error, console.warn)
- Proxy logs to `/tmp/sftools-proxy.log`

**Validation:**
- URL parameter validation in standalone pages
- SOQL parsing for autocomplete in `src/lib/soql-autocomplete.js`
- No formal validation library

**Authentication:**
- Module-level token state in `src/lib/auth.js`
- Per-connection tokens in chrome.storage.local
- Background worker handles token refresh

**Caching:**
- Describe cache per connection in chrome.storage.local - `src/lib/salesforce.js`
- Schema cache for Avro decoding in proxy - `sftools-proxy/src/grpc/schema-cache.js`

---

*Architecture analysis: 2026-01-15*
*Update when major patterns change*
