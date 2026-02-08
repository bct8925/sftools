---
title: System Architecture Overview
type: project
category: architecture
tags:
  - architecture
  - chrome-extension
  - manifest-v3
aliases:
  - Architecture
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/react/App.tsx
  - src/background/background.ts
  - manifest.json
confidence: high
---

# System Architecture Overview

## Overview

sftools is a Chrome Extension (Manifest V3) providing developer tools for Salesforce. Built with [[React]] 19, [[TypeScript]] 5.9, [[Vite]] 7, and [[Monaco Editor]]. Testing uses [[Vitest]] (unit) + [[Playwright]] (browser). An optional [[Native Proxy]] (Node.js) enables streaming and CORS bypass.

## How It Works

### Extension Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Chrome Extension (Manifest V3)                          │
│                                                         │
│  ┌─────────────┐  ┌─────────────────────────────────┐  │
│  │ Background   │  │ Extension Pages (React)          │  │
│  │ Service      │  │                                  │  │
│  │ Worker       │◄─┤  Main App (6 tabs)               │  │
│  │              │  │  ├─ Query Editor                 │  │
│  │ • Auth       │  │  ├─ Apex Executor                │  │
│  │ • Fetch      │  │  ├─ REST API Explorer            │  │
│  │ • Native Msg │  │  ├─ Event Streaming              │  │
│  │ • Context    │  │  ├─ Utils                        │  │
│  │   Menu       │  │  └─ Settings                     │  │
│  └──────┬───────┘  │                                  │  │
│         │          │  Standalone Pages                 │  │
│         │          │  ├─ Record Viewer                 │  │
│         │          │  ├─ Schema Browser                │  │
│         │          │  └─ OAuth Callback                │  │
│         │          └─────────────────────────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐     ┌─────────────────┐
│ sftools-proxy   │────▶│ Salesforce API   │
│ (Node.js)       │     │ • REST           │
│ • gRPC PubSub   │     │ • Tooling        │
│ • CometD        │     │ • Bulk v2        │
│ • CORS bypass   │     │ • Pub/Sub gRPC   │
│ • Large payload │     │ • CometD         │
└─────────────────┘     └─────────────────┘
```

### Communication Flow

1. **Extension pages** use `salesforceRequest()` for all Salesforce API calls
2. `smartFetch()` routes through proxy (if connected) or via background service worker
3. **Background service worker** handles Chrome messaging, OAuth token refresh, context menus
4. **Native proxy** (optional) enables gRPC streaming, CometD, and CORS bypass
5. Three **React Contexts** manage global state: Connection, Theme, Proxy

### Page Structure

| Page | Type | Entry Point | Purpose |
|------|------|-------------|---------|
| Main App | React | `pages/app/app.html` | 6-tab developer tools |
| Record Viewer | React | `pages/record/record.html` | View/edit record fields |
| Schema Browser | React | `pages/schema/schema.html` | Browse object metadata |
| OAuth Callback | Vanilla | `pages/callback/callback.html` | Handle OAuth redirects |

### Tab Architecture

All 6 tabs render simultaneously (hidden when inactive) for state preservation:
- **Query** — SOQL editor with Monaco, tabbed results, bulk export
- **Apex** — Anonymous Apex execution with debug log retrieval
- **REST API** — Raw REST explorer with Monaco JSON editor
- **Events** — Platform Event/CDC/PushTopic streaming (requires proxy)
- **Utils** — Debug log management, flow cleanup
- **Settings** — Multi-org connections, theme, proxy, cache

## Key Files

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome Extension manifest (MV3) |
| `vite.config.ts` | Build configuration with multi-entry |
| `src/react/App.tsx` | Main tabbed app component |
| `src/react/AppProviders.tsx` | Context provider wrapper |
| `src/background/background.ts` | Service worker message router |
| `src/api/salesforce-request.ts` | Authenticated REST wrapper |
| `src/api/salesforce.ts` | High-level API operations |
| `src/api/fetch.ts` | Smart routing (proxy vs extension) |
| `src/auth/auth.ts` | Multi-connection OAuth state |
| `src/style.css` | Global styles + CSS variables |

## Related

- [[Directory Structure]]
- [[Component Architecture]]
- [[State Management]]
- [[Background Service Worker]]
- [[Salesforce API Client]]
- [[Authentication and OAuth]]
- [[Native Proxy]]
- [[Testing Framework]]
- [[Environment Configuration]]

## Notes

- Uses OpenSpec workflow for spec-driven development
- Follows Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- CSS Modules for component-scoped styling, CSS variables for theming
- All tabs rendered simultaneously (hidden when inactive) for state preservation
- Pre-PR check: `npm run validate && npm run test:unit && npm run test:frontend && npm run build`
