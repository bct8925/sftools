## MODIFIED Requirements

### Requirement: Expandable field detail

Clicking a field row in the Schema Browser toggles an expandable detail section beneath that row showing additional metadata. Only properties relevant to the field's type are displayed.

#### Scenario: Expand a field with metadata

- **WHEN** the user clicks a field row
- **THEN** a detail panel expands below the row
- **AND** it shows the field's description (if present)
- **AND** it shows the field's help text (if present)
- **AND** it shows whether the field is required (`!nillable && createable`)
- **AND** it shows the field's default value (if present)
- **AND** it conditionally shows Size, Properties, Relationship, and Picklist rows based on field type

#### Scenario: Collapse an expanded field

- **WHEN** the user clicks an already-expanded field row
- **THEN** the detail panel collapses

#### Scenario: Only one field expanded at a time

- **WHEN** the user clicks a different field row while one is expanded
- **THEN** the previously expanded field collapses
- **AND** the newly clicked field expands

#### Scenario: Field with no metadata

- **WHEN** the user clicks a field that has no description, no help text, is not required, has no default value, and no type-specific properties apply
- **THEN** the detail panel shows only the universal rows with dash placeholders
