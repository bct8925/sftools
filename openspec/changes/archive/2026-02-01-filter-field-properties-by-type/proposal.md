## Why

The schema browser's field detail panel shows all properties (Description, Help Text, Required, Default, Size, Properties, Relationship, Picklist) for every field regardless of type. This creates clutter — e.g., "Relationship" appears as a dash for non-reference fields, and "Size" shows a dash for boolean/date fields. Filtering properties by field type reduces noise and helps developers find relevant metadata faster.

## What Changes

- Conditionally render field detail rows based on the selected field's type
- Universal properties (Description, Help Text, Required, Default) always shown
- Size row only shown for string-like and numeric types that have a meaningful length/precision
- Properties row only shown when the field has applicable properties (External ID, Unique, Auto Number)
- Relationship row only shown for reference fields
- Picklist row only shown for picklist/multipicklist fields (already conditional)

## Non-goals

- Changing the field list columns (Label, API Name, Type) — those remain unchanged
- Adding new field detail rows or properties
- Reordering existing rows
- Making the visibility rules user-configurable

## Capabilities

### New Capabilities

- `field-property-filtering`: Conditional rendering of field detail rows based on field type in the schema browser

### Modified Capabilities

- `field-metadata-detail`: The detail panel now conditionally shows rows instead of always showing all rows

## Impact

- `src/components/schema/FieldList.tsx` — FieldItem component's expanded detail section
- No API changes, no new dependencies
- Existing frontend tests for schema browser may need updating to account for conditionally hidden rows
