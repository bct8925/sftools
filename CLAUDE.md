# sftools - Chrome Extension for Salesforce Developers

> **This CLAUDE.md is the authoritative source for development guidelines.**
> Subdirectories contain specialized CLAUDE.md files that extend these rules.

## Overview

| Aspect | Details |
|--------|---------|
| **Type** | Chrome Extension (Manifest V3) |
| **Stack** | Vite, Monaco Editor, Web Components, Chrome APIs |
| **Architecture** | Custom Elements without Shadow DOM |
| **Optional** | Node.js native messaging proxy for gRPC/CometD streaming |

## Universal Development Rules

### Code Quality (MUST)

- **MUST** use CSS variables for all colors, shadows, z-index, and radii
- **MUST** follow the component pattern: `template.html?raw` + CSS + class
- **MUST** use `smartFetch()` for all Salesforce API calls (handles proxy routing)
- **MUST** listen for `connection-changed` events in tab components
- **MUST** include tests for new features (unit for lib/, frontend for UI)

### Best Practices (SHOULD)

- **SHOULD** use shared CSS classes from `style.css` before creating new ones
- **SHOULD** keep components under 300 lines; extract logic to `src/lib/`
- **SHOULD** use Monaco editor's `execute` event for Ctrl+Enter actions
- **SHOULD** prefer `querySelector` with class selectors over IDs
- **SHOULD** use semantic CSS variable names (purpose, not color)

### Anti-Patterns (MUST NOT)

- **MUST NOT** hard-code colors, use `var(--variable-name)` instead
- **MUST NOT** create Shadow DOM - all components use light DOM
- **MUST NOT** bypass extension fetch - always use `smartFetch()` or `extensionFetch()`
- **MUST NOT** store secrets in code - use Chrome storage or `.env.test`
- **MUST NOT** use inline styles - use CSS classes or variables

## Quick Reference

### Build Commands

```bash
npm install                    # Install dependencies
npm run build                  # Build for production (outputs to dist/)
npm run watch                  # Build with watch mode for development
npm run package                # Build production + create zip archive
```

### Test Commands

```bash
# Unit tests (Vitest with mocks)
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.js        # Run specific test file
npm run test:unit:watch                  # Watch mode
npm run test:unit:coverage               # With coverage report

# Integration tests (real Salesforce API)
npm run test:integration                 # Run all integration tests
npm run test:integration -- query        # Run tests matching "query"

# Frontend tests (Playwright with mocks)
npm run test:frontend                    # Run all frontend tests
npm run test:frontend -- --filter=query  # Run tests matching "query"
npm run test:frontend:slow               # With human-like timing
```

### Pre-PR Validation

```bash
npm run build && npm run test:unit && npm run test:frontend
```

## Project Structure

### Applications

- **`src/`** → Extension source code
  - `components/` → Web Components ([see src/components/CLAUDE.md](src/components/CLAUDE.md))
  - `lib/` → Shared utilities ([see src/lib/CLAUDE.md](src/lib/CLAUDE.md))
  - `pages/` → Entry points (app, callback, record, schema)
  - `background/` → Service worker (auth, messaging, context menu)

- **`sftools-proxy/`** → Native messaging host ([see sftools-proxy/CLAUDE.md](sftools-proxy/CLAUDE.md))
  - gRPC client for Pub/Sub API
  - CometD client for PushTopics
  - REST proxy for CORS bypass

### Testing

- **`tests/`** → All test files ([see tests/CLAUDE.md](tests/CLAUDE.md))
  - `unit/` → Vitest with mocks (jsdom)
  - `integration/` → Vitest with real API (node)
  - `frontend/` → Playwright browser tests

### Build Output

- **`dist/`** → Built extension (referenced by manifest.json)
  - `pages/` → Built HTML/JS
  - `chunks/` → Shared code
  - `assets/` → Monaco workers, fonts

## Directory Structure

