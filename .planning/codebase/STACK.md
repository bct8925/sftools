# Technology Stack

**Analysis Date:** 2026-01-15

## Languages

**Primary:**
- JavaScript (ES6+ modules) - All application code in `src/**/*.js`, `sftools-proxy/src/**/*.js`

**Secondary:**
- Proto3 - gRPC service definitions in `sftools-proxy/proto/pubsub_api.proto`
- HTML5 - Component templates in `src/components/**/*.html`, `src/pages/**/*.html`
- CSS3 - Styling in `src/**/*.css`, `src/style.css`
- JSON - Configuration in `manifest.json`, `package.json`, `rules.json`

## Runtime

**Environment:**
- Node.js >= 18.0.0 - `sftools-proxy/package.json` engines field
- Chrome/Chromium (Manifest V3 Extension) - `manifest.json`
- Browser APIs: Chrome Extension APIs (service workers, native messaging, storage, tabs, etc.)

**Package Manager:**
- npm
- Lockfiles: `package-lock.json`, `sftools-proxy/package-lock.json`
- Registry: `https://registry.npmjs.org` - `.npmrc`

## Frameworks

**Core:**
- Custom Elements (Web Components) - All UI components, no Shadow DOM
- Chrome Extension Manifest V3 - `manifest.json`

**Testing:**
- None configured

**Build/Dev:**
- Vite 7.2.7 - `vite.config.js` (bundler with code splitting)
- Monaco Editor 0.55.1 - `src/components/monaco-editor/` (code/JSON editing)

## Key Dependencies

**Critical (Extension):**
- monaco-editor 0.55.1 - Code editing with syntax highlighting, error markers - `package.json`
- @jetstreamapp/soql-parser-js 6.3.1 - SOQL query parsing for autocomplete - `package.json`

**Critical (Proxy):**
- @grpc/grpc-js 1.12.0 - gRPC client for Salesforce Pub/Sub API - `sftools-proxy/package.json`
- @grpc/proto-loader 0.7.13 - Dynamic .proto file loading - `sftools-proxy/package.json`
- faye 1.4.0 - CometD/Bayeux client for PushTopics - `sftools-proxy/package.json`
- avsc 5.7.7 - Avro schema parsing for event payloads - `sftools-proxy/package.json`

**Infrastructure:**
- Chrome Extension APIs - Storage, native messaging, tabs, context menus
- Node.js built-ins - File system, child process (proxy only)

## Configuration

**Environment:**
- No `.env` files required - secrets stored in Chrome extension storage
- OAuth tokens managed via `chrome.storage.local`
- Per-connection configuration (clientId, loginDomain)

**Build:**
- `vite.config.js` - Build configuration (root: src/, output: dist/)
- `manifest.json` - Extension manifest with OAuth2 config
- `rules.json` - Declarative net request rules for CORS header manipulation
- `.npmrc` - NPM registry configuration

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js 18+)
- Chrome browser for extension testing
- No external services required for basic functionality

**Production:**
- Chrome browser with Developer mode or Chrome Web Store install
- Optional: Local proxy for gRPC streaming and CORS bypass
  - Native messaging host installed via `sftools-proxy/install.js`
  - Runs on localhost (127.0.0.1)

---

*Stack analysis: 2026-01-15*
*Update after major dependency changes*
