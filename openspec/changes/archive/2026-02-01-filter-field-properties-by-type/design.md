## Context

The Schema Browser's `FieldItem` component in `src/components/schema/FieldList.tsx` renders an expanded detail section when a field row is clicked. Currently, all detail rows (Description, Help Text, Required, Default, Size, Properties, Relationship, Picklist) are rendered for every field type, with irrelevant rows showing a dash placeholder. The Picklist row is already conditionally rendered via `hasPicklist`.

## Goals / Non-Goals

**Goals:**
- Filter field detail rows so only type-relevant properties are shown
- Maintain the existing conditional rendering pattern already used for Picklist

**Non-Goals:**
- Adding new detail rows or properties
- Changing the visual design of existing rows
- Making filtering rules configurable

## Decisions

**1. Inline conditional rendering in JSX (vs. configuration-driven approach)**

Extend the existing pattern where `hasPicklist` gates the Picklist row. Add similar boolean flags in the existing `useMemo` block for `sizeDisplay` and reference-related visibility. This keeps the logic co-located with the data it depends on and avoids introducing a new abstraction for a simple filtering task.

Alternative considered: A declarative config mapping field types to visible rows. Rejected because the current set of conditional rows is small (Size, Properties, Relationship) and each has slightly different logic — a config would add indirection without simplifying.

**2. Use existing `sizeDisplay` and `properties` computations as visibility flags**

`sizeDisplay` is already `null` when the field type has no meaningful size. `properties` is already an empty array when no properties apply. These existing computations naturally serve as visibility conditions — no new logic needed for these rows.

For the Relationship row, check `field.type === 'reference'` directly, which aligns with the existing `useEffect` guard at line 211.

## Risks / Trade-offs

**Fewer visible rows may confuse users expecting to see all properties** → The universal rows (Description, Help Text, Required, Default) always appear, providing a consistent baseline. Type-specific rows only appear when meaningful.

**Test updates required** → Existing frontend tests that assert on specific detail rows for non-applicable field types will need updating to expect those rows to be absent.
