## Context

The Events tab (`src/components/events/EventsTab.tsx`) currently uses a single read-only Monaco editor to display streaming events as they arrive. Events are appended to a growing text buffer, similar to a terminal log. This makes it difficult to browse individual events or inspect specific event payloads.

The Debug Logs tab (`src/components/debug-logs/DebugLogsTab.tsx`) demonstrates a superior pattern: a split-view layout with:
- A table listing individual log entries with metadata (time, user, operation, status, size)
- An "Open" button on each row to load the full log content into Monaco
- A 2/3 editor + 1/3 table split using CSS Grid

This design adopts the Debug Logs pattern for the Events tab while preserving all existing subscription functionality.

**Constraints:**
- Must maintain existing subscription logic (`useStreamSubscription` hook)
- Must preserve channel selection, replay settings, and all controls
- Must follow React 19 + TypeScript strict patterns
- Must use CSS Modules and CSS variables for theming

## Goals / Non-Goals

**Goals:**
- Replace stream-only editor with split table + viewer layout
- Display events in a table with key metadata (timestamp, replay ID, channel, event type)
- Allow opening individual events in Monaco editor via "Open" button
- Preserve all existing subscription controls and functionality
- Maintain system message display (connection status, errors)
- Keep "Clear Stream" functionality (now clears table)

**Non-Goals:**
- Changing the underlying streaming API or `useStreamSubscription` hook
- Adding event filtering, search, or export (future enhancement)
- Modifying EventPublisher component
- Adding event persistence or history beyond current session

## Decisions

### Decision 1: Adopt Debug Logs Layout Pattern

**Choice:** Use the same CSS Grid split layout (2/3 editor + 1/3 table) from `DebugLogsTab.tsx`

**Rationale:**
- Proven UX pattern already familiar to users
- Existing CSS classes can be reused (`.viewer`, `.viewerEditor`, `.viewerTable`)
- Consistent with app's design language

**Alternatives considered:**
- Tabbed view (table OR editor): rejected because simultaneous visibility is valuable
- Horizontal split: rejected because vertical split better matches Debug Logs

### Decision 2: Event Data Model

**Choice:** Store events as structured objects with:
```typescript
interface StreamEvent {
  id: string;           // Unique ID (timestamp-based or UUID)
  timestamp: string;    // ISO 8601 timestamp
  replayId?: number;    // Streaming API replay ID
  channel: string;      // Channel name (from selectedChannel)
  eventType: string;    // Parsed from event payload or 'Unknown'
  payload: object;      // Full event JSON
  isSystemMessage?: boolean;  // True for connection/error messages
}
```

**Rationale:**
- Supports table display with sortable/filterable metadata
- Preserves full payload for Monaco display
- Distinguishes system messages from actual events

**Alternatives considered:**
- Store raw JSON strings: rejected because harder to extract metadata for table
- Flatten all fields: rejected because event schemas vary wildly

### Decision 3: System Message Handling

**Choice:** Display system messages (connection status, errors) as special rows in the event table with distinct styling

**Rationale:**
- Keeps all stream activity in one view
- Provides context for why events may stop/start
- Matches Debug Logs pattern

**Alternatives considered:**
- Separate system message area: rejected for space efficiency
- Toast notifications: rejected because they disappear

### Decision 4: Hook Modification

**Choice:** Modify `useStreamSubscription` to return event data instead of appending to Monaco ref

**Current behavior:** Hook appends event JSON directly to Monaco editor via `streamEditorRef.current?.appendValue()`

**New behavior:** Hook returns events via callback, parent component manages state array

**Rationale:**
- Decouples subscription logic from UI rendering
- Enables table display while preserving existing subscription logic
- Minimal breaking changes (only EventsTab needs updating)

## Risks / Trade-offs

**[Risk]** Memory growth with long-running subscriptions → **Mitigation:** Limit event array to last 100 events (similar to Debug Logs)

**[Risk]** Large event payloads (100KB+ JSON) may slow Monaco rendering → **Mitigation:** Lazy load into Monaco only when "Open" clicked (already the pattern)

**[Trade-off]** Losing continuous stream view → **Accepted:** Table view provides better inspection UX, users can still see order

**[Trade-off]** Increased complexity (table + editor vs. editor-only) → **Accepted:** Worthwhile for usability gains
