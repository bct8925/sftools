## Requirements

### Requirement: Event table displays received events

The Events tab SHALL display received streaming events in a table view with one row per event, showing key metadata to enable quick browsing and selection.

#### Scenario: Event received while subscribed
- **WHEN** a streaming event is received on a subscribed channel
- **THEN** the event SHALL appear as a new row in the event table with timestamp, replay ID (if available), channel name, and event type

#### Scenario: System message generated
- **WHEN** a system message occurs (connection status, subscription change, error)
- **THEN** the message SHALL appear as a distinct row in the event table with appropriate styling to differentiate it from actual events

#### Scenario: Table initially empty
- **WHEN** the Events tab is opened with no active subscription
- **THEN** the event table SHALL display an empty state message prompting the user to subscribe to a channel

### Requirement: User can open event in Monaco editor

Each event row SHALL include an action to open the full event payload in the Monaco editor for detailed inspection.

#### Scenario: User clicks Open button
- **WHEN** user clicks the "Open" button on an event row
- **THEN** the Monaco editor SHALL display the full event JSON payload formatted for readability

#### Scenario: User opens multiple events sequentially
- **WHEN** user opens event A, then opens event B
- **THEN** the Monaco editor SHALL replace event A's content with event B's content

#### Scenario: Opened event visual feedback
- **WHEN** an event is opened in the Monaco editor
- **THEN** the event's table row SHALL have visual styling to indicate it has been opened

### Requirement: Split view layout

The Events tab SHALL use a split view layout with the event table and Monaco editor visible simultaneously.

#### Scenario: Layout on desktop viewport
- **WHEN** the Events tab is displayed on a standard desktop viewport
- **THEN** the layout SHALL show the Monaco editor occupying 2/3 of the width and the event table occupying 1/3 of the width

#### Scenario: Both views always visible
- **WHEN** events are being received and displayed
- **THEN** both the event table and Monaco editor SHALL remain visible (no toggle or tabs)

### Requirement: Clear stream clears event table

The "Clear Stream" action SHALL remove all events from the event table and reset the Monaco editor.

#### Scenario: User clicks Clear Stream
- **WHEN** user clicks the "Clear Stream" button
- **THEN** all events SHALL be removed from the table AND the Monaco editor SHALL be cleared

### Requirement: Event metadata extraction

The system SHALL extract key metadata from each received event to populate table columns.

#### Scenario: Standard platform event received
- **WHEN** a Platform Event is received with standard structure
- **THEN** the event type SHALL be extracted from the event payload schema field

#### Scenario: Event type unavailable
- **WHEN** an event is received without a parseable event type
- **THEN** the event type column SHALL display "Unknown" or the raw channel name

#### Scenario: Replay ID present
- **WHEN** an event includes a replay ID in the streaming envelope
- **THEN** the replay ID SHALL be displayed in the table

### Requirement: Event ordering

Events SHALL be displayed in the table in the order they were received, with newest events appearing at the bottom.

#### Scenario: Events received in sequence
- **WHEN** events A, B, C are received in that order
- **THEN** the table SHALL display them in order: A (top), B (middle), C (bottom)

#### Scenario: Auto-scroll to newest event
- **WHEN** a new event is received
- **THEN** the table SHALL automatically scroll to show the newest event at the bottom

### Requirement: Memory limits for long-running subscriptions

The event table SHALL limit the number of stored events to prevent unbounded memory growth during long-running subscriptions.

#### Scenario: Event limit exceeded
- **WHEN** the number of events exceeds 100
- **THEN** the oldest event SHALL be removed from the table when a new event arrives

#### Scenario: System messages exempt from limit
- **WHEN** counting events against the limit
- **THEN** system messages SHALL NOT count toward the 100-event limit
