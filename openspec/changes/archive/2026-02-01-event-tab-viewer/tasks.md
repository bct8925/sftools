## 1. Data Model & Types

- [x] 1.1 Define `StreamEvent` interface in `src/components/events/EventsTab.tsx` with id, timestamp, replayId, channel, eventType, payload, isSystemMessage fields
- [x] 1.2 Add event state management (events array, selectedEvent) using useState
- [x] 1.3 Add helper function to extract event type from payload (check schema, fallback to "Unknown")
- [x] 1.4 Add helper function to generate unique event ID (timestamp-based or UUID)

## 2. Hook Modification

- [x] 2.1 Modify `useStreamSubscription` hook to accept `onEventReceived` callback instead of appending to Monaco ref
- [x] 2.2 Update hook to call `onEventReceived(eventData)` when events arrive
- [x] 2.3 Update hook to call `onEventReceived` for system messages with `isSystemMessage: true` flag
- [x] 2.4 Remove direct Monaco editor manipulation from hook (preserve for backward compat if needed elsewhere)

## 3. Event Table Component

- [x] 3.1 Create event table HTML structure in `EventsTab.tsx` with columns: Time, Replay ID, Channel, Event Type, Actions
- [x] 3.2 Add "Open" button component for each event row
- [x] 3.3 Implement `handleOpenEvent` callback to load event JSON into Monaco editor and mark row as opened
- [x] 3.4 Add visual styling for opened events (track openedEventIds in state)
- [x] 3.5 Add empty state message when no events exist ("Subscribe to a channel to see events")
- [x] 3.6 Implement auto-scroll to bottom when new events arrive
- [x] 3.7 Implement 100-event limit (remove oldest when exceeded, exclude system messages from count)

## 4. Layout & Styling

- [x] 4.1 Add split-view CSS Grid layout to `EventsTab.module.css` (2/3 editor + 1/3 table, mirroring DebugLogsTab pattern)
- [x] 4.2 Add `.viewer`, `.viewerEditor`, `.viewerTable` CSS classes
- [x] 4.3 Add `.logTable` styles for event table (headers, rows, columns)
- [x] 4.4 Add `.rowOpened` style for visually marking opened events
- [x] 4.5 Add `.emptyState` styles for no-events message
- [x] 4.6 Add system message row styling to differentiate from regular events
- [x] 4.7 Ensure all colors use CSS variables (--text-main, --border-color, etc.)

## 5. Integration & Behavior

- [x] 5.1 Update `clearStream` callback to clear events array AND reset Monaco editor
- [x] 5.2 Wire up `onEventReceived` callback from `useStreamSubscription` to add events to state array
- [x] 5.3 Format timestamps using date formatting utility (similar to Debug Logs `formatTime`)
- [x] 5.4 Update Monaco editor initial state message to reflect new UI ("Click Open on any event to view details")
- [x] 5.5 Preserve all existing subscription controls (channel selector, replay settings, subscribe/unsubscribe buttons)

## 6. Tests

- [x] 6.1 Use test-writer agent to update `tests/frontend/events-tab.test.ts` for split-view layout (table + editor both visible)
- [x] 6.2 Use test-writer agent to add test: event appears in table when received
- [x] 6.3 Use test-writer agent to add test: clicking Open button loads event into Monaco
- [x] 6.4 Use test-writer agent to add test: Clear Stream clears table and editor
- [x] 6.5 Use test-writer agent to add test: system messages appear in table with distinct styling
- [x] 6.6 Use test-writer agent to add test: event limit enforced (100 events max)

## 7. Verify

- [x] 7.1 Run `npm run validate` to check linting and formatting
- [x] 7.2 Run `npm run test:frontend` to verify all tests pass
- [ ] 7.3 Manual test: Subscribe to a channel and verify events appear in table
- [ ] 7.4 Manual test: Click Open on an event and verify JSON appears in Monaco
- [ ] 7.5 Manual test: Clear Stream and verify table and editor both clear
- [ ] 7.6 Manual test: Verify layout matches Debug Logs tab (split view with 2/3 + 1/3 ratio)
