# Design: Schema Browser – Field Metadata

## Context

The Schema Browser's `FieldList` component renders a three-column grid (label, API name, type) per field. Each row is a `FieldItem` component. We need to add an expandable detail section without disrupting the existing layout.

## Goals / Non-Goals

**Goals:**
- Show field description, help text, required status, and picklist values
- Toggle detail via click on the field row
- Keep it lightweight — no new dependencies

**Non-Goals:**
- Editing metadata from the detail panel
- Global picklist set resolution (display what the Describe API returns)
- Persisting which field is expanded

## Decisions

### Decision 1: Expand inline beneath the row

The detail panel renders as a sibling div after the field row grid, spanning the full width. This avoids disrupting the CSS grid columns and keeps the expand/collapse simple — just conditional rendering controlled by an `expandedFieldName` state in `FieldList`.

### Decision 2: Single expansion model

Only one field can be expanded at a time (same pattern as the existing `openMenuFieldName` state). This keeps the UI clean and avoids scroll confusion.

### Decision 3: Add fields to FieldDescribe type

Add `inlineHelpText: string | null` and `description: string | null` to the existing `FieldDescribe` interface. These are standard fields from the Salesforce Describe API that we already receive but don't type.

### Decision 4: Required = !nillable && createable

A field is "required" when it's not nillable and is createable. This matches Salesforce's UI behavior. Display-only fields (not createable) that are not nillable are not shown as "required" since the user can't set them.
