# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

sftools is a Chrome Extension (Manifest V3) that combines multiple Salesforce developer tools into a single tabbed interface. It is built using Vite with Monaco Editor for code/JSON editing.

**Reference projects** (`apiTester/`, `devcon/`, `salesfaux/`) are existing Chrome extensions being consolidated into this project. Use them as reference code only.

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
4. Click "Load unpacked" and select the repository root (not `dist/`)
5. The manifest references `dist/` for built assets

## Architecture

### Chrome Extension Structure

- `manifest.json` - Extension manifest (MV3) with OAuth2 config and declarative net request rules
- `background.js` - Service worker handling fetch requests (proxy to bypass CORS)
- `popup.html` - Extension popup for OAuth authorization
- `callback.html` - OAuth callback handler
- `rules.json` - Declarative net request rules (removes Origin header for Aura requests)

### Frontend (Vite Build)

- `src/app.html` - Main UI with tabbed interface
- `src/app.js` - Tab navigation and Monaco editor initialization
- `src/style.css` - Salesforce-like styling (local CSS, no external libraries)
- `vite.config.js` - Configured for Chrome Extensions (relative paths, ES modules, Monaco workers)

### Tab Tools (Planned)

1. **Query** - SOQL query editor
2. **Apex** - Anonymous Apex execution
3. **Platform Events** - CometD subscription/publishing
4. **REST API** - Salesforce REST API explorer (adapted from `apiTester/`)
5. **Aura** - Aura component inspector (adapted from `salesfaux/`)
6. **Dev Console** - Debug log viewer

### Key Patterns

**Background fetch proxy** (from `salesfaux/src/background.js`):
```javascript
// Frontend calls:
chrome.runtime.sendMessage({ type: 'fetch', url, options });
// Background handles actual fetch to bypass extension CORS restrictions
```

**Monaco Editor setup** (from `salesfaux/src/app.js`):
- Uses inline workers for Chrome Extension compatibility
- Imports workers with `?worker&inline` suffix
- Configured via `self.MonacoEnvironment.getWorker()`

**OAuth flow** (from `apiTester/popup.js`):
- Uses `hybrid_token` response type
- Stores `accessToken` and `instanceUrl` in `chrome.storage.local`
- Client ID from `manifest.json` `oauth2.client_id`

## Styling Conventions

- Salesforce Lightning-inspired design
- CSS variables defined in `:root` for theming
- No external CSS frameworks
- Card-based layouts with `.card`, `.card-header`, `.card-body`
- Form elements use `.input`, `.select`, `.button-brand` classes
