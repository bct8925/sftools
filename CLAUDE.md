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
5. The manifest references `dist/` for built assets and `src/` for extension pages

## Project Structure

```
src/
├── app.html              # Main UI shell (Vite entry point)
├── app.js                # Entry point - tab navigation, imports tool modules
├── style.css             # Global styles
├── lib/
│   ├── monaco.js         # Monaco editor setup and helpers
│   └── utils.js          # Shared utilities (auth, extensionFetch)
├── background/
│   └── background.js     # Service worker (fetch proxy, returns headers)
├── popup/
│   ├── popup.html        # Extension popup UI
│   └── popup.js          # OAuth authorization logic
├── callback/
│   ├── callback.html     # OAuth callback page
│   └── callback.js       # Token extraction and storage
├── rest-api/
│   └── rest-api.js       # REST API tab module
├── apex/
│   └── apex.js           # Anonymous Apex execution tab module
└── query/
    └── query.js          # SOQL query editor tab module
```

Root files:
- `manifest.json` - Extension manifest (MV3) with OAuth2 config
- `rules.json` - Declarative net request rules
- `vite.config.js` - Vite build config (root: 'src')

## Tool Tabs

Implemented:
- **REST API** - Salesforce REST API explorer with Monaco editors
- **Apex** - Anonymous Apex execution with debug log retrieval
- **Query** - SOQL query editor with tabbed results

Planned:
- **Platform Events** - CometD subscription/publishing
- **Aura** - Aura component inspector
- **Dev Console** - Debug log viewer

## Header Features

- **Open Org Button** - Icon button in the top-right of the nav header that opens the authenticated org in a new browser tab using `frontdoor.jsp` with the current session token

## Adding a New Tool Tab

1. Create `src/<tool-name>/<tool-name>.js` with an `init()` export
2. Add HTML for the tab content in `src/app.html`
3. Import and call `init()` in `src/app.js`

Example:
```javascript
// src/query/query.js
import { createEditor } from '../lib/monaco.js';
import { extensionFetch, getAccessToken, getInstanceUrl } from '../lib/utils.js';

export function init() {
    // Initialize the tab
}
```

## Key Patterns

**Background fetch proxy** (`src/background/background.js`):
```javascript
// Frontend calls:
chrome.runtime.sendMessage({ type: 'fetch', url, options });
// Background handles actual fetch to bypass extension CORS restrictions
```

**Monaco Editor helpers** (`src/lib/monaco.js`):
```javascript
import { createEditor, createReadOnlyEditor } from '../lib/monaco.js';
const editor = createEditor(container, { language: 'json', value: '{}' });
```

**Auth utilities** (`src/lib/utils.js`):
```javascript
import { extensionFetch, getAccessToken, getInstanceUrl, isAuthenticated } from '../lib/utils.js';
```

## OAuth Flow

- Uses external callback URL: `https://sftools.dev/sftools-callback`
- Stores `accessToken` and `instanceUrl` in `chrome.storage.local`
- Client ID configured in `manifest.json` `oauth2.client_id`

## Apex Tab Implementation

The Apex tab uses the REST Tooling API for anonymous Apex execution:

1. **Trace Flag Setup** - Ensures a `TraceFlag` exists for the current user with a `DebugLevel` named `SFTOOLS_DEBUG`. Optimized to skip API calls if already configured correctly.
2. **Execute Anonymous** - Calls `/services/data/vXX/tooling/executeAnonymous/`
3. **Fetch Debug Log** - Queries `ApexLog WHERE Operation LIKE '%executeAnonymous/'` and fetches the log body

Monaco editor markers are used to highlight compilation errors with line/column info. SOAP API implementation is stubbed for potential future single-call debug log retrieval.

## Styling Conventions

- Salesforce Lightning-inspired design
- CSS variables defined in `:root` for theming
- No external CSS frameworks
- Card-based layouts with `.card`, `.card-header`, `.card-body`
- Form elements use `.input`, `.select`, `.button-brand` classes
- Monaco containers use `.monaco-container` and `.monaco-container-lg`
