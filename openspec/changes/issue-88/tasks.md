## 1. Query Preview Trimming

- [x] 1.1 Create `trimQueryPreview()` function in `src/components/query/QueryHistory.tsx` to strip SELECT Id prefix using regex pattern `^SELECT\s+Id\s*,?\s*` (case-insensitive)
- [x] 1.2 Update `getPreview` callback in `QueryHistory` component to use `trimQueryPreview()` before passing to `HistoryList`

## 2. Re-run Button UI

- [x] 2.1 Add `onRerun` callback prop to `HistoryListProps` interface in `src/components/script-list/ScriptList.tsx`
- [x] 2.2 Add re-run button (▶ play icon) to history item actions in `HistoryList` component, alongside favorite and delete buttons
- [x] 2.3 Add CSS styling for re-run button in `src/components/script-list/ScriptList.module.css` matching existing action button styles

## 3. Re-run Functionality

- [x] 3.1 Add `handleRerun` callback in `QueryHistory.tsx` that executes query without calling `onSelectQuery()` or `manager.saveToHistory()`
- [x] 3.2 Import and use `executeQuery` from `src/api/salesforce.ts` to run the query directly
- [x] 3.3 Pass `handleRerun` to `HistoryList` via the new `onRerun` prop
- [x] 3.4 Handle query execution results (success/error) and display in result tabs without modifying editor state

## 4. Test

- [x] 4.1 Write frontend tests using test-writer agent for re-run button click behavior in query history
- [x] 4.2 Write frontend tests using test-writer agent for query preview trimming (various SELECT Id patterns)
- [x] 4.3 Write frontend tests using test-writer agent for history order preservation when using re-run button
- [x] 4.4 Write frontend tests using test-writer agent for existing "load into editor" behavior (clicking item itself)

## 5. Verify

- [x] 5.1 Run `npm run validate` to ensure code quality
- [x] 5.2 Run `npm run test:frontend` to verify all tests pass
- [ ] 5.3 Manually test re-run button executes queries without reordering history
- [ ] 5.4 Manually test query previews display without SELECT Id prefix
- [ ] 5.5 Verify clicking history item itself still loads into editor and reorders (existing behavior preserved)
