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
# package.json scripts: build, watch, package (no test script)
```

## Test File Organization

**Location:**
- No test files exist in the codebase
- No `*.test.js`, `*.spec.js`, or `__tests__/` directories found

**Naming:**
- Not established (no tests to reference)

**Structure:**
```
# Current state - no tests
src/
  lib/
    salesforce.js      # No salesforce.test.js
    auth.js            # No auth.test.js
  components/
    query/
      query-tab.js     # No query-tab.test.js
```

## Test Structure

**Suite Organization:**
- Not applicable (no tests)

**Patterns:**
- Not established

## Mocking

**Framework:**
- Not configured

**Patterns:**
- Not established

**What Would Need Mocking:**
- Chrome APIs (chrome.storage, chrome.runtime)
- Fetch responses (Salesforce API)
- Native messaging

## Fixtures and Factories

**Test Data:**
- Not applicable

**Location:**
- Not applicable

## Coverage

**Requirements:**
- None (no tests)

**Configuration:**
- Not configured

## Test Types

**Unit Tests:**
- Not implemented
- Would test: `src/lib/salesforce.js` functions, `src/lib/auth.js` functions

**Integration Tests:**
- Not implemented
- Would test: Component → Service → API flow

**E2E Tests:**
- Not implemented
- Would test: Full extension flows via Playwright/Puppeteer

## Common Patterns

**Current State:**
- Manual testing only
- No automated test infrastructure

**Recommended Future Patterns:**

**Async Testing (if implemented):**
```javascript
import { describe, it, expect, vi } from 'vitest';

describe('salesforceRequest', () => {
    it('should handle successful response', async () => {
        vi.mock('./fetch.js', () => ({
            smartFetch: vi.fn().mockResolvedValue({
                success: true,
                data: '{"records":[]}'
            })
        }));

        const result = await salesforceRequest('/query');
        expect(result.json.records).toEqual([]);
    });
});
```

**Chrome API Mocking (if implemented):**
```javascript
// Setup mock for chrome.storage
global.chrome = {
    storage: {
        local: {
            get: vi.fn((keys, callback) => callback({})),
            set: vi.fn((data, callback) => callback())
        }
    },
    runtime: {
        sendMessage: vi.fn()
    }
};
```

## Gaps & Recommendations

**Critical Untested Paths:**
1. Token refresh flow - `src/background/auth.js`
2. Multi-connection state management - `src/lib/auth.js`
3. Salesforce API error handling - `src/lib/salesforce.js`
4. Native messaging protocol - `src/background/native-messaging.js`
5. Query result parsing - `src/components/query/query-tab.js`

**Recommended Testing Setup:**
1. Add Vitest as test runner
2. Create `vitest.config.ts` with Chrome API mocks
3. Start with unit tests for `src/lib/` utilities
4. Add integration tests for critical flows

**Priority Order:**
1. `src/lib/auth.js` - Connection management
2. `src/lib/salesforce.js` - API wrapper functions
3. `src/background/auth.js` - Token refresh
4. Components - After lib coverage established

---

*Testing analysis: 2026-01-15*
*Update when test infrastructure is added*
