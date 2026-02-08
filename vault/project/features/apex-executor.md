---
title: Apex Executor
type: project
category: features
tags:
  - feature
  - apex
  - anonymous-apex
aliases:
  - Apex Tab
  - Anonymous Apex
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/apex/
  - src/api/salesforce.ts
  - src/api/debug-logs.ts
  - src/lib/apex-utils.ts
confidence: high
---

# Apex Executor

## Overview

The Apex tab provides Anonymous Apex execution with [[monaco-editor|Monaco Editor]] (`apex` language mode), debug log retrieval, execution history, and compile error highlighting with markers.

## How It Works

1. User writes Apex code in Monaco editor
2. `executeAnonymousApex(code, onProgress)` handles the full flow:
   - Sets up trace flag via `ensureTraceFlag(userId)` (creates/extends 30-min trace)
   - Executes anonymous Apex via Tooling API
   - Retrieves debug log via `getLatestAnonymousLog()`
3. Results display: success/failure status, compile errors (with line markers in editor), debug log output
4. History managed by `HistoryManager('apex')`

### Key Components

| Component | Purpose |
|-----------|---------|
| `ApexTab.tsx` | Main tab with editor + output |
| `ApexHistory.tsx` | History/favorites dropdown |
| `ApexOutput.tsx` | Execution result + debug log display |

## Key Files

- `src/components/apex/` — All Apex components
- `src/api/salesforce.ts` — `executeAnonymousApex`
- `src/api/debug-logs.ts` — `ensureTraceFlag`, `getLatestAnonymousLog`
- `src/lib/apex-utils.ts` — `parseCompileError`, `formatDebugLog`

## Related

- [[overview|System Architecture Overview]]
- [[salesforce-api-client|Salesforce API Client]]
- [[monaco-editor|Monaco Editor]]
