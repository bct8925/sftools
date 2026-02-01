# Tasks: Schema Browser – Field Metadata v2

## 1. Type updates

- [x] 1.1 Add `externalId: boolean`, `unique: boolean`, `autoNumber: boolean` to `FieldDescribe` in `src/types/salesforce.d.ts`

## 2. FieldList detail panel

- [x] 2.1 Refactor detail panel to always render all rows with "—" placeholder for empty values
- [x] 2.2 Add Default Value row
- [x] 2.3 Add Size row (length for strings, precision/scale for numerics, "—" otherwise)
- [x] 2.4 Add Properties row with tags for External ID, Unique, Auto Number
- [x] 2.5 Add Relationship row showing `relationshipName` for reference fields

## 3. Styles

- [x] 3.1 Add CSS for property tags in the detail panel

## 4. Verify

- [x] 4.1 Type check passes (`npm run typecheck`)
- [x] 4.2 Build passes (`npm run build`)
