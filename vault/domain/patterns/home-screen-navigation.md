---
title: Home Screen Navigation Pattern
type: domain
category: patterns
tags:
  - pattern
  - navigation
  - home-screen
  - ux
aliases:
  - HomeScreen
  - Tile Navigation
created: 2026-02-28
updated: 2026-02-28
status: active
confidence: high
related-code:
  - src/components/home-screen/HomeScreen.tsx
  - src/components/home-screen/HomeScreen.module.css
  - src/components/connection-selector/ConnectionSelector.tsx
  - src/react/App.tsx
---

# Home Screen Navigation Pattern

## Overview

The main app opens to a tile-based `HomeScreen` that serves as the navigation hub, replacing the old `MobileMenu`. Clicking a tile activates the corresponding tab. A Home button in the header returns to the tile grid. `ConnectionSelector` in the header provides org switching without entering the Settings tab.

## How It Works

### Navigation Model

```
App.tsx
├── Header
│   ├── Home button (returns to HomeScreen)
│   └── ConnectionSelector (header dropdown — org switcher)
├── HomeScreen (visible when no tab is active)
│   ├── Query tile → activates QueryTab
│   ├── Apex tile → activates ApexTab
│   ├── REST API tile → activates RestApiTab
│   ├── Events tile → activates EventsTab
│   ├── Schema tile → activates SchemaTab
│   ├── Utils tile → activates UtilsTab
│   └── Settings tile → activates SettingsTab
└── Tab content (hidden when inactive, mounted once visited)
```

### Tab Preloading

Hovering over a tile triggers tab preloading — the tab component mounts in the background before the user clicks. This makes tab transitions feel instant.

### Retained Mount State

Tabs that have been visited remain mounted (using CSS `hidden` to hide them), preserving state (editor content, query results, scroll position) when switching between tabs. HomeScreen itself is shown/hidden the same way.

### ConnectionSelector

The `ConnectionSelector` component lives in the app header, not inside Settings. It renders as a dropdown showing the active connection label and lets the user switch orgs from any tab.

## Key Files

- `src/components/home-screen/HomeScreen.tsx` — Tile grid navigation component
- `src/components/home-screen/HomeScreen.module.css` — Tile grid styles
- `src/components/connection-selector/ConnectionSelector.tsx` — Header org switcher
- `src/react/App.tsx` — Tab activation logic, header layout

## Migration Note

> [!note]
> Replaced `src/components/mobile-menu/MobileMenu.tsx` (deleted in PR #139). The new pattern works for all viewport sizes, not just mobile.

## Related

- [[overview|System Architecture Overview]]
- [[component-architecture|Component Architecture]]
