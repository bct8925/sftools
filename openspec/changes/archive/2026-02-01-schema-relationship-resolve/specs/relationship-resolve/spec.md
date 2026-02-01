## ADDED Requirements

### Requirement: Resolve child relationship name from parent describe

The Relationship row in the field detail panel SHALL display the child relationship name from the parent object's describe, in the format `ParentObject.ChildRelationshipName`.

#### Scenario: Reference field with resolvable child relationship

- **WHEN** a reference field (e.g., `Contact.AccountId`) is expanded
- **THEN** the system SHALL fetch the parent object's describe (e.g., `Account`)
- **AND** find the child relationship where `childSObject` matches the current object and `field` matches the field name
- **AND** display the result as `Account.Contacts`

#### Scenario: Reference field while resolving

- **WHEN** a reference field is expanded and the parent describe has not yet loaded
- **THEN** the Relationship row SHALL display a loading indicator

#### Scenario: Reference field with no matching child relationship

- **WHEN** a reference field is expanded but no matching child relationship is found on the parent
- **THEN** the Relationship row SHALL display "—"

#### Scenario: Non-reference field

- **WHEN** a non-reference field is expanded
- **THEN** the Relationship row SHALL display "—"

#### Scenario: Parent describe fetch fails

- **WHEN** the parent object's describe fetch fails
- **THEN** the Relationship row SHALL display "—"
