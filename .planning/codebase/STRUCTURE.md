# Codebase Structure

**Analysis Date:** 2026-01-15

## Directory Layout

```
sftools/
├── src/                        # Extension source (built by Vite)
│   ├── components/             # Web Components (tabs, pages, utilities)
│   ├── pages/                  # Entry point shells (minimal HTML/JS)
│   ├── background/             # Service worker and handlers
│   ├── lib/                    # Shared utilities and services
│   ├── public/                 # Static assets (copied to dist)
│   └── style.css               # Global styles
├── sftools-proxy/              # Native messaging host (Node.js)
│   ├── src/                    # Proxy source code
│   ├── proto/                  # gRPC protocol definitions
│   └── install.js              # Native host installer
├── dist/                       # Build output (gitignored)
├── manifest.json               # Chrome Extension manifest
├── vite.config.js              # Build configuration
├── rules.json                  # Declarative net request rules
└── package.json                # Dependencies and scripts
```

## Directory Purposes

**src/components/:**
- Purpose: Reusable UI components as Custom Elements
- Contains: Tab components, page components, utility components
- Key files: `query/query-tab.js`, `apex/apex-tab.js`, `events/events-tab.js`
- Subdirectories: One per component (e.g., `query/`, `apex/`, `settings/`)

**src/pages/:**
- Purpose: Entry point shells for HTML pages
- Contains: Minimal HTML with component imports
- Key files: `app/app.html`, `callback/callback.html`, `record/record.html`
- Subdirectories: One per page entry point

**src/background/:**
- Purpose: Service worker and background handlers
- Contains: Message routing, OAuth, native messaging bridge
- Key files: `background.js`, `auth.js`, `native-messaging.js`
- Subdirectories: None

**src/lib/:**
- Purpose: Shared utilities and service modules
- Contains: API wrappers, auth management, helpers
- Key files: `salesforce.js`, `auth.js`, `fetch.js`, `utils.js`
- Subdirectories: None

**sftools-proxy/src/:**
- Purpose: Native proxy implementation
- Contains: Protocol clients, handlers, utilities
- Key files: `index.js`, `native-messaging.js`, `subscription-manager.js`
- Subdirectories: `handlers/`, `grpc/`, `cometd/`, `protocols/`

## Key File Locations

**Entry Points:**
- `src/pages/app/app.js` - Main side panel entry
- `src/background/background.js` - Service worker entry
- `src/pages/callback/callback.js` - OAuth callback handler
- `sftools-proxy/src/index.js` - Native proxy entry

**Configuration:**
- `manifest.json` - Extension manifest with OAuth2 config
- `vite.config.js` - Build tool configuration
- `rules.json` - CORS header manipulation rules
- `.npmrc` - NPM registry settings
- `package.json` - Dependencies and build scripts

**Core Logic:**
- `src/lib/salesforce.js` - All Salesforce API operations (903 lines)
- `src/lib/auth.js` - Connection storage, active connection context
- `src/lib/fetch.js` - Request routing (proxy vs extension)
- `src/lib/salesforce-request.js` - Authenticated REST wrapper

**Testing:**
- No test files present

**Documentation:**
- `CLAUDE.md` - Comprehensive project documentation
- `sftools-proxy/CLAUDE.md` - Proxy architecture documentation
- `sftools-proxy/README.md` - Proxy setup instructions
- `error-handling-standardization.md` - Error handling guide

## Naming Conventions

**Files:**
- `kebab-case.js` - All JavaScript modules
- `kebab-case.html` - HTML templates
- `kebab-case.css` - Component styles
- `UPPERCASE.md` - Important documentation (CLAUDE.md, README.md)

**Directories:**
- kebab-case - All directories
- Singular for component folders: `query/`, `apex/`, `settings/`
- Plural for collections: `components/`, `pages/`, `handlers/`

**Special Patterns:**
- `*-tab.js` - Tab component classes
- `*-page.js` - Standalone page component classes
- `*.html?raw` - Vite raw template imports
- `index.js` - Module entry points (proxy only)

## Where to Add New Code

**New Tool Tab:**
- Primary code: `src/components/{name}/{name}-tab.js`
- Template: `src/components/{name}/{name}.html`
- Styles: `src/components/{name}/{name}.css`
- Register in: `src/pages/app/app.js` (import) and `src/pages/app/app.html` (element)

**New Standalone Page:**
- Component: `src/components/{name}/{name}-page.js`
- Template: `src/components/{name}/{name}.html`
- Entry HTML: `src/pages/{name}/{name}.html`
- Entry JS: `src/pages/{name}/{name}.js`
- Register in: `vite.config.js` rollupOptions.input

**New Utility Tool (in Utils tab):**
- Component: `src/components/utils-tools/{name}.js`
- Template: `src/components/utils-tools/{name}.html`
- Import in: `src/components/utils/utils-tab.js`
- Add element in: `src/components/utils/utils.html`

**New API Method:**
- Implementation: `src/lib/salesforce.js` (add exported function)
- Import in: Consumer component

**New Proxy Handler:**
- Handler: `sftools-proxy/src/handlers/{name}.js`
- Register in: `sftools-proxy/src/index.js` handler map

## Special Directories

**dist/:**
- Purpose: Vite build output
- Source: Auto-generated by `npm run build`
- Committed: No (.gitignored)

**node_modules/:**
- Purpose: NPM dependencies
- Source: Auto-generated by `npm install`
- Committed: No (.gitignored)

**_metadata/:**
- Purpose: Chrome extension metadata
- Source: Generated when extension is loaded
- Committed: No (.gitignored)

**.planning/:**
- Purpose: Project planning documents
- Source: GSD workflow outputs
- Committed: Yes (project documentation)

---

*Structure analysis: 2026-01-15*
*Update when directory structure changes*