```
sftools/
├── src/
│   ├── components/           # Web Components
│   │   ├── apex/             # Apex tab
│   │   ├── events/           # Events tab (streaming)
│   │   ├── monaco-editor/    # Monaco wrapper component
│   │   ├── query/            # Query tab
│   │   ├── record/           # Record Viewer (standalone)
│   │   ├── rest-api/         # REST API tab
│   │   ├── schema/           # Schema Browser (standalone)
│   │   ├── settings/         # Settings tab
│   │   ├── utils/            # Utils tab container
│   │   └── utils-tools/      # Individual utility components
│   ├── pages/                # Entry points
│   │   ├── app/              # Main tabbed interface
│   │   ├── callback/         # OAuth callback
│   │   ├── record/           # Record Viewer entry
│   │   └── schema/           # Schema Browser entry
│   ├── background/           # Service worker
│   │   ├── background.js     # Message routing, context menu
│   │   ├── auth.js           # Token exchange/refresh
│   │   └── native-messaging.js # Proxy communication
│   ├── lib/                  # Shared utilities
│   │   ├── auth.js           # Multi-connection storage
│   │   ├── salesforce.js     # Salesforce API helpers
│   │   ├── fetch.js          # Smart fetch routing
│   │   ├── theme.js          # Dark/light mode
│   │   └── utils.js          # Central re-exports
│   ├── public/               # Static assets
│   └── style.css             # Global styles + CSS variables
├── tests/
│   ├── unit/                 # Vitest unit tests
│   ├── integration/          # Vitest integration tests
│   ├── frontend/             # Playwright tests
│   └── shared/               # Shared mock infrastructure
├── sftools-proxy/            # Native messaging host
│   ├── src/                  # Proxy source
│   ├── proto/                # gRPC proto files
│   └── install.js            # Native host installer
├── manifest.json             # Chrome MV3 manifest
├── vite.config.js            # Vite build config
└── rules.json                # Declarative net request rules
```

## Quick Find Commands

### Find Components

```bash
# Find component definition
rg -n "class.*extends HTMLElement" src/components

# Find component usage in HTML
rg -n "<[a-z]+-[a-z]+" src/

# Find CSS class definition
rg -n "^\." src/style.css src/components
```

### Find API Methods

```bash
# Find Salesforce API functions
rg -n "^export (async )?function" src/lib/salesforce.js

# Find background message handlers
rg -n "^\s+\w+:" src/background/background.js

# Find auth functions
rg -n "^export" src/lib/auth.js
```

### Find Tests

```bash
# Find test for a function
rg -n "describe.*functionName" tests/

# Find page object methods
rg -n "async \w+\(" tests/frontend/pages/
```

## Tool Tabs

| Tab | Purpose | Key Files |
|-----|---------|-----------|
| **Query** | SOQL editor with tabbed results | `components/query/query-tab.js` |
| **Apex** | Anonymous Apex execution | `components/apex/apex-tab.js` |
| **REST API** | REST explorer with Monaco | `components/rest-api/rest-api-tab.js` |
| **Events** | Streaming (requires proxy) | `components/events/events-tab.js` |
| **Utils** | Debug logs, flow cleanup | `components/utils/utils-tab.js` |
| **Settings** | Connections, appearance | `components/settings/settings-tab.js` |

## Standalone Tools

| Tool | Purpose | Entry Point |
|------|---------|-------------|
| **Record Viewer** | View/edit record fields | `pages/record/record.html` |
| **Schema Browser** | Browse object metadata | `pages/schema/schema.html` |

## Component Architecture

All components follow this pattern:

```javascript
// src/components/example/example-tab.js
import template from './example.html?raw';
import './example.css';
import { salesforceRequest } from '../../lib/salesforce-request.js';

class ExampleTab extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
    }

    initElements() {
        this.button = this.querySelector('.example-button');
    }

    attachEventListeners() {
        this.button.addEventListener('click', () => this.handleClick());
        document.addEventListener('connection-changed', () => this.refresh());
    }
}

customElements.define('example-tab', ExampleTab);
```

### Adding a New Tab

1. Create `src/components/<name>/`:
   - `<name>-tab.js` - Component class
   - `<name>.html` - Template
   - `<name>.css` - Styles (optional)

2. Import in `src/pages/app/app.js`:
   ```javascript
   import '../../components/<name>/<name>-tab.js';
   ```

3. Add to `src/pages/app/app.html`:
   ```html
   <button class="tab-link" data-tab="<name>">Tab Name</button>
   <<name>-tab id="<name>" class="tab-content"></<name>-tab>
   ```

### Adding a Standalone Tool

1. Create `src/components/<name>/`:
   - `<name>-page.js` - Component class
   - `<name>.html` - Template (body content only)
   - `<name>.css` - Styles

2. Create `src/pages/<name>/`:
   - `<name>.html` - Entry shell
   - `<name>.js` - Single import

3. Add to `vite.config.js` `rollupOptions.input`

## Key Patterns

### Monaco Editor Component

```html
<monaco-editor class="my-editor" language="sql"></monaco-editor>
```

```javascript
const editor = this.querySelector('.my-editor');
editor.setValue('SELECT Id FROM Account');
const value = editor.getValue();
editor.addEventListener('execute', () => this.run());
```

### Salesforce API Calls

```javascript
import { salesforceRequest } from '../../lib/salesforce-request.js';

// Query
const result = await salesforceRequest('/services/data/v62.0/query', {
    method: 'GET',
    params: { q: 'SELECT Id FROM Account' }
});

// Update record
await salesforceRequest(`/services/data/v62.0/sobjects/Account/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ Name: 'New Name' })
});
```

### Connection Change Handling

```javascript
connectedCallback() {
    document.addEventListener('connection-changed', (e) => {
        this.handleConnectionChange(e.detail);
    });
}

