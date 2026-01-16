# Testing Patterns

**Analysis Date:** 2026-01-15

## Test Framework

**Runner:**
- None configured

**Assertion Library:**
- Not applicable

**Run Commands:**
```bash
# No test commands available
# Testing is done manually in browser
```

## Test File Organization

**Location:**
- No test files present in codebase

**Naming:**
- No test naming conventions established

**Structure:**
```
# No test structure exists
# All testing is manual browser testing
```

## Test Structure

**Suite Organization:**
- Not applicable (no automated tests)

**Patterns:**
- Manual testing in Chrome browser
- Extension loaded via "Load unpacked" in developer mode
- Side panel and standalone pages tested interactively

## Mocking

**Framework:**
- Not applicable

**Patterns:**
- Not applicable

**What to Mock (if tests were added):**
- Chrome extension APIs (chrome.runtime, chrome.storage)
- Salesforce REST API responses
- Native messaging communication
- OAuth token exchange

## Fixtures and Factories

**Test Data:**
- Not applicable

**Location:**
- Not applicable

## Coverage

**Requirements:**
- No coverage requirements
- No coverage tracking

**Configuration:**
- Not applicable

**View Coverage:**
- Not applicable

## Test Types

**Unit Tests:**
- Not implemented
- Candidates: `src/lib/auth.js`, `src/lib/salesforce.js`, `src/lib/text-utils.js`

**Integration Tests:**
- Not implemented
- Candidates: OAuth flow, API request flow, streaming subscription flow

**E2E Tests:**
- Not implemented
- Candidates: Full query execution, Apex execution, record editing

## Common Patterns

**Manual Testing Approach:**

1. Build extension: `npm run build`
2. Load unpacked in Chrome: `chrome://extensions/`
3. Open side panel and test features
4. Check browser console for errors
5. Test OAuth flow with sandbox org

**Debugging:**
- Browser DevTools for frontend
- `/tmp/sftools-proxy.log` for proxy logs
- Chrome extension errors in `chrome://extensions/`

## Recommended Test Infrastructure (Not Implemented)

**If adding tests:**
- Framework: Vitest (compatible with Vite build)
- Mocking: vi.mock() for Chrome APIs
- Coverage: Vitest built-in coverage
- Test structure: Co-located `*.test.js` files

**Priority areas for testing:**
1. `src/lib/salesforce-request.js` - Error handling, auth expiration
2. `src/lib/auth.js` - Connection management, token storage
3. `src/lib/salesforce.js` - API method responses
4. `src/background/auth.js` - Token exchange, refresh flow

---

*Testing analysis: 2026-01-15*
*Update when test patterns change*
