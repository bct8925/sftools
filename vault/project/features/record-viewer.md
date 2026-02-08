---
title: Record Viewer
type: project
category: features
tags:
  - feature
  - record
  - sobject
  - editing
  - crud
  - standalone-page
  - context-menu
aliases:
  - Record Page
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/record/
  - src/api/salesforce.ts
  - src/lib/record-utils.ts
confidence: high
---

# Record Viewer

## Overview

Standalone page for viewing and editing individual Salesforce record fields. Opened via context menu ("View/Edit Record") on any Salesforce page or programmatically with URL parameters.

## How It Works

- **URL parameters**: `?objectType=Account&recordId=001xxx&connectionId=xxx`
- Fetches record with relationship names via `getRecordWithRelationships()`
- Displays all fields with inline editing (dirty tracking)
- Save changes via `updateRecord(objectType, recordId, changedFields)`
- Refresh to reload from Salesforce
- Rich text fields open in a modal (`RichTextModal.tsx`)

### Key Components

| Component | Purpose |
|-----------|---------|
| `RecordPage.tsx` | Main page with URL param parsing |
| `FieldRow.tsx` | Individual field with inline edit |
| `RichTextModal.tsx` | Rich text/HTML field viewer |

## Key Files

- `src/components/record/` — Record components
- `src/react/record.tsx` — Entry point
- `src/pages/record/record.html` — HTML shell
- `src/api/salesforce.ts` — `getRecord`, `getRecordWithRelationships`, `updateRecord`
- `src/lib/record-utils.ts` — `sortFields`, `getFieldValue`

## Related

- [[overview|System Architecture Overview]]
- [[salesforce-api-client|Salesforce API Client]]
- [[background-service-worker|Background Service Worker]] (context menu integration)
- [[salesforce-apis|Salesforce APIs]]
- [[utility-libraries|Utility Libraries]]
- [[typescript-types|TypeScript Type Definitions]]
- [[chrome-extension-mv3|Chrome Extension MV3]]
- [[schema-browser|Schema Browser]]
