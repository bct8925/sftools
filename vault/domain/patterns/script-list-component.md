---
title: Script List Component Pattern
type: domain
category: patterns
tags:
  - vault/domain/patterns
  - react
  - component-pattern
  - history
  - favorites
  - reusable
aliases:
  - History List
  - Favorites List
  - Script List
created: 2026-02-08
updated: 2026-02-08
status: active
confidence: high
---

# Script List Component Pattern

## What Is It?

A reusable generic component pattern for displaying lists of history items and favorites with load, favorite, delete, and search actions. Used across multiple feature tabs (Query, Apex, REST API) for consistent script management UX.

## How It Works

### Components

Two generic list components in `src/components/script-list/`:

#### HistoryList<T extends HistoryEntry>

Renders history items with:
- Click to load content
- Star button to add to favorites
- Delete button to remove
- Preview text and timestamp display
- Generic `getContent` and `getPreview` accessors for different data shapes

Props: `items`, `emptyMessage`, `getContent`, `getPreview`, `formatTime`, `onLoad`, `onAddToFavorites`, `onDelete`

#### FavoritesList<T extends FavoriteEntry>

Renders favorite items with:
- Click to load content
- Delete button to remove
- Label display (user-defined name) and timestamp
- Same generic pattern as HistoryList

Props: `items`, `emptyMessage`, `getContent`, `formatTime`, `onLoad`, `onDelete`

#### FavoriteModal

Modal dialog for naming a favorite item:
- Input with default label (usually first line of content)
- Save/Cancel buttons
- Enter key to save
- Auto-focus and select on open
- Configurable `testIdPrefix` for testing

### Backing Storage

Uses `HistoryManager` class from `src/lib/history-manager.ts`:
- Chrome storage persistence per connection
- Separate namespaces: 'query', 'apex', 'rest'
- History entries: auto-timestamped, max limit
- Favorites: user-labeled, persistent

### Usage Pattern

Each tab creates its own instances:
1. Instantiate `HistoryManager` with namespace
2. Use `HistoryList` for recent items
3. Use `FavoritesList` for saved items
4. Use `FavoriteModal` when starring an item
5. Provide `getContent`/`getPreview` accessors for the specific entry shape

## Example

```tsx
// In QueryHistory.tsx
<HistoryList
  items={history}
  emptyMessage="No query history"
  getContent={(item) => item.query}
  getPreview={(content) => content.substring(0, 80)}
  formatTime={(ts) => new Date(ts).toLocaleString()}
  onLoad={onLoadQuery}
  onAddToFavorites={onAddFavorite}
  onDelete={onDeleteEntry}
/>
```

## Key Principles

- **Generic and reusable**: Type parameters allow different entry shapes
- **Separation of concerns**: UI components don't know about storage implementation
- **Consistent UX**: Same interaction pattern across all tabs
- **Accessor pattern**: Callbacks extract data from generic entries without hardcoding field names

## Resources

- [[query-editor|Query Editor]] - uses for SOQL history/favorites
- [[component-architecture|Component Architecture]]
- [[utility-libraries|Utility Libraries]] (HistoryManager)
