## ADDED Requirements

### Requirement: Re-run button on history items
The query history list SHALL display a re-run button on each history item that executes the query without modifying the history order.

#### Scenario: Re-run button is visible
- **WHEN** user opens the query history modal
- **THEN** each history item displays a re-run button alongside existing action buttons (favorite, delete)

#### Scenario: Re-run button executes query without reordering
- **WHEN** user clicks the re-run button on a history item
- **THEN** the query executes and results appear in a new tab
- **AND** the history list order remains unchanged
- **AND** the query editor content is not modified

#### Scenario: Re-run button with failed query
- **WHEN** user clicks the re-run button on a history item with invalid SOQL
- **THEN** an error message is displayed
- **AND** the history list order remains unchanged

#### Scenario: Clicking history item still loads into editor
- **WHEN** user clicks on the history item itself (not the re-run button)
- **THEN** the query loads into the editor
- **AND** the query executes
- **AND** the history item moves to the top of the list (existing behavior)

### Requirement: Re-run button icon and styling
The re-run button SHALL use a play icon (▶) to indicate execution functionality.

#### Scenario: Button displays play icon
- **WHEN** user views a history item
- **THEN** the re-run button displays a play icon (▶)
- **AND** the button has a descriptive title attribute for accessibility

#### Scenario: Button styling matches existing action buttons
- **WHEN** user views the re-run button
- **THEN** it uses the same CSS styling as the favorite and delete buttons
- **AND** it appears in the action button group on the right side of the history item
