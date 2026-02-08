---
title: Chrome Extension MV3
type: domain
category: concepts
tags:
  - chrome-extension
  - manifest-v3
  - service-worker
  - native-messaging
aliases:
  - Manifest V3
  - MV3
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# Chrome Extension MV3

## What Is It?

Manifest V3 is Chrome's extension platform. sftools uses MV3 with a background service worker (replaces persistent background pages), declarative content scripts, and Chrome APIs for storage, messaging, tabs, context menus, and native messaging.

## How It Works

### Key MV3 Concepts in sftools

- **Service Worker** (`src/background/background.ts`): Non-persistent background script. Handles message routing, OAuth, native messaging. Can restart at any time — don't hold large state.
- **Extension Pages**: React apps loaded via `chrome-extension://` URLs. Each page is a separate HTML entry point.
- **Chrome Storage** (`chrome.storage.local`): Persistent key-value store for connections, settings. Syncs across tabs via `onChanged` listener.
- **Runtime Messaging** (`chrome.runtime.sendMessage`): Communication between extension pages and service worker. Must return `true` for async responses.
- **Native Messaging** (`chrome.runtime.connectNative`): Bidirectional communication with native host application (sftools-proxy). 1MB message size limit.
- **Context Menus** (`chrome.contextMenus`): "View/Edit Record" menu on Salesforce pages.
- **Side Panel / DevTools**: Extension can be opened as DevTools panel or standalone tab.

### Extension Page Types

| Page | Purpose | React? |
|------|---------|--------|
| `pages/app/` | Main tabbed app | Yes |
| `pages/record/` | Record Viewer | Yes |
| `pages/schema/` | Schema Browser | Yes |
| `pages/callback/` | OAuth callback | No (vanilla JS) |

## Key Principles

- Service workers are ephemeral — no persistent state beyond Chrome storage
- All cross-page communication through `chrome.runtime.sendMessage`
- `chrome.storage.local` for persistence; `onChanged` for cross-tab sync
- Types from `@types/chrome` for TypeScript support

## Resources

- [Chrome Extensions MV3 Documentation](https://developer.chrome.com/docs/extensions/mv3/)
