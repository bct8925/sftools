## 1. CSS Implementation

- [x] 1.1 Add global `user-select: none` to `body` in `src/style.css` with `-webkit-user-select` prefix
- [x] 1.2 Add explicit `user-select: text` rules for functional elements (Monaco editor, inputs, code blocks) in `src/style.css`
- [x] 1.3 Add `user-select: text` for table cells and data display elements in `src/style.css`

## 2. Test

- [ ] 2.1 Write frontend test for navigation text selection prevention using test-writer agent
- [ ] 2.2 Write frontend test for button text selection prevention using test-writer agent
- [ ] 2.3 Write frontend test for Monaco editor text selection preservation using test-writer agent
- [ ] 2.4 Write frontend test for input field text selection preservation using test-writer agent

## 3. Manual Verification

- [ ] 3.1 Verify text selection disabled on tab navigation (`.tab-nav`)
- [ ] 3.2 Verify text selection disabled on buttons (`.button-brand`, `.button-neutral`)
- [ ] 3.3 Verify text selection disabled on card headers (`.card-header`)
- [ ] 3.4 Verify text selection disabled on form labels
- [ ] 3.5 Verify text selection enabled in Monaco editor
- [ ] 3.6 Verify text selection enabled in all input/textarea/select fields
- [ ] 3.7 Verify text selection enabled in query results tables
- [ ] 3.8 Verify text selection enabled in API response displays
- [ ] 3.9 Verify text selection enabled for error messages
- [ ] 3.10 Verify behavior consistent in both light and dark themes

## 4. Verify

- [x] 4.1 Run validation (`npm run validate`)
- [ ] 4.2 Run frontend tests (`npm run test:frontend`)
- [x] 4.3 Build extension (`npm run build`) and verify no errors
