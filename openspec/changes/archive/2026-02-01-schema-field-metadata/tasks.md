# Tasks: Schema Browser – Field Metadata

## 1. Type updates

- [x] 1.1 Add `inlineHelpText: string | null` and `description: string | null` to `FieldDescribe` in `src/types/salesforce.d.ts`

## 2. FieldList component

- [x] 2.1 Add `expandedFieldName` state to `FieldList`
- [x] 2.2 Pass expand/collapse handler and expanded state to `FieldItem`
- [x] 2.3 Make `FieldItem` row clickable to toggle expansion
- [x] 2.4 Render `FieldDetail` section below the row when expanded
- [x] 2.5 Show description, help text, required status, and picklist values in detail section
- [x] 2.6 Show "No additional metadata" when field has none

## 3. Styles

- [x] 3.1 Add CSS module styles for the detail panel in `SchemaPage.module.css`

## 4. Verify

- [x] 4.1 Build passes (`npm run build`)
- [x] 4.2 Type check passes (`npm run typecheck`)
