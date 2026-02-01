## ADDED Requirements

### Requirement: Always-visible metadata rows

The expanded field detail panel SHALL always display all metadata rows regardless of whether the field has a value. Empty values SHALL display "—" with muted styling.

#### Scenario: Field with no description

- **WHEN** a field with no description is expanded
- **THEN** the Description row SHALL display "—" in muted text

#### Scenario: Field with all metadata populated

- **WHEN** a field with description, help text, and other metadata is expanded
- **THEN** all rows SHALL display their actual values

### Requirement: Default value display

The detail panel SHALL display the field's default value.

#### Scenario: Field with a default value

- **WHEN** a field with a default value is expanded
- **THEN** the "Default" row SHALL display the default value

#### Scenario: Field with no default value

- **WHEN** a field with no default value is expanded
- **THEN** the "Default" row SHALL display "—"

### Requirement: Size display

The detail panel SHALL display field size as a single "Size" row combining length, precision, and scale as appropriate for the field type.

#### Scenario: String field with length

- **WHEN** a string-type field with length > 0 is expanded
- **THEN** the "Size" row SHALL display the length value

#### Scenario: Numeric field with precision and scale

- **WHEN** a numeric-type field (currency, double, percent) is expanded
- **THEN** the "Size" row SHALL display "precision, scale" format

#### Scenario: Field type without meaningful size

- **WHEN** a field with no applicable size (e.g., boolean, id) is expanded
- **THEN** the "Size" row SHALL display "—"

### Requirement: Properties display

The detail panel SHALL display a "Properties" row showing applicable boolean flags as tags: External ID, Unique, Auto Number.

#### Scenario: Field with properties

- **WHEN** a field that is an external ID and unique is expanded
- **THEN** the "Properties" row SHALL display "External ID" and "Unique" as tags

#### Scenario: Field with no properties

- **WHEN** a field with no boolean properties is expanded
- **THEN** the "Properties" row SHALL display "—"

### Requirement: Relationship name display

The detail panel SHALL display the relationship name for reference fields.

#### Scenario: Reference field with relationship name

- **WHEN** a reference field with a relationship name is expanded
- **THEN** the "Relationship" row SHALL display the relationship name

#### Scenario: Non-reference field

- **WHEN** a non-reference field is expanded
- **THEN** the "Relationship" row SHALL display "—"

### Requirement: FieldDescribe type additions

The `FieldDescribe` interface MUST include `externalId: boolean`, `unique: boolean`, and `autoNumber: boolean`.

#### Scenario: Type completeness

- **WHEN** the Salesforce Describe API response is consumed
- **THEN** `externalId`, `unique`, and `autoNumber` SHALL be available on `FieldDescribe`
