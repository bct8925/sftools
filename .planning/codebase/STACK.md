# Technology Stack

**Analysis Date:** 2026-01-15

## Languages

**Primary:**
- JavaScript (ES6 modules) - All application code in `src/`
- Node.js (CommonJS) - Local proxy in `sftools-proxy/`

**Secondary:**
- Protobuf - gRPC definitions in `sftools-proxy/proto/pubsub_api.proto`

## Runtime

**Environment:**
- Chrome Extension (Manifest V3) - `manifest.json`
- Node.js 18+ (for local proxy) - `sftools-proxy/package.json` engines field
- Browser runtime (Chrome)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present in both root and `sftools-proxy/`

## Frameworks

**Core:**
- Web Components (Custom Elements) without Shadow DOM - `src/components/*/`
- No external UI framework (Lightning-inspired CSS)

**Testing:**
- None configured

**Build/Dev:**
- Vite 7.2.7 - Build tool and dev server - `vite.config.js`
- Rollup (via Vite) - Multi-entry bundling

## Key Dependencies

**Critical:**
- monaco-editor 0.55.1 - Code editor for SOQL, Apex, JSON - `src/components/monaco-editor/`
- @jetstreamapp/soql-parser-js 6.3.1 - SOQL parsing for autocomplete - `src/lib/soql-autocomplete.js`

**Proxy Dependencies:**
- @grpc/grpc-js 1.12.0 - gRPC client for Pub/Sub API - `sftools-proxy/src/grpc/pubsub-client.js`
- @grpc/proto-loader 0.7.13 - Proto file loading - `sftools-proxy/src/grpc/pubsub-client.js`
- faye 1.4.0 - CometD/Bayeux client for streaming - `sftools-proxy/src/cometd/cometd-client.js`
- avsc 5.7.7 - Avro schema encoding/decoding - `sftools-proxy/src/grpc/schema-cache.js`

**Infrastructure:**
- Chrome Extension APIs (storage, runtime, contextMenus, sidePanel)
- Native Messaging protocol - `src/background/native-messaging.js`

## Configuration

**Environment:**
- No environment variables required for extension
- OAuth Client ID in `manifest.json`
- Per-connection Client IDs stored in Chrome storage

**Build:**
- `vite.config.js` - Build configuration with multi-entry points
- `manifest.json` - Extension manifest with permissions, OAuth, service worker

**Extension Manifest:**
- `manifest.json` - MV3 configuration, OAuth2, permissions
- `rules.json` - Declarative net request rules for CORS header manipulation

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js and Chrome)
- Chrome browser with Developer Mode enabled
- Node.js 18+ for local proxy features

**Production:**
- Chrome browser
- Optional: Local proxy installed via native messaging host

---

*Stack analysis: 2026-01-15*
*Update after major dependency changes*
