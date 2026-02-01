# Proposal: Schema Browser – Field Metadata

## Why

The Schema Browser currently shows field label, API name, and type in a flat list. Users exploring an object's schema need to see additional metadata — description, help text, whether a field is required, and picklist values — without leaving the tool or clicking through to Salesforce Setup. (GitHub issue #91)

## What Changes

- Expandable detail row beneath each field showing metadata when clicked
- Display: description, help text, required status, and picklist values
- Add missing fields (`inlineHelpText`, `description`) to `FieldDescribe` type

## Capabilities

### New Capabilities
- `field-metadata-detail`: Click a field row to expand and see description, help text, required, and picklist options

### Modified Capabilities
- `schema-field-list`: Field rows become clickable to toggle detail expansion

## Impact

- `src/types/salesforce.d.ts`: Add `inlineHelpText` and description fields to `FieldDescribe`
- `src/components/schema/FieldList.tsx`: Add expandable detail row
- `src/components/schema/SchemaPage.module.css`: Styles for detail row
