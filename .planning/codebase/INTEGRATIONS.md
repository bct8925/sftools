# External Integrations

**Analysis Date:** 2026-01-15

## APIs & External Services

**Salesforce REST APIs:**
- Salesforce REST API v62.0 - Primary data access - `src/lib/salesforce.js`
  - SDK/Client: Custom `salesforceRequest()` wrapper in `src/lib/salesforce-request.js`
  - Auth: OAuth2 Bearer token via `getAccessToken()` from `src/lib/auth.js`
  - Endpoints used:
    - `/services/data/v62.0/query` - SOQL query execution
    - `/services/data/v62.0/sobjects/{type}/describe` - Object metadata
    - `/services/data/v62.0/sobjects/{type}/{id}` - Record CRUD
    - `/services/data/v62.0/jobs/query` - Bulk API v2

**Salesforce Tooling API:**
- Salesforce Tooling API v62.0 - Metadata operations - `src/lib/salesforce.js`
  - SDK/Client: Same `salesforceRequest()` wrapper
  - Auth: Same OAuth2 Bearer token
  - Endpoints used:
    - `/services/data/v62.0/tooling/query` - Tooling queries (ApexLog, TraceFlag, Flow, etc.)
    - `/services/data/v62.0/tooling/executeAnonymous` - Anonymous Apex execution
    - `/services/data/v62.0/tooling/sobjects/{type}` - Tooling object CRUD
    - `/services/data/v62.0/tooling/composite` - Batch operations (25 records max)

**Salesforce Streaming APIs (via proxy):**
- Pub/Sub API (gRPC/HTTP2) - Platform Events - `sftools-proxy/src/grpc/pubsub-client.js`
  - Protocol: gRPC over HTTP/2 to `api.pubsub.salesforce.com`
  - Auth: OAuth2 access token + tenant ID
  - Channels: `/event/*`
  - Schema: Avro encoded events, cached in `sftools-proxy/src/grpc/schema-cache.js`

- CometD (Bayeux) - PushTopics, System Topics - `sftools-proxy/src/cometd/cometd-client.js`
  - Protocol: Long-polling HTTP via Faye client
  - Auth: OAuth2 access token in handshake
  - Channels: `/topic/*`, `/systemTopic/*`

## Data Storage

**Databases:**
- None - Extension is client-side only

**File Storage:**
- Chrome Extension Storage (`chrome.storage.local`) - `src/lib/auth.js`
  - Connection metadata, OAuth tokens
  - Describe cache per connection
  - Query history and favorites

**Caching:**
- Per-connection describe cache - `src/lib/salesforce.js` (DESCRIBE_CACHE_KEY)
  - Global describe (all objects)
  - Object field metadata

## Authentication & Identity

**Auth Provider:**
- Salesforce OAuth2 - `src/lib/auth.js`, `src/background/auth.js`
  - Implementation: Authorization Code flow (with proxy) or Implicit flow (without proxy)
  - Token storage: `chrome.storage.local`
  - Session management: Automatic 401 retry with token refresh (proxy required)

**OAuth Configuration:**
- Callback URL: `https://sftools.dev/sftools-callback` - `src/lib/auth.js` CALLBACK_URL constant
- Default Client ID: `manifest.json` oauth2.client_id field
- Per-connection Client ID: Optional override in connection settings
- Login domains: `login.salesforce.com`, `test.salesforce.com`, custom My Domain

**OAuth Flows:**
- With proxy: Authorization Code flow with PKCE-less exchange via `src/background/auth.js`
- Without proxy: Implicit flow (token in URL fragment)

## Monitoring & Observability

**Error Tracking:**
- None - Console logging only

**Analytics:**
- None

**Logs:**
- Browser console logs - `console.log()`, `console.error()`, `console.warn()` throughout
- Proxy logs: `/tmp/sftools-proxy.log` - `sftools-proxy/src/index.js`

## CI/CD & Deployment

**Hosting:**
- Chrome Extension - Distributed via Chrome Web Store or local unpacked install
- Deployment: Manual upload to Chrome Web Store
- Environment vars: None required (configured in browser)

**CI Pipeline:**
- None configured

## Environment Configuration

**Development:**
- Required env vars: None
- Secrets location: Chrome extension storage (populated via OAuth flow)
- Mock/stub services: None - connects to real Salesforce orgs (use sandbox for testing)

**Production:**
- Same configuration as development
- All orgs (production, sandbox) accessible via connection switcher

## Webhooks & Callbacks

**Incoming:**
- OAuth callback - `https://sftools.dev/sftools-callback`
  - Handler: `src/pages/callback/callback.js`
  - Verification: State parameter matching (stored in `chrome.storage.local`)
  - Events: Authorization code or access token (depending on flow)

**Outgoing:**
- None

## Native Messaging (Local Proxy)

**Chrome Native Messaging:**
- Host name: `com.sftools.proxy`
- Manifest location:
  - macOS: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.sftools.proxy.json`
  - Linux: `~/.config/google-chrome/NativeMessagingHosts/com.sftools.proxy.json`
- Protocol: Length-prefixed JSON messages over stdin/stdout
- HTTP fallback: `127.0.0.1` for payloads >800KB - `sftools-proxy/src/http-server.js`

---

*Integration audit: 2026-01-15*
*Update when adding/removing external services*
