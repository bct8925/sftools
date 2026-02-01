## Why

The Schema Browser's field detail panel currently hides rows when metadata is empty, making it hard to scan and compare fields. It also only shows a subset of useful metadata. Users need a consistent, always-visible layout with additional field properties to avoid clicking through to Salesforce Setup.

## What Changes

- Always display all metadata rows in the expanded field detail, showing a placeholder when blank
- Add new metadata rows: default value, field length/precision/scale, external ID, unique, auto-number, and relationship name
- Add `externalId`, `unique`, `autoNumber` fields to the `FieldDescribe` type

## Capabilities

### New Capabilities
- `field-metadata-v2`: Extended field metadata display with always-visible rows and additional field properties

### Modified Capabilities

## Impact

- `src/types/salesforce.d.ts`: Add `externalId`, `unique`, `autoNumber` to `FieldDescribe`
- `src/components/schema/FieldList.tsx`: Update detail panel rendering
- `src/components/schema/SchemaPage.module.css`: Style adjustments for placeholder text
