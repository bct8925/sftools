# Codebase Concerns

**Analysis Date:** 2026-01-15

## Tech Debt

**Large Monolithic Components:**
- Issue: Components exceed reasonable size, multiple responsibilities
- Files:
  - `src/components/query/query-tab.js` (1,309 lines)
  - `src/lib/salesforce.js` (903 lines)
  - `src/components/schema/schema-page.js` (762 lines)
  - `src/components/settings/settings-tab.js` (496 lines)
- Why: Rapid feature development without refactoring pauses
- Impact: Harder to understand, test, and maintain
- Fix approach: Extract service classes (TabManager, ResultRenderer), split by responsibility

**Duplicate Rendering Patterns:**
- Issue: Similar `renderHistoryList()` and `renderFavoritesList()` implementations
- Files: `src/components/query/query-tab.js`, `src/components/apex/apex-tab.js`
- Why: Copy-paste during similar feature implementation
- Impact: Changes must be made in multiple places
- Fix approach: Extract shared `renderList()` utility

**Deprecated Function Still Present:**
- Issue: `loadAuthTokens()` marked @deprecated but still in codebase
- File: `src/lib/auth.js`
- Why: Migration to multi-connection left legacy function
- Impact: Confusion for developers, potential misuse
- Fix approach: Remove deprecated function after verifying no usage

## Known Bugs

**No active bugs identified during analysis**
- Codebase appears stable for current feature set

## Security Considerations

**Hardcoded Default Client ID:**
- Risk: All installations share same OAuth app, could be rate-limited or revoked
- File: `manifest.json` (oauth2.client_id)
- Current mitigation: Per-connection clientId can override default
- Recommendations: Document how to create custom OAuth apps

**HTTP Server CORS Configuration:**
- Risk: `Access-Control-Allow-Origin: *` is permissive
- File: `sftools-proxy/src/http-server.js`
- Current mitigation: Server binds to 127.0.0.1 only, requires secret header
- Recommendations: Consider restricting to specific origins

**No Input Validation on SOQL/Apex:**
- Risk: Malformed queries fail at Salesforce, not caught gracefully
- Files: `src/lib/salesforce.js` (executeAnonymousApex, executeQueryWithColumns)
- Current mitigation: URL encoding provides basic safety
- Recommendations: Add client-side SOQL syntax validation

## Performance Bottlenecks

**No Rate Limiting on Batch Operations:**
- Problem: `bulkDeleteTooling()` batches in 25s but no delay between batches
- File: `src/lib/salesforce.js`
- Measurement: Not measured, but rapid API calls could hit limits
- Cause: Missing delay/throttle between batch iterations
- Improvement path: Add configurable delay between batches

**Query Results with No Size Guard:**
- Problem: `SELECT * FROM LargeObject` could return millions of records
- File: `src/components/query/query-tab.js`
- Measurement: Browser could freeze on large result sets
- Cause: No limit on query result size
- Improvement path: Add warning for large result sets, implement pagination UI

## Fragile Areas

**Token Refresh State Management:**
- Files: `src/background/auth.js`, `src/lib/auth.js`
- Why fragile: Module-level state split between frontend and background
- Common failures: Multiple tabs could race to refresh same token
- Safe modification: Ensure mutex pattern (`refreshPromises` map) is always used
- Test coverage: Zero automated tests

**Tab State During Rapid Execution:**
- File: `src/components/query/query-tab.js`
- Why fragile: Async operations on Map-based tab state
- Common failures: Tab switching during async refresh could show wrong results
- Safe modification: Ensure all state mutations are synchronous or properly awaited
- Test coverage: Zero automated tests

## Scaling Limits

**Chrome Storage Quota:**
- Current capacity: 10MB for chrome.storage.local
- Limit: Large query results could exhaust quota
- Symptoms at limit: Storage operations fail silently
- Scaling path: Add quota check before save, implement data cleanup

**Native Messaging Payload Size:**
- Current capacity: 1MB per message
- Limit: Large API responses split via HTTP fallback
- Symptoms at limit: HTTP server handles overflow (working as designed)
- Scaling path: Already handled via `sftools-proxy/src/http-server.js`

## Dependencies at Risk

**faye (CometD Client):**
- Risk: Last updated 2018, potential React 19/Node 20+ compatibility unknown
- Impact: CometD streaming would break
- Migration plan: Alternative Faye fork or custom CometD implementation

## Missing Critical Features

**No Request Timeout Handling:**
- Problem: API calls can hang indefinitely
- Current workaround: User must close and reopen extension
- Blocks: Users stuck on slow orgs or network issues
- Implementation complexity: Low (add AbortController to fetch)

**No Query Cancellation:**
- Problem: Long-running queries cannot be stopped
- Current workaround: Close tab
- Blocks: Users accidentally running expensive queries
- Implementation complexity: Medium (need to track query state)

## Test Coverage Gaps

**Complete Absence of Tests:**
- What's not tested: Entire codebase (0 test files)
- Risk: Any change could break existing functionality
- Priority: High
- Difficulty to test: Chrome API mocking required

**Critical Untested Paths:**
1. Token refresh flow - `src/background/auth.js`
2. Multi-connection switching - `src/lib/auth.js`
3. Salesforce API error parsing - `src/lib/salesforce.js`
4. Query result column metadata parsing - `src/components/query/query-tab.js`
5. Native messaging protocol - `src/background/native-messaging.js`

## Documentation Gaps

**Multi-Connection Architecture:**
- Issue: Complex per-instance state not documented
- Files: `src/lib/auth.js`, `src/background/auth.js`
- Impact: Future developers may not understand state management
- Fix: Add architecture documentation in CLAUDE.md or separate doc

**Custom OAuth Setup:**
- Issue: No guide for creating custom Salesforce OAuth apps
- Files: Referenced in Settings UI but not documented
- Impact: Users with custom requirements cannot configure
- Fix: Add OAuth setup guide to README

---

*Concerns audit: 2026-01-15*
*Update as issues are fixed or new ones discovered*
