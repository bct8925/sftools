---
title: Schema Browser
type: project
category: features
tags:
  - feature
  - schema
  - metadata
  - describe
aliases:
  - Schema Page
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - src/components/schema/
  - src/api/salesforce.ts
  - src/lib/schema-utils.ts
confidence: high
---

# Schema Browser

## Overview

Standalone page for browsing Salesforce object metadata, fields, relationships, and formula definitions. Opens in its own tab (not inside the main app).

## How It Works

- **Object list sidebar**: `getGlobalDescribe()` loads all objects (cached per-connection)
- **Field details**: `getObjectDescribe(objectName)` shows fields, types, relationships
- **Formula editor**: View and edit formula fields via `getFormulaFieldMetadata()` and `updateFormulaField()`
- **URL parameters**: `?object=Account&connectionId=xxx` for deep linking

### Key Components

| Component | Purpose |
|-----------|---------|
| `SchemaPage.tsx` | Main page component |
| `ObjectList.tsx` | Object sidebar with search |
| `FieldList.tsx` | Field details table |
| `FormulaEditor.tsx` | Formula field viewer/editor |

## Key Files

- `src/components/schema/` — Schema components
- `src/react/schema.tsx` — Entry point
- `src/pages/schema/schema.html` — HTML shell
- `src/api/salesforce.ts` — `getGlobalDescribe`, `getObjectDescribe`
- `src/lib/schema-utils.ts` — `formatFieldType`, `isFormulaField`

## Related

- [[overview|System Architecture Overview]]
- [[salesforce-api-client|Salesforce API Client]]
- [[component-architecture|Component Architecture]]
