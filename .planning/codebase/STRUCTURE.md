# Codebase Structure

**Analysis Date:** 2026-01-15

## Directory Layout

```
sftools/
├── src/                        # Extension source code (Vite root)
│   ├── background/             # Service worker
│   ├── components/             # Custom element components
│   ├── lib/                    # Shared utilities
│   ├── pages/                  # Entry points (minimal shells)
│   ├── public/                 # Static assets
│   └── style.css               # Global styles
├── sftools-proxy/              # Native messaging host (Node.js)
│   ├── src/                    # Proxy source code
│   ├── proto/                  # gRPC proto definitions
│   └── package.json
├── dist/                       # Build output (gitignored)
├── manifest.json               # Extension manifest (MV3)
├── rules.json                  # Declarative net request rules
├── vite.config.js              # Vite build configuration
└── package.json                # Root dependencies
```

## Directory Purposes

**src/background/**
- Purpose: Service worker for background processing
- Contains: ES module files for message routing, auth, native messaging
- Key files:
  - `background.js` - Message router, context menu, main handler
  - `auth.js` - Token exchange and refresh (backend)
  - `native-messaging.js` - Native messaging protocol

**src/components/**
- Purpose: Custom element components (Web Components)
- Contains: Tab components, page components, utility components
- Key files:
  - `query/query-tab.js` - SOQL query editor with tabbed results
  - `apex/apex-tab.js` - Anonymous Apex execution
  - `rest-api/rest-api-tab.js` - REST API explorer
  - `events/events-tab.js` - Platform Events streaming
  - `settings/settings-tab.js` - Connection and proxy management
  - `utils/utils-tab.js` - Container for utility tools
  - `record/record-page.js` - Standalone record viewer
  - `schema/schema-page.js` - Standalone schema browser
  - `monaco-editor/monaco-editor.js` - Reusable Monaco wrapper

**src/components/utils-tools/**
- Purpose: Individual utility tool components
- Contains: Self-contained utility tools loaded by utils-tab
- Key files:
  - `debug-logs.js` - Trace flag management, log deletion
  - `flow-cleanup.js` - Delete inactive flow versions
  - `schema-browser-link.js` - Link to schema browser

**src/lib/**
- Purpose: Shared utilities and service modules
- Contains: API wrappers, state management, helpers
- Key files:
  - `auth.js` - Multi-connection management (frontend)
  - `fetch.js` - Smart fetch routing (proxy vs extension)
  - `salesforce.js` - All Salesforce API operations
  - `salesforce-request.js` - Authenticated REST wrapper
  - `utils.js` - Central export point for common imports
  - `soql-autocomplete.js` - SOQL editor autocomplete
  - `history-manager.js` - Query history and favorites

**src/pages/**
- Purpose: Entry point HTML shells for each page
- Contains: Minimal HTML + JS that loads custom elements
- Key files:
  - `app/app.html`, `app/app.js` - Main tabbed interface
  - `callback/callback.html`, `callback.js` - OAuth callback
  - `record/record.html`, `record.js` - Record viewer entry
  - `schema/schema.html`, `schema.js` - Schema browser entry

**sftools-proxy/src/**
- Purpose: Native messaging host for streaming and CORS bypass
- Contains: Node.js modules for protocols and handlers
- Subdirectories:
  - `handlers/` - REST, gRPC, CometD, streaming handlers
  - `grpc/` - Salesforce Pub/Sub gRPC client
  - `cometd/` - CometD/Faye client
  - `protocols/` - Channel-to-protocol routing
- Key files:
  - `index.js` - Entry point, message router
  - `native-messaging.js` - Chrome native messaging protocol
  - `subscription-manager.js` - Subscription registry
  - `http-server.js` - Large payload fallback server

## Key File Locations

**Entry Points:**
- `src/pages/app/app.html` - Main extension UI
- `src/background/background.js` - Service worker
- `src/pages/callback/callback.html` - OAuth callback
- `sftools-proxy/src/index.js` - Native proxy entry

**Configuration:**
- `manifest.json` - Extension manifest, OAuth client ID
- `vite.config.js` - Build configuration
- `rules.json` - CORS header manipulation rules

**Core Logic:**
- `src/lib/salesforce.js` - All Salesforce API calls
- `src/lib/auth.js` - Connection and token management
- `src/lib/fetch.js` - Request routing logic
- `src/background/auth.js` - Token refresh logic

**Testing:**
- None (no test files in codebase)

**Documentation:**
- `README.md` - User documentation
- `CLAUDE.md` - Claude Code instructions

## Naming Conventions

**Files:**
- `kebab-case.js` for all JavaScript modules
- `{name}-tab.js` for tab components
- `{name}-page.js` for standalone page components
- `{name}.html`, `{name}.css` co-located with component JS

**Directories:**
- `kebab-case` for all directories
- Plural for collections: `components/`, `pages/`, `handlers/`
- Component directories match element name: `query/` → `<query-tab>`

**Special Patterns:**
- `*.html?raw` imports - Vite raw template loading
- `index.js` - Not used for barrel exports (direct imports preferred)
- `utils.js` - Re-exports from other lib modules

## Where to Add New Code

**New Tool Tab:**
- Component: `src/components/{name}/{name}-tab.js`, `{name}.html`, `{name}.css`
- Import: Add to `src/pages/app/app.js`
- HTML: Add `<{name}-tab>` element to `src/pages/app/app.html`

**New Standalone Page:**
- Component: `src/components/{name}/{name}-page.js`, `{name}.html`, `{name}.css`
- Entry: `src/pages/{name}/{name}.html`, `{name}.js`
- Config: Add entry to `vite.config.js` rollupOptions.input

**New Utility Tool:**
- Component: `src/components/utils-tools/{name}.js`, `{name}.html`
- Import: Add to `src/components/utils/utils-tab.js`
- HTML: Add `<{name}>` element to `src/components/utils/utils.html`

**New Salesforce API Operation:**
- Implementation: Add function to `src/lib/salesforce.js`
- Export: Function is exported, no barrel file needed

**New Background Handler:**
- Handler: Add to `handlers` map in `src/background/background.js`
- Type: Define message type and implement handler function

**New Proxy Handler:**
- Handler: `sftools-proxy/src/handlers/{name}.js`
- Router: Add to message routing in `sftools-proxy/src/index.js`

## Special Directories

**dist/**
- Purpose: Vite build output
- Source: Generated by `npm run build`
- Committed: No (in .gitignore)

**sftools-proxy/proto/**
- Purpose: gRPC protocol buffer definitions
- Source: Salesforce Pub/Sub API proto
- Committed: Yes

**src/public/**
- Purpose: Static assets copied to dist
- Contains: `icon.png`
- Committed: Yes

---

*Structure analysis: 2026-01-15*
*Update when directory structure changes*
