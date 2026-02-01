# Spec: Field Metadata Detail

## ADDED Requirements

### Requirement: Expandable field detail

Clicking a field row in the Schema Browser toggles an expandable detail section beneath that row showing additional metadata.

#### Scenario: Expand a field with metadata

- **WHEN** the user clicks a field row
- **THEN** a detail panel expands below the row
- **AND** it shows the field's description (if present)
- **AND** it shows the field's help text (if present)
- **AND** it shows whether the field is required (`!nillable && createable`)
- **AND** it shows picklist values for picklist/multipicklist fields

#### Scenario: Collapse an expanded field

- **WHEN** the user clicks an already-expanded field row
- **THEN** the detail panel collapses

#### Scenario: Only one field expanded at a time

- **WHEN** the user clicks a different field row while one is expanded
- **THEN** the previously expanded field collapses
- **AND** the newly clicked field expands

#### Scenario: Field with no metadata

- **WHEN** the user clicks a field that has no description, no help text, is not required, and has no picklist values
- **THEN** the detail panel shows "No additional metadata"

### Requirement: Picklist value display

#### Scenario: Picklist field with values

- **WHEN** a picklist or multipicklist field is expanded
- **THEN** picklist values are shown as a list with label and API value
- **AND** inactive values are visually distinguished

### Requirement: FieldDescribe type includes metadata fields

#### Scenario: Type completeness

- **WHEN** the Salesforce Describe API returns field metadata
- **THEN** `FieldDescribe` includes `inlineHelpText` (string | null) and `description` (string | null)
