## Context

The first iteration (`schema-field-metadata`) added an expandable detail panel to Schema Browser field rows, showing description, help text, required, and picklist values. It conditionally hides rows when empty and shows "No additional metadata" when all are empty. This follow-up adds more metadata fields and switches to always-visible rows.

## Goals / Non-Goals

**Goals:**
- Always show all metadata rows, using a muted placeholder (e.g., "—") for empty values
- Add new rows: default value, length/precision/scale, external ID, unique, auto-number, relationship name
- Remove the "No additional metadata" empty state — every field now shows the full set of rows

**Non-Goals:**
- Making metadata rows editable
- Adding metadata not available from the standard Describe API response

## Decisions

### Decision 1: Always-visible rows with dash placeholder

All metadata rows render unconditionally. When a value is empty/null/false, display "—" using the existing `.fieldDetailMuted` style. This provides a consistent scannable layout and makes it obvious what metadata a field does or doesn't have.

### Decision 2: Group related properties

Combine boolean flags into a single "Properties" row showing tags (e.g., "External ID", "Unique", "Auto Number") rather than separate rows for each. If none apply, show "—". This keeps the panel compact.

### Decision 3: Combine length/precision/scale into one row

Display as a single "Size" row: show `length` for string types, `precision,scale` for numeric types. Show "—" for types where these don't apply.

### Decision 4: Add three boolean fields to FieldDescribe

Add `externalId: boolean`, `unique: boolean`, `autoNumber: boolean` to the type. These are standard Describe API fields we already receive but don't type.

## Risks / Trade-offs

- Showing all rows makes the detail panel taller, which means more scrolling in the field list → Acceptable tradeoff for consistency and scannability.
