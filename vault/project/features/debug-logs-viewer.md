---
title: "Debug Logs Viewer"
type: project
category: features
tags:
  - vault/project/features
  - feature
  - debug-logs
  - trace-flags
  - cometd
  - streaming
  - monaco-editor
aliases:
  - "Debug Logs Tab"
  - "Log Viewer"
  - "Debug Logs Monitoring"
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/debug-logs/DebugLogsTab.tsx
  - src/components/debug-logs/DebugLogsSettingsModal.tsx
  - src/api/debug-logs.ts
  - src/lib/apex-utils.ts
  - src/lib/date-utils.ts
confidence: high
---

# Debug Logs Viewer

## Purpose

Full-featured standalone tab component for real-time monitoring and viewing of Salesforce debug logs. Provides a watch-based workflow where users start monitoring at a specific timestamp, fetch new logs since that time, and view log bodies in a Monaco editor with content filtering.

## User Flow

1. Click Play (▶) button to start watching - records current timestamp
2. Click Refresh button or wait for auto-refresh (if proxy connected) to fetch new logs since watching started
3. Log table displays: Time, User, Operation, Status, Size
4. Click "Open" button on a log to view body in Monaco editor
5. Use filter input to search within log content (debounced 200ms)
6. Access Settings modal for trace flag management and cleanup operations

## Implementation

### State Management

**Viewer State:**
- `watchingSince` (string | null) - ISO timestamp when watching started (null = not watching)
- `logs` (DebugLogEntry[]) - array of log entries fetched from API
- `selectedLogBody` (string) - currently viewed log body text
- `filterText` (string) - content filter text (applies to Monaco editor content)
- `openedLogIds` (Set<string>) - tracks which logs have been viewed (visual indicator)

**Auto-refresh State:**
- `subscriptionId` (string | null) - CometD subscription ID for streaming
- `isAutoRefreshEnabled` (boolean) - indicates if auto-refresh is active

### Auto-refresh via CometD Streaming

When proxy is connected AND watching mode is active:
- Subscribes to `/systemTopic/Logging` channel via [[native-proxy|Native Proxy]]
- Uses `chrome.runtime.sendMessage` with type 'subscribe' to background service worker
- On stream event reception, triggers automatic refresh of log list
- Falls back to manual refresh button when proxy not available
- Unsubscribes on stop or component unmount

Pattern follows [[event-streaming|Event Streaming]] implementation for Platform Events and CDC.

### Filter System

- Text filter with 200ms debounce (via `setTimeout`)
- Uses `filterLines()` from `apex-utils.ts` to filter log content
- Applied to [[monaco-editor|Monaco Editor]] content, NOT the log list table
- Displays message when no lines match filter

### Monaco Integration

- Read-only Monaco editor with `apex` language mode
- Shows placeholder text before watching starts: "Click ▶ to start monitoring debug logs"
- Displays log body content after opening a log
- Filter applies in real-time to editor content (not log table)
- Uses imperative ref methods (`setValue`, `getValue`)

### Settings Modal (DebugLogsSettingsModal)

**Trace Flag Management:**
- Enable Trace Flag for current user (30 minutes duration)
- User search to enable trace flag for other users
- Uses `SearchBox` component for user lookup with autocomplete
- APIs: `getCurrentUserId()`, `searchUsers()`, `enableTraceFlagForUser(userId)`

**Cleanup Operations:**
- **Delete All Logs**: Shows confirmation with count + total size, calls `getDebugLogStats()` then `deleteDebugLogs(ids)`
- **Delete All Trace Flags**: Shows confirmation, calls `deleteAllTraceFlags()`

### Component Structure

**DebugLogsTab.tsx** (371 lines):
- Main viewer with two-panel layout: Monaco editor (2/3) + log table (1/3)
- Watch/Stop/Refresh controls
- Filter input in header
- Settings button to open modal
- Status badge for operation feedback
- Connection change handling (resets all state)

**DebugLogsSettingsModal.tsx** (231 lines):
- Two sections: Enable Trace Flag, Cleanup
- User search with `SearchBox` component
- Separate status badges for trace flags and cleanup operations
- Confirmation prompts for destructive operations

## API Surface

Uses functions from `src/api/debug-logs.ts`:
- `getDebugLogsSince(timestamp: string): Promise<DebugLogEntry[]>` - fetch logs since watching started
- `getLogBody(logId: string): Promise<string>` - fetch individual log body content
- `enableTraceFlagForUser(userId: string): Promise<void>` - enable trace flag (30 min)
- `getDebugLogStats(): Promise<{ count: number; totalSize: number; logIds: string[] }>` - get log count/size for cleanup
- `deleteDebugLogs(ids: string[]): Promise<{ deletedCount: number }>` - delete specific logs
- `deleteAllTraceFlags(): Promise<{ deletedCount: number }>` - delete all trace flags

Additional APIs from `src/api/salesforce.ts`:
- `getCurrentUserId(): Promise<string>` - get current user ID
- `searchUsers(query: string): Promise<User[]>` - user lookup for trace flag assignment

## Data Model

```typescript
interface DebugLogEntry {
  Id: string;
  StartTime: string;  // ISO timestamp
  LogUser: { Name: string };
  Operation: string;
  Status: 'Success' | 'Error';
  LogLength: number;  // bytes
}
```

## Domain Concepts

- [[trace-flags|Trace Flags]] - Salesforce mechanism to enable debug logging for specific users
- [[debug-logs|Debug Logs]] - Salesforce debug log objects stored via ApexLog tooling API
- [[cometd|CometD]] - Salesforce streaming protocol for real-time notifications
- [[streaming-api|Streaming API]] - Real-time event delivery via long polling

## Edge Cases & Gotchas

- **Connection Changes**: All state (watching, logs, selected log) resets when active connection changes
- **Proxy Unavailable**: Auto-refresh gracefully degrades to manual refresh when proxy is not connected
- **Filter Behavior**: Filter only applies to Monaco editor content, not log table rows - users may expect table filtering
- **Subscription Cleanup**: Component uses ref (`watchingRef`) to track watching state in message handler to avoid stale closures
- **Debounced Filter**: 200ms debounce on filter input prevents excessive re-filtering during typing
- **Opened Logs Tracking**: Set of opened log IDs provides visual feedback (different row styling) but doesn't persist across sessions
- **Empty States**: Shows different empty state messages for "not watching" vs "watching but no logs yet"

## Testing

**Frontend Tests:**
- Watch/Stop button interaction
- Refresh button triggers API call
- Log table rendering with formatted time/size
- Open log button loads log body into Monaco editor
- Filter input debouncing and content filtering
- Settings modal open/close
- Trace flag enable for current user
- User search and trace flag enable for other user
- Delete logs confirmation flow
- Delete trace flags confirmation flow
- Auto-refresh subscription lifecycle (with proxy mock)
- Connection change reset behavior

**Integration Tests:**
- Actual API calls to `getDebugLogsSince()` with valid timestamp
- Log body retrieval for real log IDs
- Trace flag creation via Tooling API
- Log deletion and trace flag deletion operations
- CometD subscription and event handling (requires proxy)
