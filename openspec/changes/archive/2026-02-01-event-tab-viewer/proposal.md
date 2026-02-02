## Why

The Events tab currently displays streaming event data as raw JSON text in a read-only Monaco editor, making it difficult to browse and inspect individual events. Users must scroll through an ever-growing stream to find specific events. The Debug Logs tab demonstrates a superior UX pattern: a table view listing individual items with "Open" buttons to view full content in Monaco. Adopting this pattern for the Events tab will improve event inspection and debugging workflows.

## What Changes

- Replace the single Monaco editor with a split view: event table (left/top) + Monaco viewer (right/bottom)
- Event table displays key metadata for each received event (timestamp, replay ID, channel, event type)
- Each table row includes an "Open" button to load the full event JSON into the Monaco editor
- Maintain existing subscription controls (channel selector, replay settings, subscribe/unsubscribe)
- Preserve the "Clear Stream" functionality (now clears the event table)
- Keep system messages in the event table (connection status, subscription changes)

## Capabilities

### New Capabilities

- `event-table-viewer`: Display streaming events in a table with individual event inspection via Monaco editor

### Modified Capabilities

None - this is a UI refactor with no requirement changes to existing capabilities.

## Impact

**Modified Files:**
- `src/components/events/EventsTab.tsx` - replace stream-only UI with split table + viewer
- `src/components/events/EventsTab.module.css` - add table and split layout styles
- `tests/frontend/events-tab.test.ts` - update tests for new table UI

**No Breaking Changes** - event subscription, channel selection, and streaming functionality remain unchanged. This is a pure UX improvement.

## Non-goals

- Changing the underlying streaming API or subscription mechanism
- Adding event filtering, search, or export capabilities (future enhancement)
- Modifying the EventPublisher component
