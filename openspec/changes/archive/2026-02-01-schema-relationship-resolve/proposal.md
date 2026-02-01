## Why

The Schema Browser's Relationship row currently shows `Parent.RelationshipName` using the field's own `relationshipName` property, which is the parent traversal name. For `Contact.AccountId` this incorrectly shows `Account.Account`. Users expect to see the child relationship name from the parent's perspective (e.g., `Account.Contacts`), which is only available from the parent object's `childRelationships` array.

## What Changes

- Resolve the child relationship name by fetching the parent object's describe and looking up the matching `childRelationship` entry
- Show the resolved name in the format `ParentObject.ChildRelationshipName`
- Handle loading/error states gracefully (show "—" while loading or if unavailable)

## Capabilities

### New Capabilities
- `relationship-resolve`: Async resolution of child relationship names from parent object describes for reference fields

### Modified Capabilities

## Impact

- `src/components/schema/FieldList.tsx`: Add async lookup for child relationship name when a reference field is expanded
