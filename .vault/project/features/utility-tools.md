---
title: Utility Tools
type: project
category: features
tags:
  - feature
  - utils
  - debug-logs
  - flow-cleanup
aliases:
  - Utils Tab
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/utils/
  - src/components/utils-tools/
  - src/api/debug-logs.ts
confidence: high
---

# Utility Tools

## Overview

The Utils tab hosts developer utility tools: Debug Log management, Flow Cleanup, and Schema Browser link. Individual tools are in `components/utils-tools/`.

## How It Works

### Debug Logs
- **User search**: Find users to enable trace flags
- **Enable tracing**: `enableTraceFlagForUser(userId)` — 30-minute trace flag
- **Log stats**: `getDebugLogStats()` — count + total size
- **Bulk delete**: `deleteAllDebugLogs()` via Tooling API composite (batches of 25)

### Flow Cleanup
- **Search flows**: `searchFlows(query)` — find Flow Definitions
- **Get versions**: `getFlowVersions(flowId)` — list versions
- **Delete inactive**: `deleteInactiveFlowVersions(flowId)` — clean up old versions

### Schema Browser Link
Quick link to open the [[Schema Browser]] standalone page.

### Key Components

| Component | Purpose |
|-----------|---------|
| `UtilsTab.tsx` | Tab container for tools |
| `DebugLogs.tsx` | Debug log management tool |
| `FlowCleanup.tsx` | Flow version cleanup tool |
| `SearchBox.tsx` | Reusable search input |
| `SchemaBrowserLink.tsx` | Link to Schema Browser |

## Key Files

- `src/components/utils/UtilsTab.tsx` — Tab container
- `src/components/utils-tools/` — Individual tool components
- `src/api/debug-logs.ts` — Debug log operations
- `src/api/salesforce.ts` — `searchFlows`, `getFlowVersions`, `deleteInactiveFlowVersions`

## Related

- [[System Architecture Overview]]
- [[Salesforce API Client]]
- [[Schema Browser]]
