# External Integrations

**Analysis Date:** 2026-01-15

## APIs & External Services

**Salesforce REST API (Primary):**
- All authenticated API calls - `src/lib/salesforce.js`, `src/lib/salesforce-request.js`
  - SDK/Client: Custom wrapper using `smartFetch()` - `src/lib/fetch.js`
  - Auth: OAuth2 access token in Authorization header
  - API Version: v62.0 - `src/lib/utils.js` (API_VERSION constant)
  - Endpoints used:
    - Query API (`/services/data/vXX/query/`) - `executeQueryWithColumns()`
    - Tooling API (`/services/data/vXX/tooling/`) - Anonymous Apex, TraceFlags, Flows
    - SObject describe (`/services/data/vXX/sobjects/`) - Metadata
    - Bulk API v2 (`/services/data/vXX/jobs/query/`) - Large exports

**Salesforce gRPC Pub/Sub API:**
- Platform Events streaming - `sftools-proxy/src/grpc/pubsub-client.js`
  - Endpoint: `api.pubsub.salesforce.com:443`
  - Protocol: gRPC with proto definition - `sftools-proxy/proto/pubsub_api.proto`
  - Auth: Access token + instance URL + tenant ID in metadata
  - Supports: Subscribe, GetTopic, GetSchema operations

**Salesforce CometD Streaming API:**
- PushTopics, Change Data Capture, System Topics - `sftools-proxy/src/cometd/cometd-client.js`
  - Protocol: Bayeux/CometD via Faye library
  - Channels: `/topic/*`, `/data/*`, `/systemTopic/*`
  - Auth: Access token in handshake ext

## Data Storage

**Databases:**
- None (Chrome extension - no external database)

**File Storage:**
- None (no file uploads)

**Caching:**
- Chrome Local Storage - `src/lib/auth.js`, `src/lib/salesforce.js`
  - Connection data: `connections` key
  - Describe cache: `describeCache` key (per-connection)
  - Query history: `queryHistory` key
  - Favorites: `queryFavorites` key

## Authentication & Identity

**Auth Provider:**
- Salesforce OAuth2 - `src/lib/auth.js`, `src/background/auth.js`
  - Implementation: Implicit flow (without proxy) or Authorization Code flow (with proxy)
  - Token storage: Chrome storage local (`connections` array)
  - Session management: Access token + optional refresh token per connection

**OAuth Configuration:**
- Default Client ID: `3MVG97L7PWbPq6UzVRgT5Rg8IBlXwjgq8JGCyYoI6n53KYt2KXhokiQmkRq2gGAnFE0sZKp_5lDZpWG0GBhhm` - `manifest.json`
- Callback URL: `https://sftools.dev/sftools-callback` - `src/lib/auth.js`
- Per-connection Client ID: Supported via `clientId` field in connection object

**Token Refresh:**
- Via proxy only (requires refresh token) - `src/background/auth.js`
- Background service worker handles 401 → refresh → retry flow

## Monitoring & Observability

**Error Tracking:**
- None (console.error only)

**Analytics:**
- None

**Logs:**
- Console logging throughout
- Proxy logs to `/tmp/sftools-proxy.log` - `sftools-proxy/src/index.js`

## CI/CD & Deployment

**Hosting:**
- Not hosted (local Chrome extension)
- Manual installation via Developer Mode

**CI Pipeline:**
- None configured

## Environment Configuration

**Development:**
- Required: Chrome with Developer Mode
- Optional: Local proxy for streaming features
- No environment variables needed

**Production:**
- Same as development
- Extension loaded from unpacked directory

## Webhooks & Callbacks

**Incoming:**
- OAuth callback: `https://sftools.dev/sftools-callback`
  - Handled by: `src/pages/callback/callback.js`
  - Receives: Authorization code (with proxy) or token (implicit flow)

**Outgoing:**
- None

## Local Proxy (Native Messaging Host)

**Purpose:** Enable gRPC/CometD streaming and bypass CORS restrictions

**Installation:**
- Script: `sftools-proxy/install.js`
- Manifest location (macOS): `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`
- Manifest location (Linux): `~/.config/google-chrome/NativeMessagingHosts/com.sftools.proxy.json`

**Communication:**
- Protocol: Chrome Native Messaging (4-byte LE length + JSON)
- Fallback: HTTP server on localhost for large payloads (>800KB)
- Secret: Shared secret for HTTP server authentication

**Services Provided:**
- REST proxy (CORS bypass)
- gRPC Pub/Sub streaming
- CometD streaming
- OAuth token exchange (bypasses CORS on token endpoint)

---

*Integration audit: 2026-01-15*
*Update when adding/removing external services*
