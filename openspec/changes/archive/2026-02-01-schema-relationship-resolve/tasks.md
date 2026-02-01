# Tasks: Resolve Child Relationship Name

## 1. FieldItem changes

- [x] 1.1 Import `getObjectDescribe` in FieldList.tsx
- [x] 1.2 Add `resolvedRelationship` state to FieldItem (string | null)
- [x] 1.3 Add useEffect that triggers on expand for reference fields: fetch parent describe, find matching childRelationship, set resolved string
- [x] 1.4 Update Relationship row to show resolved value, "…" while loading, or "—" on failure/non-reference

## 2. Verify

- [x] 2.1 Type check passes (`npm run typecheck`)
- [x] 2.2 Build passes (`npm run build`)
