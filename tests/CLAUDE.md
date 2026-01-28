# Testing - sftools

> **Parent context**: This extends [../CLAUDE.md](../CLAUDE.md)

## Overview

| Aspect | Details |
|--------|---------|
| **Unit Tests** | Vitest with jsdom, Chrome API mocks, TypeScript |
| **Integration Tests** | Vitest with real Salesforce API calls |
| **Frontend Tests** | Vitest with Playwright, headless browser, mocked APIs |

All tests use Vitest and are visible in VSCode's Testing panel.

## Quick Commands

```bash
# Unit tests
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.ts        # Run specific file
npm run test:unit:watch                  # Watch mode
npm run test:unit:coverage               # With coverage report

# Integration tests (requires .env.test)
npm run test:integration                 # Run all
npm run test:integration -- query        # Match pattern

# Frontend tests (Vitest + Playwright)
npm run test:frontend                    # Run all (headless)
npm run test:frontend -- -t "Query"      # Filter by test name
npm run test:frontend:watch              # Watch mode
```

## Directory Structure

```
tests/
├── unit/                     # Vitest unit tests (jsdom)
│   ├── setup.ts              # Global setup, Chrome mock install
│   ├── mocks/
│   │   ├── chrome.ts         # Chrome extension API mock
│   │   └── salesforce.ts     # API response factories
│   ├── lib/                  # Tests for src/lib/*
│   │   ├── auth.test.ts
│   │   ├── salesforce.test.ts
│   │   └── ...
│   └── proxy/                # Tests for sftools-proxy/src/*
│
├── integration/              # Vitest integration tests (node)
│   ├── setup.ts              # Salesforce client, TestDataManager
│   ├── apex.test.ts
│   ├── query.test.ts
│   └── ...
│
├── browser/                  # Vitest browser tests (Playwright)
│   ├── setup.ts              # Vite server, browser lifecycle
│   ├── test-utils.ts         # Page object factories, navigation
│   ├── types.ts              # Test configuration types
│   ├── specs/                # Test files by feature
│   │   ├── query/
│   │   ├── apex/
│   │   ├── record/
│   │   └── ...
│   ├── pages/                # Page object models
│   │   ├── base.page.ts
│   │   ├── query-tab.page.ts
│   │   └── ...
│   ├── helpers/
│   │   └── monaco-helpers.ts
│   └── services/
│       ├── headless-loader.ts
│       └── salesforce-client.ts
│
└── shared/                   # Shared mock infrastructure
    └── mocks/
        ├── index.ts
        ├── mock-data.ts
        ├── mock-scenarios.ts
        ├── playwright-adapter.ts  # MockRouter
        └── chrome-browser-mock.ts
```

## Test ID Convention

Each test has a hierarchical ID for traceability:

| Prefix | Area |
|--------|------|
| `Q-F-xxx` | Query Tab (Frontend) |
| `A-F-xxx` | Apex Tab (Frontend) |
| `R-F-xxx` | REST API Tab (Frontend) |
| `E-F-xxx` | Events Tab (Frontend) |
| `S-F-xxx` | Settings (Frontend) |
| `RV-F-xxx` | Record Viewer (Frontend) |
| `SB-F-xxx` | Schema Browser (Frontend) |
| `U-F-xxx` | Utils Tab (Frontend) |
| `*-I-xxx` | Integration Tests |
| `*-U-xxx` | Unit Tests |

## Unit Tests

### Configuration

Tests use Vitest with jsdom environment:

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.ts'],
    globals: true
  }
});
```

### Chrome Mock

The Chrome API mock provides storage, runtime messaging, and more:

```typescript
import { chromeMock } from '../mocks/chrome';

beforeEach(() => {
  chromeMock._reset(); // Clear state
});

it('reads connection', () => {
  chromeMock._setStorageData({
    connections: [{ id: '1', accessToken: 'token' }]
  });

  expect(getAccessToken()).toBe('token');
});
```

### Chrome Mock API

| Method | Purpose |
|--------|---------|
| `chromeMock._reset()` | Clear all storage and state |
| `chromeMock._setStorageData(data)` | Set storage.local data |
| `chromeMock._getStorageData()` | Get current storage data |
| `chromeMock._triggerStorageChange(changes)` | Trigger storage change event |

## Integration Tests

### Setup

Requires `.env.test` file in project root:

```
SF_ACCESS_TOKEN=your_session_token
SF_INSTANCE_URL=https://your-org.my.salesforce.com
```

### TestDataManager

Automatic cleanup of created records:

```typescript
import { TestDataManager } from './setup';

describe('Q-I-001: Query returns results', () => {
  const testData = new TestDataManager();

  afterEach(async () => {
    await testData.cleanup();
  });

  it('executes query', async () => {
    const accountId = await testData.create('Account', {
      Name: testData.uniqueName('TestAccount')
    });

    const result = await salesforce.query(
      `SELECT Id, Name FROM Account WHERE Id = '${accountId}'`
    );

    expect(result.records).toHaveLength(1);
  });
});
```

## Frontend Tests

### Architecture

Frontend tests use **Vitest with Playwright** for browser automation:

```
vitest.config.browser.ts
    └── setup.ts (beforeAll/afterAll)
        ├── Starts Vite dev server (port 5174)
        ├── Launches headless Chromium via Playwright
        ├── Injects Chrome API mocks
        └── Creates fresh page per test (beforeEach)
