## ADDED Requirements

### Requirement: Chrome elements MUST prevent text selection
The extension SHALL apply `user-select: none` to UI chrome elements including navigation, headers, labels, buttons, and non-interactive text to create an application-like experience.

#### Scenario: User attempts to select navigation text
- **WHEN** user tries to click-drag to select text in the tab navigation bar (`.tab-nav`)
- **THEN** the text SHALL NOT become highlighted and no text selection SHALL occur

#### Scenario: User attempts to select button text
- **WHEN** user tries to select text within buttons (`.button-brand`, `.button-neutral`)
- **THEN** the text SHALL NOT become highlighted and no text selection SHALL occur

#### Scenario: User attempts to select card headers
- **WHEN** user tries to select text in card headers (`.card-header`)
- **THEN** the text SHALL NOT become highlighted and no text selection SHALL occur

#### Scenario: User attempts to select labels
- **WHEN** user tries to select form labels or page headers
- **THEN** the text SHALL NOT become highlighted and no text selection SHALL occur

### Requirement: Functional elements MUST allow text selection
The extension SHALL preserve `user-select: text` for interactive and functional elements where text selection is necessary for user workflows.

#### Scenario: User selects text in Monaco editor
- **WHEN** user click-drags to select code in Monaco editor (`.monaco-editor`)
- **THEN** the text SHALL become highlighted and be selectable/copyable

#### Scenario: User selects text in input fields
- **WHEN** user click-drags to select text in any input, textarea, or select element
- **THEN** the text SHALL become highlighted and be selectable/copyable

#### Scenario: User selects query results
- **WHEN** user tries to select record IDs or field values displayed in query results
- **THEN** the text SHALL be selectable if displayed in `<pre>`, `<code>`, or table cells

#### Scenario: User selects API response text
- **WHEN** user tries to select JSON or text displayed in REST API responses
- **THEN** the text SHALL be selectable if displayed in code blocks or Monaco editor

#### Scenario: User selects error messages
- **WHEN** user tries to select error text from API failures or validation errors
- **THEN** the text SHALL be selectable for copying/reporting

### Requirement: Implementation MUST use global CSS
The text selection behavior SHALL be controlled via global CSS rules in `src/style.css` without requiring changes to individual React components.

#### Scenario: New component inherits default behavior
- **WHEN** a new React component is added without explicit user-select styling
- **THEN** the component SHALL inherit the appropriate selection behavior based on its semantic HTML elements and CSS classes

#### Scenario: Theming does not affect selection
- **WHEN** user switches between light and dark themes
- **THEN** text selection behavior SHALL remain consistent across both themes

### Requirement: Browser compatibility
The CSS rules SHALL include vendor prefixes to ensure consistent behavior across Chromium-based browsers including Safari/WebKit.

#### Scenario: Extension runs in Chrome
- **WHEN** extension is used in Google Chrome
- **THEN** text selection behavior SHALL work as specified

#### Scenario: Extension runs in Safari (if applicable)
- **WHEN** extension is used in Safari or other WebKit-based browser
- **THEN** text selection behavior SHALL work as specified using `-webkit-user-select` prefix
