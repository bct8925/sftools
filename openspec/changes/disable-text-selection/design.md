## Context

The extension currently allows text selection everywhere, making it feel like a webpage rather than a native application. We want to disable text selection on UI chrome (navigation, headers, labels, buttons) while preserving it where functionally necessary (Monaco editor, input fields, data values users need to copy).

The codebase uses a global stylesheet (`src/style.css`) with CSS variables for theming. All styling follows the CSS variable pattern to support both light and dark themes.

## Goals / Non-Goals

**Goals:**
- Make the extension feel more application-like by preventing text selection on chrome elements
- Preserve text selection for functional elements (editors, inputs, data displays)
- Implement globally via CSS without requiring component changes
- Support both light and dark themes

**Non-Goals:**
- Custom text selection colors or styling
- Preventing clipboard operations via JavaScript
- Adding user-configurable selection behavior

## Decisions

### Decision 1: Global CSS Rules in `src/style.css`

**Approach:** Add user-select rules to global stylesheet targeting semantic HTML elements and shared CSS classes.

**Rationale:**
- Single source of truth — no need to modify individual components
- Leverages existing shared CSS class patterns (`.button-brand`, `.card-header`, etc.)
- Easier to maintain and update
- Consistent with existing theming approach (CSS variables in `style.css`)

**Alternatives Considered:**
- CSS Modules per component: Would require changes to 37+ component files, violates DRY
- Inline styles: Anti-pattern, conflicts with existing architecture
- TypeScript/React props: Unnecessary complexity for pure styling concern

### Decision 2: Default Deny with Explicit Allow

**Approach:** Disable text selection by default on body, then re-enable for specific interactive elements.

**Rationale:**
- Safer approach — new elements default to non-selectable
- Shorter CSS (fewer allowlist selectors)
- Easier to maintain — only need to track truly selectable elements

**CSS Structure:**
```css
body {
  user-select: none;
  -webkit-user-select: none;
}

/* Re-enable for functional elements */
.monaco-editor,
.input,
.textarea,
.select,
input,
textarea,
pre,
code,
[contenteditable="true"] {
  user-select: text;
  -webkit-user-select: text;
}
```

**Alternatives Considered:**
- Allow by default, deny on specific selectors: Would require extensive list of chrome selectors (buttons, nav items, headers, labels, etc.), harder to maintain
- Per-component approach: Would miss elements, require ongoing maintenance as components change

### Decision 3: Include Vendor Prefix for Safari

**Approach:** Add both standard `user-select` and `-webkit-user-select` properties.

**Rationale:**
- Safari (WebKit) requires `-webkit-` prefix for full compatibility
- Chrome Extension runs in Chromium (WebKit-based)
- No performance cost, ensures consistency across browsers

## Risks / Trade-offs

**Risk:** Unintentionally blocking selection on copyable data (record IDs, API responses, logs)
**Mitigation:** Explicitly re-enable for `<pre>`, `<code>`, Monaco containers, and result displays. Test all tabs after implementation.

**Risk:** Breaking user workflows that rely on selecting error messages or UI text
**Mitigation:** Error messages typically appear in modals with `<p>` tags or code blocks — both will remain selectable. Verify error displays preserve selection.

**Trade-off:** Users won't be able to select/copy static labels or button text
**Acceptance:** This is the intended behavior — aligns with native app UX. If users need to reference UI text, they can use screenshots or the browser's inspect tools.
