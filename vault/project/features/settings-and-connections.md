---
title: Settings and Connections
type: project
category: features
tags:
  - feature
  - settings
  - connections
  - multi-org
  - theme
aliases:
  - Settings Tab
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/settings/
  - src/contexts/
  - src/auth/
confidence: high
---

# Settings and Connections

## Overview

The Settings tab provides multi-org connection management, theme selection, proxy configuration, and cache management. The most component-heavy section with 7 sub-components.

## How It Works

### Connection Management
- **Connection list**: Shows all stored Salesforce connections with labels
- **Add connection**: Initiates OAuth flow via `startAuthorization()`
- **Edit connection**: Change label, re-authorize, set custom Connected App
- **Remove connection**: Delete connection from storage
- **Switch active**: `setActiveConnection(conn)` updates module state globally

### Theme Settings
- Three options: Light, Dark, System (auto-detect)
- `setTheme()` persists to Chrome storage
- System mode listens to `prefers-color-scheme` media query

### Proxy Settings
- Connect/disconnect native proxy
- Auto-connect on startup toggle
- Shows proxy version and HTTP port when connected

### Cache Settings
- Clear describe cache for current connection
- Clear all cached data

### Key Components

| Component | Purpose |
|-----------|---------|
| `SettingsTab.tsx` | Main settings layout |
| `ConnectionList.tsx` | All connections with actions |
| `ConnectionCard.tsx` | Individual connection card |
| `EditConnectionModal.tsx` | Edit label / re-auth / custom client |
| `ThemeSettings.tsx` | Theme selector |
| `ProxySettings.tsx` | Proxy connection management |
| `CacheSettings.tsx` | Cache clearing |

## Key Files

- `src/components/settings/` — All settings components
- `src/auth/start-authorization.ts` — OAuth initiation
- `src/contexts/ConnectionContext.tsx` — Connection state
- `src/contexts/ThemeContext.tsx` — Theme state
- `src/contexts/ProxyContext.tsx` — Proxy state

## Related

- [[Authentication and OAuth]]
- [[State Management]]
- [[Native Proxy]]
