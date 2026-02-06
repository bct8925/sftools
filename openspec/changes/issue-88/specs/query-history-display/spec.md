## ADDED Requirements

### Requirement: Strip common SOQL prefixes from query previews
The query history list SHALL remove common SOQL prefixes (SELECT and Id field) from query preview text to improve readability.

#### Scenario: SELECT Id prefix is removed
- **WHEN** a history item contains a query starting with "SELECT Id,"
- **THEN** the preview text displays the query without "SELECT Id," prefix
- **AND** the next field name or FROM clause is shown at the start

#### Scenario: SELECT Id FROM prefix is removed
- **WHEN** a history item contains a query starting with "SELECT Id FROM"
- **THEN** the preview text displays the query without "SELECT Id FROM" prefix
- **AND** the object name appears at the start of the preview

#### Scenario: Case-insensitive prefix matching
- **WHEN** a history item contains a query with lowercase "select id,"
- **THEN** the preview text removes the prefix regardless of case
- **AND** the trimmed preview is displayed

#### Scenario: Queries without standard prefix show full preview
- **WHEN** a history item contains a query not starting with "SELECT Id"
- **THEN** the preview text displays the query as-is
- **AND** only generic whitespace normalization is applied

#### Scenario: Whitespace variations are handled
- **WHEN** a history item contains "SELECT  Id  ,  Name" with extra spaces
- **THEN** the preview removes "SELECT Id," and normalizes remaining whitespace
- **AND** displays "Name FROM..." or equivalent

### Requirement: Preview generation function
A query-specific preview generation function SHALL be created to handle SOQL-specific formatting.

#### Scenario: Preview function trims SOQL prefixes
- **WHEN** the preview function receives a SOQL query string
- **THEN** it removes the SELECT Id prefix pattern using case-insensitive regex
- **AND** returns the trimmed query text

#### Scenario: Preview function preserves original query
- **WHEN** the preview function is called
- **THEN** the original query content in storage is not modified
- **AND** only the display preview is affected