handleConnectionChange(connection) {
    // Reload data for new org
    this.loadData();
}
```

### Theme Initialization

All page entry points must initialize theme:

```javascript
// src/pages/<name>/<name>.js
import { initTheme } from '../../lib/theme.js';
import '../../components/<name>/<name>-page.js';

initTheme();
```

## CSS Variables

All colors, shadows, and z-indexes use CSS variables. See `src/style.css` for definitions.

### Key Variables

```css
/* Colors */
--primary-color          /* Brand blue */
--bg-color               /* Page background */
--card-bg                /* Card backgrounds */
--text-main              /* Primary text */
--text-muted             /* Secondary text */
--border-color           /* Borders */
--error-color            /* Errors */
--success-color          /* Success */

/* Shadows */
--shadow-sm, --shadow-md, --shadow-lg

/* Z-index scale */
--z-dropdown: 100
--z-sticky: 200
--z-modal-backdrop: 900
--z-modal: 1000
--z-toast: 1100

/* Border radius */
--radius-sm: 3px
--radius-md: 4px
--radius-lg: 8px
```

### Theming Rules

```css
/* GOOD */
background: var(--card-bg);
color: var(--text-muted);
box-shadow: 0 4px 12px var(--shadow-lg);

/* BAD - never hard-code */
background: #ffffff;
color: #666;
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
```

## Shared CSS Classes

Prefer these shared classes from `style.css`:

| Pattern | Classes |
|---------|---------|
| Modal | `.modal-overlay`, `.modal-dialog`, `.modal-buttons` |
| Dropdown | `.dropdown-menu`, `.dropdown-item` |
| Script List | `.script-list`, `.script-item`, `.script-preview` |
| Search | `.search-input` |
| Status | `.status-indicator.status-loading/success/error` |

## OAuth & Multi-Connection

Supports multiple Salesforce connections with per-instance active connection.

### Storage Schema

```javascript
{
  connections: [{
    id: string,
    label: string,
    instanceUrl: string,
    accessToken: string,
    refreshToken: string | null,
    clientId: string | null
  }]
}
```

### Key Auth Functions

```javascript
import {
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    loadConnections,
    setActiveConnection,
    getActiveConnectionId
} from '../../lib/utils.js';
```

### OAuth Flows

- **Without Proxy**: Implicit flow (`response_type=token`)
- **With Proxy**: Authorization code flow with token refresh

## Background Service Worker

Handler map pattern for message routing:

```javascript
// src/background/background.js
const handlers = {
    fetch: handleFetch,
    subscribe: handleSubscribe,
    // ...
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const handler = handlers[request.type];
    if (handler) {
        handler(request).then(sendResponse);
        return true; // async response
    }
});
```

## Local Proxy

Enables gRPC/CometD streaming and CORS bypass.

### Installation

```bash
cd sftools-proxy
npm install
node install.js
```

### Protocol Routing

| Channel Pattern | Protocol |
|-----------------|----------|
| `/event/*` | gRPC Pub/Sub |
| `/topic/*` | CometD |
| `/data/*` | CometD (CDC) |
| `/systemTopic/*` | CometD |

## Testing Overview

See [tests/CLAUDE.md](tests/CLAUDE.md) for comprehensive testing documentation.

### Three Test Types

1. **Unit Tests** (`tests/unit/`) - Vitest with mocks
2. **Integration Tests** (`tests/integration/`) - Real Salesforce API
3. **Frontend Tests** (`tests/frontend/`) - Playwright browser tests

### Test Files to Match Source

| Source | Test Location |
|--------|---------------|
| `src/lib/auth.js` | `tests/unit/lib/auth.test.js` |
| `components/query/` | `tests/frontend/specs/query/` |

## Security Guidelines

- **NEVER** commit tokens, API keys, or credentials
- Use `.env.test` for test org credentials (gitignored)
- Use environment variables for CI/CD secrets
- Review generated bash commands before execution

## Git Workflow

- Branch from `main`: `claude/issue-{number}-{date}` or `feature/description`
- Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`
- PRs require: passing tests, type checks, lint
- Squash commits on merge

## Loading the Extension

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the repository root

## Specialized CLAUDE.md Files

| Directory | Focus |
|-----------|-------|
| [src/components/CLAUDE.md](src/components/CLAUDE.md) | Component development patterns |
| [src/lib/CLAUDE.md](src/lib/CLAUDE.md) | Utility function patterns |
| [tests/CLAUDE.md](tests/CLAUDE.md) | Testing framework and patterns |
| [sftools-proxy/CLAUDE.md](sftools-proxy/CLAUDE.md) | Proxy architecture |
