## ADDED Requirements

### Requirement: Field detail rows filtered by field type

The Schema Browser field detail panel SHALL only display property rows that are relevant to the selected field's type. Universal properties (Description, Help Text, Required, Default) SHALL always be shown. Type-specific properties SHALL only appear when applicable.

#### Scenario: String-type field shows Size row

- **WHEN** the user expands a field of type string, textarea, phone, email, url, or encryptedstring
- **THEN** the detail panel shows the Size row with the field's length

#### Scenario: Numeric-type field shows Size row

- **WHEN** the user expands a field of type currency, double, or percent
- **THEN** the detail panel shows the Size row with precision and scale

#### Scenario: Non-sized field hides Size row

- **WHEN** the user expands a field of type boolean, date, datetime, time, reference, id, picklist, multipicklist, or other non-sized type
- **THEN** the detail panel does NOT show the Size row

#### Scenario: Reference field shows Relationship row

- **WHEN** the user expands a field of type reference
- **THEN** the detail panel shows the Relationship row

#### Scenario: Non-reference field hides Relationship row

- **WHEN** the user expands a field that is NOT of type reference
- **THEN** the detail panel does NOT show the Relationship row

#### Scenario: Field with applicable properties shows Properties row

- **WHEN** the user expands a field that has at least one applicable property (External ID, Unique, Auto Number)
- **THEN** the detail panel shows the Properties row with property tags

#### Scenario: Field with no applicable properties hides Properties row

- **WHEN** the user expands a field that has no applicable properties
- **THEN** the detail panel does NOT show the Properties row
