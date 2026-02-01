## 1. Core Implementation

- [x] 1.1 In `src/components/schema/FieldList.tsx`, wrap the Size detail row in a conditional that only renders when `sizeDisplay` is non-null
- [x] 1.2 In `src/components/schema/FieldList.tsx`, wrap the Properties detail row in a conditional that only renders when `properties.length > 0`
- [x] 1.3 In `src/components/schema/FieldList.tsx`, wrap the Relationship detail row in a conditional that only renders when `field.type === 'reference'`

## 2. Tests

- [x] 2.1 Add/update unit tests to verify Size row is shown for string and numeric field types and hidden for boolean, date, reference types (`tests/browser/specs/schema/field-property-filtering.test.ts`)
- [x] 2.2 Add/update unit tests to verify Relationship row is shown only for reference fields and hidden for other types (`tests/browser/specs/schema/field-property-filtering.test.ts`)
- [x] 2.3 Add/update unit tests to verify Properties row is shown only when field has applicable properties (`tests/browser/specs/schema/field-property-filtering.test.ts`)

## 3. Verify

- [x] 3.1 Run `npm run validate` to ensure lint, typecheck, and format pass
- [x] 3.2 Run `npm run test:unit` to confirm all tests pass
- [x] 3.3 Run `npm run test:frontend` to confirm frontend tests pass
