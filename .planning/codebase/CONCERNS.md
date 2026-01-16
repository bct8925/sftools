# Codebase Concerns

**Analysis Date:** 2026-01-15

## Tech Debt

**Error Handling Inconsistency:**
- Issue: Mixed patterns - some methods throw exceptions, others return result objects
- Files: `src/lib/salesforce-request.js`, `src/lib/salesforce.js`, all components
- Why: Evolved organically during development
- Impact: Callers must know which pattern each method uses; error handling duplicated
- Fix approach: Documented in `error-handling-standardization.md` (11-14 hour refactor)

**Large Component Files:**
- Issue: Several components exceed reasonable size limits
- Files:
  - `src/components/query/query-tab.js` - 1309 lines
  - `src/components/schema/schema-page.js` - 762 lines
  - `src/lib/salesforce.js` - 903 lines with 35+ exported functions
- Why: Features added incrementally without refactoring
- Impact: Hard to navigate, test, and maintain
- Fix approach: Extract sub-components and service modules by concern

**JSON Parsing Without Error Handling:**
- Issue: `JSON.parse()` calls can throw SyntaxError without try/catch
- Files:
  - `src/lib/salesforce-request.js` lines 36, 42
  - `src/background/auth.js` lines 44, 53, 129
- Why: Assumes well-formed responses
- Impact: Uncaught exceptions if response is malformed
- Fix approach: Wrap all JSON.parse calls in try/catch

## Known Bugs

**No critical bugs identified during analysis**

## Security Considerations

**HTML Rendering in Record Viewer:**
- Risk: Raw HTML from Salesforce rendered without sanitization
- File: `src/components/record/record-page.js` line 469
- Current mitigation: Comment acknowledges Salesforce as trusted source
- Recommendations: Add DOMPurify sanitization or use iframe sandbox

**Console Logging Exposes Data:**
- Risk: Instance URLs, auth state, API endpoints logged to console
- Files: 120+ console.log/error/warn calls throughout codebase
- Current mitigation: None
- Recommendations: Remove logs or gate behind debug flag

**OAuth Client ID in Manifest:**
- Risk: Client ID is public (expected for OAuth public clients)
- File: `manifest.json` line 54
- Current mitigation: Client secret kept server-side by Salesforce
- Recommendations: Document Connected App configuration; add OAuth scopes

## Performance Bottlenecks

**Bulk Query Polling Without Backoff:**
- Problem: Fixed 2-second polling interval for bulk query status
- File: `src/lib/salesforce.js` lines 828-847
- Measurement: Could make 150 API calls over 5 minutes
- Cause: No exponential backoff implemented
- Improvement path: Implement backoff (2s → 5s → 10s) and extend timeout

**Describe Cache No Expiration:**
- Problem: Metadata cache never expires between sessions
- File: `src/lib/salesforce.js` lines 58-112
- Measurement: Cache persists until manual clear or connection removal
- Cause: No TTL mechanism
- Improvement path: Add 1-hour TTL or manual refresh button

## Fragile Areas

**Module-Level Auth State:**
- File: `src/lib/auth.js` lines 14-21
- Why fragile: Shared state across all extension instances (tabs/sidepanels)
- Common failures: Race conditions when multiple tabs switch connections
- Safe modification: Always use setter functions; never modify directly
- Test coverage: No tests

**OAuth Token Refresh:**
- File: `src/background/auth.js`
- Why fragile: Token refresh only works with proxy connected
- Common failures: Silent auth expiration without proxy
- Safe modification: Test both code and implicit flows
- Test coverage: No tests

## Scaling Limits

**Chrome Storage:**
- Current capacity: 5MB for chrome.storage.local
- Limit: Could hit limit with many saved connections and large describe caches
- Symptoms at limit: Storage write failures
- Scaling path: Implement cache eviction by age/size

## Dependencies at Risk

**No critical dependency risks identified**

- Monaco Editor (0.55.1): Actively maintained
- gRPC libraries: Actively maintained by Google
- Faye (1.4.0): Last update 2021, but stable protocol implementation

## Missing Critical Features

**Automated Testing:**
- Problem: No test framework configured
- Current workaround: Manual browser testing
- Blocks: Confident refactoring, regression prevention
- Implementation complexity: Medium (add Vitest, mock Chrome APIs)

**Error Recovery UI:**
- Problem: Auth expiration shows minimal UI feedback
- Current workaround: User must manually re-authorize
- Blocks: Smooth user experience for expired sessions
- Implementation complexity: Low (add modal with re-auth button)

## Test Coverage Gaps

**All Code Untested:**
- What's not tested: Entire codebase (no automated tests)
- Risk: Regressions go unnoticed until manual testing
- Priority: High
- Difficulty to test: Medium (Chrome API mocking required)

**Priority test targets:**
1. `src/lib/salesforce-request.js` - Error handling paths
2. `src/lib/auth.js` - Connection CRUD operations
3. `src/background/auth.js` - Token exchange and refresh
4. `src/lib/salesforce.js` - API response parsing

## Documentation Gaps

**Missing Input Validation:**
- Issue: URL parameters not validated (record viewer, schema browser)
- Files: `src/components/record/record-page.js` lines 78-87
- Risk: Unexpected behavior with malformed URLs
- Fix: Add regex validation for Salesforce IDs and object names

**Missing Developer Setup Guide:**
- Issue: No DEVELOPMENT.md with setup, debugging, testing instructions
- Current: CLAUDE.md covers architecture but not developer workflow
- Fix: Create setup documentation with debugging tips

---

*Concerns audit: 2026-01-15*
*Update as issues are fixed or new ones discovered*
