## Why

When users re-run queries from the SOQL query history, the current UI moves that entry to the top of the list, changing the order. This makes it difficult to flip between historical queries efficiently. Additionally, the history list shows redundant prefixes (`SELECT` and `Id`) at the start of each query, making it harder to visually distinguish between queries at a glance.

## What Changes

- Add a re-run button to each query history item that executes the query without reordering the list
- Remove `SELECT` and `Id` prefixes from query display in the history list to improve visual scanning
- Preserve the chronological order of the history list when queries are re-executed via the re-run button

## Capabilities

### New Capabilities
- `query-history-rerun`: Re-run historical queries without reordering the history list

### Modified Capabilities
- `query-history-display`: Improve query text display by trimming common prefixes for better readability

## Impact

**Affected code:**
- Query history UI component (display logic for history items)
- Query history state management (re-run behavior)
- Query execution logic (support re-run without moving to top)

**User experience:**
- Users can quickly re-run queries while maintaining history order
- Better visual differentiation between queries in the history list