```

### Configuration

```typescript
// vitest.config.browser.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/browser/**/*.test.ts'],
    setupFiles: ['tests/browser/setup.ts'],
    testTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } }
  }
});
```

### Writing Frontend Tests

```typescript
// tests/browser/specs/feature/my-feature.test.ts
import { describe, it, beforeEach, expect } from 'vitest';
import {
    getTestContext,
    createPageObjects,
    setupMocks,
    navigateToExtension,
    MockRouter,
} from '../../test-utils';

describe('My Feature', () => {
    beforeEach(async () => {
        const router = new MockRouter();
        router.onQuery(/\/query/, [
            { Id: '001xxx', Name: 'Test Account' }
        ]);
        await setupMocks(router);
    });

    it('executes query successfully', async () => {
        const { page } = getTestContext();
        const { queryTab } = createPageObjects(page);

        await navigateToExtension();
        await queryTab.navigateTo();
        await queryTab.executeQuery('SELECT Id, Name FROM Account');

        const status = await queryTab.getStatus();
        expect(status.type).toBe('success');

        const count = await queryTab.getResultsCount();
        expect(count).toBe(1);
    });
});
```

### Test Utilities

```typescript
import {
    getTestContext,      // Get current page/context
    createPageObjects,   // Create page objects for current page
    setupMocks,          // Apply MockRouter to browser context
    navigateToExtension, // Navigate to main app
    navigateToRecord,    // Navigate to record viewer
    navigateToSchema,    // Navigate to schema browser
    MockRouter,          // Mock Salesforce API responses
} from '../../test-utils';
```

### MockRouter API

```typescript
const router = new MockRouter();

// Mock SOQL queries
router.onQuery(/\/query/, records, columnMetadata);

// Mock object describe
router.onDescribe('Account', fields);

// Mock Apex execution
router.onApexExecute(true, true, 'Debug log content');

// Mock record operations
router.onGetRecord('Account', '001xxx', record);
router.onUpdateRecord('Account', '001xxx');

// Apply to browser context
await setupMocks(router);
```

### Page Objects

Each tab/page has a page object with semantic methods:

```typescript
const { page } = getTestContext();
const { queryTab, apexTab, recordPage, schemaPage } = createPageObjects(page);

// Query tab
await queryTab.navigateTo();
await queryTab.executeQuery('SELECT Id FROM Account');
await queryTab.getStatus();
await queryTab.getResultsCount();

// Apex tab
await apexTab.navigateTo();
await apexTab.executeCode('System.debug("Hello");');
await apexTab.getLogContent();

// Record page
await navigateToRecord('Account', '001xxx');
await recordPage.getFieldValue('Name');
await recordPage.editField('Name', 'New Value');
```

### Running Specific Tests

```bash
# Filter by test name pattern
npm run test:frontend -- -t "Query"
npm run test:frontend -- -t "Q-F-001"

# Watch mode
npm run test:frontend:watch
```

## Mock Infrastructure

### Shared Mocks

The `tests/shared/mocks/` directory contains mock infrastructure shared between unit and frontend tests:

```typescript
// MockRouter for API interception
import { MockRouter } from '../shared/mocks/index.js';

const router = new MockRouter();
router.onQuery(/query/, records, metadata);
```

### Mock Scenarios

Pre-built scenarios for common test cases:

```typescript
import { EventsChannelsScenario } from '../shared/mocks/mock-scenarios.js';

const router = new MockRouter();
router.usePreset(EventsChannelsScenario);
```

## Best Practices

### Unit Tests

1. **Reset mocks in beforeEach** - Always call `chromeMock._reset()`
2. **Test one thing per test** - Keep tests focused
3. **Use descriptive names** - `it('returns empty array when no connections')`
4. **Test edge cases** - null, undefined, empty arrays, errors

### Integration Tests

1. **Use TestDataManager** - Always cleanup created records
2. **Use unique names** - Prevent collisions with `uniqueName()`
3. **Include test IDs** - Follow the `X-I-xxx` convention

### Frontend Tests

1. **Set up mocks in beforeEach** - Create MockRouter and call `setupMocks()`
2. **Get context first** - Use `getTestContext()` and `createPageObjects()`
3. **Use page objects** - Don't interact with DOM directly
4. **Use Vitest expect** - Standard `expect(x).toBe(y)` syntax

## Debugging Tests

### Unit Tests

```bash
npm run test:unit -- --reporter=verbose
npm run test:unit -- -t "my test name"
```

### Frontend Tests

```bash
# Filter tests
npm run test:frontend -- -t "Query"

# Watch mode for iterating
npm run test:frontend:watch
```

### Common Issues

| Problem | Solution |
|---------|----------|
| Chrome mock not working | Ensure `chromeMock._reset()` in beforeEach |
| Integration test fails | Check `.env.test` credentials |
| Frontend test timeout | Check MockRouter patterns |
| Mock not matching | Check URL pattern in MockRouter |
| Vite server port conflict | Set `VITE_PORT=5175` env var |

## Adding New Tests

### For new src/lib/ function

1. Create `tests/unit/lib/my-function.test.ts`
2. Import the function and mocks
3. Write tests covering happy path, edge cases, errors

### For new component feature (E2E)

1. Create `tests/browser/specs/feature/my-feature.test.ts`
2. Set up mocks in `beforeEach()`
3. Use `getTestContext()` and `createPageObjects()`
4. Use page objects for interactions

### For new API integration

1. Create `tests/integration/feature.test.ts`
2. Use `TestDataManager` for cleanup
3. Include test ID in describe block
