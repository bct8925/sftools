## Context

Each `FieldDescribe` has `relationshipName` (parent traversal name) and `referenceTo` (parent object names). The child relationship name (e.g., "Contacts") is stored on the parent object's `childRelationships` array, where each entry has `{ childSObject, field, relationshipName }`. To resolve `Contact.AccountId` → `Account.Contacts`, we need to:
1. Fetch `getObjectDescribe('Account')`
2. Find the `childRelationship` where `childSObject === 'Contact'` and `field === 'AccountId'`
3. Read its `relationshipName`

## Goals / Non-Goals

**Goals:**
- Show the resolved child relationship name in format `ParentObject.ChildRelationshipName`
- Use `getObjectDescribe` which has built-in caching, so repeated lookups are fast
- Handle polymorphic references (multiple `referenceTo` values) by resolving the first

**Non-Goals:**
- Resolving all polymorphic parents (e.g., WhoId → Lead + Contact) — just resolve the first
- Prefetching parent describes for all reference fields — only fetch on expand

## Decisions

### Decision 1: useEffect with state in FieldItem

Add a `resolvedRelationship` state to `FieldItem`. When expanded and the field is a reference type, trigger a useEffect that calls `getObjectDescribe` on the referenced object, finds the matching child relationship, and sets the resolved string. Show "…" while loading.

This keeps the async logic self-contained in `FieldItem` without requiring changes to parent components or prop threading.

### Decision 2: Match on childSObject + field

Match child relationships using both `childSObject` (the current object name, passed as `objectName` prop) and `field` (the field API name). This handles cases where a parent has multiple child relationships from the same object.

### Decision 3: Graceful fallback

If the parent describe fetch fails or no matching child relationship is found, show "—". Don't break the detail panel over a failed relationship lookup.

## Risks / Trade-offs

- First expand of a reference field triggers an API call if the parent object isn't cached → Acceptable; subsequent expands use cache and the call is fast.
