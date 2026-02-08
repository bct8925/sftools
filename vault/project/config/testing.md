---
title: Testing Framework
type: project
category: config
tags:
  - testing
  - vitest
  - playwright
  - unit-tests
  - frontend-tests
  - integration-tests
aliases:
  - Tests
  - Testing
created: 2026-02-08
updated: 2026-02-08
status: active
related-code:
  - tests/
  - vitest.config.ts
  - vitest.config.browser.ts
  - vitest.config.integration.ts
confidence: high
---

# Testing Framework

## Overview

Three test layers using [[Vitest]] as the unified runner: **unit tests** (jsdom + Chrome mock), **frontend tests** (Playwright headless browser), and **integration tests** (real Salesforce API calls).

## How It Works

### Test Architecture

| Layer | Environment | Runner | Directory |
|-------|-------------|--------|-----------|
| Unit | jsdom | `vitest` | `tests/unit/` |
| Frontend | Chromium (Playwright) | `vitest` (browser config) | `tests/browser/` |
| Integration | Node.js | `vitest` (integration config) | `tests/integration/` |

### Unit Tests

- Environment: jsdom with Chrome API mock
- Setup: `tests/unit/setup.ts` installs `chromeMock` globally
- Chrome mock: `tests/unit/mocks/chrome.ts` — storage, runtime messaging
  - `chromeMock._reset()` — clear state (call in `beforeEach`)
  - `chromeMock._setStorageData(data)` — set storage
  - `chromeMock._triggerStorageChange(changes)` — trigger listeners
- Test structure mirrors source: `tests/unit/api/`, `tests/unit/auth/`, `tests/unit/lib/`

### Frontend Tests (Vitest + Playwright)

- Starts Vite dev server (port 5174) + headless Chromium
- Fresh page per test (`beforeEach`)
- **MockRouter** intercepts Salesforce API calls in browser context
- **Page Objects** provide semantic test methods

```typescript
const router = new MockRouter();
router.onQuery(/\/query/, records, columnMetadata);
router.onDescribe('Account', fields);
router.onApexExecute(true, true, 'Debug log');
router.onGetRecord('Account', '001xxx', record);
await setupMocks(router);

const { page } = getTestContext();
const { queryTab } = createPageObjects(page);
await navigateToExtension();
await queryTab.executeQuery('SELECT Id FROM Account');
```

Page objects: `base.page.ts`, `query-tab.page.ts`, `apex-tab.page.ts`, etc.

### Integration Tests

- Requires `.env.test` with real Salesforce credentials (gitignored)
- `TestDataManager` for automatic cleanup of created records
- `testData.create('Account', { Name: testData.uniqueName('Test') })`

### Test ID Convention

Hierarchical IDs for traceability:

| Prefix | Area |
|--------|------|
| `Q-F-xxx` | Query (Frontend) |
| `A-F-xxx` | Apex (Frontend) |
| `R-F-xxx` | REST API (Frontend) |
| `E-F-xxx` | Events (Frontend) |
| `S-F-xxx` | Settings (Frontend) |
| `RV-F-xxx` | Record Viewer (Frontend) |
| `SB-F-xxx` | Schema Browser (Frontend) |
| `U-F-xxx` | Utils (Frontend) |
| `*-I-xxx` | Integration |
| `*-U-xxx` | Unit |

### Shared Mock Infrastructure

`tests/shared/mocks/`:
- `MockRouter` — API interception for both unit and frontend tests
- `mock-data.ts` — Reusable test data factories
- `mock-scenarios.ts` — Pre-built scenarios (e.g., `EventsChannelsScenario`)
- `playwright-adapter.ts` — Bridge MockRouter to Playwright context
- `chrome-browser-mock.ts` — Chrome API mock for browser tests

## Key Files

| File | Purpose |
|------|---------|
| `vitest.config.ts` | Unit test config (jsdom) |
| `vitest.config.browser.ts` | Frontend test config (Playwright) |
| `vitest.config.integration.ts` | Integration test config (Node) |
| `tests/unit/setup.ts` | Chrome mock installation |
| `tests/unit/mocks/chrome.ts` | Chrome API mock |
| `tests/browser/setup.ts` | Vite server + browser lifecycle |
| `tests/browser/test-utils.ts` | Page objects, navigation, MockRouter setup |
| `tests/integration/setup.ts` | Salesforce client, TestDataManager |

## Related

- [[overview|System Architecture Overview]]
- [[environment|Environment Configuration]]
- [[Vitest]]
- [[Playwright]]

## Notes

### Commands
```bash
npm run test:unit                    # All unit tests
npm run test:unit -- auth.test.ts   # Specific file
npm run test:frontend               # All frontend (headless)
npm run test:frontend -- -t "Query" # Filter by name
npm run test:integration            # Real API calls (needs .env.test)
```

### Common Issues
| Problem | Solution |
|---------|----------|
| Chrome mock not working | `chromeMock._reset()` in `beforeEach` |
| Integration test fails | Check `.env.test` credentials |
| Frontend test timeout | Check MockRouter URL patterns |
| Vite port conflict | Set `VITE_PORT=5175` env var |
