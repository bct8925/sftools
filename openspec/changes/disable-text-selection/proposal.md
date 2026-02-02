## Why

The extension currently allows users to select and highlight text throughout the UI, making it feel like a webpage rather than a native application. Disabling text selection on non-interactive elements will improve the user experience by making the extension feel more polished and application-like, while still allowing text selection where it's functionally necessary (code editors, input fields, copyable values).

## What Changes

- Add CSS user-select rules to prevent text selection on UI chrome elements (headers, labels, buttons, navigation)
- Preserve text selection for interactive elements (Monaco editor, text inputs, data fields users need to copy)
- Apply selectively to maintain usability while improving polish

## Capabilities

### New Capabilities
- `text-selection-control`: Global CSS rules controlling which elements allow text selection vs which prevent it

### Modified Capabilities
<!-- No existing capabilities are being modified -->

## Impact

- **CSS**: Global styles in `src/style.css` will add user-select rules
- **Components**: No component-level changes needed - handled globally via CSS
- **User Experience**: Text selection disabled on chrome elements, preserved on functional elements
- **Accessibility**: No impact - screen readers and keyboard navigation unaffected

## Non-goals

- Custom text selection styling or colors
- Preventing copy/paste functionality via JavaScript
- Disabling text selection in Monaco editor or input fields
