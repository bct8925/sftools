# Testing - sftools

> **Parent context**: This extends [../CLAUDE.md](../CLAUDE.md)

## Overview

| Aspect | Details |
|--------|---------|
| **Unit Tests** | Vitest with jsdom, Chrome API mocks |
| **Integration Tests** | Vitest with real Salesforce API calls |
| **Frontend Tests** | Playwright with mocked API responses |

## Quick Commands

```bash
# Unit tests
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.js        # Run specific file
npm run test:unit:watch                  # Watch mode
npm run test:unit:coverage               # With coverage report

# Integration tests (requires .env.test)
npm run test:integration                 # Run all
npm run test:integration -- query        # Match pattern

# Frontend tests
npm run test:frontend                    # Run all
npm run test:frontend -- --filter=query  # Filter by name
npm run test:frontend:slow               # With human timing
```

## Directory Structure

```
tests/
├── unit/                     # Vitest unit tests (jsdom)
│   ├── setup.js              # Global setup, Chrome mock install
│   ├── mocks/
│   │   ├── chrome.js         # Chrome extension API mock
│   │   └── salesforce.js     # API response factories
│   ├── lib/                  # Tests for src/lib/*
│   │   ├── auth.test.js
│   │   ├── salesforce.test.js
│   │   ├── query-utils.test.js
│   │   └── ...
│   └── proxy/                # Tests for sftools-proxy/src/*
│       ├── router.test.js
│       └── ...
│
├── integration/              # Vitest integration tests (node)
│   ├── setup.js              # Salesforce client, TestDataManager
│   ├── apex.test.js          # A-I-001 through A-I-007
│   ├── query.test.js         # Q-I-001 through Q-I-009
│   └── ...
│
├── frontend/                 # Playwright browser tests
│   ├── framework/
│   │   ├── base-test.ts      # SftoolsTest base class
│   │   ├── runner.ts         # Custom test runner
│   │   ├── assertions.ts     # Fluent assertion API
│   │   └── types.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── extension-loader.ts
│   │   └── salesforce-client.ts
│   ├── pages/                # Page object models
│   │   ├── base.page.ts
│   │   ├── query-tab.page.ts
│   │   ├── apex-tab.page.ts
│   │   └── ...
│   ├── helpers/
│   │   └── monaco-helpers.ts
│   └── specs/                # Test files by feature
│       ├── query/
│       ├── apex/
│       ├── record/
│       └── ...
│
└── shared/                   # Shared mock infrastructure
    └── mocks/
        ├── index.js
        ├── mock-data.js      # Response factories
        ├── mock-scenarios.js # Pre-built scenarios
        └── playwright-adapter.js # MockRouter for Playwright
```

## Test ID Convention

Each integration test has a hierarchical ID for traceability:

| Prefix | Area |
|--------|------|
| `Q-I-xxx` | Query Tab |
| `A-I-xxx` | Apex Tab |
| `R-I-xxx` | REST API Tab |
| `E-I-xxx` | Events Tab |
| `S-I-xxx` | Settings |
| `RV-I-xxx` | Record Viewer |
| `SB-I-xxx` | Schema Browser |
| `U-I-xxx` | Utils Tab |

## Unit Tests

### Configuration

Tests use Vitest with jsdom environment:

```javascript
// vitest.config.js
export default {
    test: {
        environment: 'jsdom',
        setupFiles: ['tests/unit/setup.js'],
        include: ['tests/unit/**/*.test.js'],
        globals: true
    }
}
```

### Chrome Mock

The Chrome API mock provides storage, runtime messaging, and more:

```javascript
// tests/unit/mocks/chrome.js
import { chromeMock } from '../mocks/chrome.js';

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

### Salesforce Mock

Factory functions for API responses:

```javascript
// tests/unit/mocks/salesforce.js
import { createQueryResponse, createDescribeResponse } from '../mocks/salesforce.js';

it('parses query results', () => {
    const response = createQueryResponse([
        { Id: '001xx', Name: 'Test Account' }
    ]);

    const result = parseQueryResults(response);
    expect(result.records).toHaveLength(1);
});
```

### Writing Unit Tests

```javascript
// tests/unit/lib/my-util.test.js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome.js';
import { myFunction } from '../../../src/lib/my-util.js';

describe('myFunction', () => {
    beforeEach(() => {
        chromeMock._reset();
    });

    it('does something', () => {
        // Arrange
        chromeMock._setStorageData({ key: 'value' });

        // Act
        const result = myFunction();

        // Assert
        expect(result).toBe('expected');
    });

    it('handles errors', () => {
        expect(() => myFunction(null)).toThrow('Expected error');
    });
});
```

## Integration Tests

### Setup

Requires `.env.test` file in project root:

```
SF_ACCESS_TOKEN=your_session_token
SF_INSTANCE_URL=https://your-org.my.salesforce.com
```

### Configuration

Tests run in Node environment with longer timeouts:

```javascript
// vitest.config.integration.js
export default {
    test: {
        environment: 'node',
        setupFiles: ['tests/integration/setup.js'],
        include: ['tests/integration/**/*.test.js'],
        testTimeout: 30000,
        pool: 'forks',
        poolOptions: { forks: { singleFork: true } } // Sequential for rate limits
    }
}
```

### TestDataManager

Automatic cleanup of created records:

```javascript
// tests/integration/setup.js
import { TestDataManager } from './setup.js';

describe('Q-I-001: Query returns results', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    it('executes query', async () => {
        // Create test data
        const accountId = await testData.create('Account', {
            Name: testData.uniqueName('TestAccount')
        });

        // Query it
        const result = await salesforce.query(
            `SELECT Id, Name FROM Account WHERE Id = '${accountId}'`
        );

        expect(result.records).toHaveLength(1);
    });
});
```

### TestDataManager API

| Method | Purpose |
|--------|---------|
| `testData.create(sObjectType, fields)` | Create record, track for cleanup |
| `testData.cleanup()` | Delete all created records |
| `testData.uniqueName(prefix)` | Generate unique name with timestamp |

### Writing Integration Tests

```javascript
// tests/integration/feature.test.js
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('Feature Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    it('FEAT-I-001: creates and retrieves record', async () => {
        const name = uniqueName('Test');

        const id = await testData.create('Account', { Name: name });
        const result = await salesforce.getRecord('Account', id);

        expect(result.Name).toBe(name);
    });
});
```

## Frontend Tests

### Architecture

Frontend tests use a custom Playwright framework:

```
BaseTest (base-test.ts)
    ├── Page objects (lazy-loaded getters)
    ├── MockRouter (route interception)
    ├── Assertion helpers
    └── Extension loader
```

### Writing Frontend Tests

```typescript
// tests/frontend/specs/feature/my-feature.test.ts
import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/playwright-adapter';

export default class MyFeatureTest extends SftoolsTest {
    name = 'My Feature Test';
    testId = 'FEAT-F-001';

    configureMocks(): MockRouter {
        const router = new MockRouter();

        router.onQuery('SELECT Id FROM Account', {
            records: [{ Id: '001xx', Name: 'Test' }],
            totalSize: 1,
            done: true
        });

        return router;
    }

    async test(): Promise<void> {
        await this.navigateToExtension();
        await this.queryTab.setQuery('SELECT Id FROM Account');
        await this.queryTab.execute();

        const count = await this.queryTab.getResultCount();
        await this.expect(count).toBe(1);
    }
}
```

### MockRouter API

```typescript
const router = new MockRouter();

// Mock SOQL queries
router.onQuery('SELECT Id FROM Account', mockResponse);
router.onQuery(/SELECT.*FROM Contact/, mockResponse);

// Mock object describe
router.onDescribe('Account', mockDescribeResponse);

// Mock record operations
router.onRecord('Account', '001xx', mockRecord);
router.onRecordUpdate('Account', '001xx', mockUpdatedRecord);

// Mock Apex execution
router.onApex(true, mockDebugLog); // success case
router.onApex(false, mockCompileError); // failure case

// Mock REST API
router.onRest('/services/data/v62.0/limits', mockLimitsResponse);
```

### Page Objects

Each tab/page has a page object with interaction methods:

```typescript
// Available page objects
this.appPage      // Main app navigation
this.queryTab     // Query tab interactions
this.apexTab      // Apex tab interactions
this.recordPage   // Record viewer
this.schemaPage   // Schema browser
this.restApiTab   // REST API tab
this.settingsTab  // Settings tab
this.eventsTab    // Events tab
this.utilsTab     // Utils tab
```

### QueryTab Page Object

```typescript
await this.queryTab.setQuery('SELECT Id FROM Account');
await this.queryTab.execute();
await this.queryTab.getResultCount();
await this.queryTab.getColumnHeaders();
await this.queryTab.getCellValue(rowIndex, columnIndex);
await this.queryTab.clickRecordLink(rowIndex);
```

### Assertion Helpers

```typescript
// Fluent assertions
await this.expect(value).toBe(expected);
await this.expect(value).toContain(substring);
await this.expect(value).toBeGreaterThan(n);

// Wait for conditions
await this.waitFor(() => this.queryTab.hasResults());
```

### Running Specific Tests

```bash
# By file name
npm run test:frontend -- --filter=basic-query

# By test ID pattern
npm run test:frontend -- --filter=Q-F

# Slow mode for debugging
npm run test:frontend:slow -- --filter=my-test
```

## Mock Infrastructure

### Shared Mocks

The `tests/shared/mocks/` directory contains mock infrastructure shared between unit and frontend tests:

```javascript
// tests/shared/mocks/mock-data.js
export function createQueryResponse(records) {
    return {
        totalSize: records.length,
        done: true,
        records
    };
}

export function createDescribeResponse(fields) {
    return {
        name: 'Account',
        fields: fields.map(f => ({
            name: f.name,
            type: f.type || 'string',
            updateable: f.updateable !== false
        }))
    };
}
```

### Mock Scenarios

Pre-built scenarios for common test cases:

```javascript
// tests/shared/mocks/mock-scenarios.js
export const scenarios = {
    emptyQuery: {
        response: { records: [], totalSize: 0, done: true }
    },
    queryError: {
        error: { errorCode: 'MALFORMED_QUERY', message: 'Invalid SOQL' }
    },
    // ...
};
```

## Best Practices

### Unit Tests

1. **Reset mocks in beforeEach** - Always call `chromeMock._reset()`
2. **Test one thing per test** - Keep tests focused and atomic
3. **Use descriptive names** - `it('returns empty array when no connections')`
4. **Test edge cases** - null, undefined, empty arrays, errors

### Integration Tests

1. **Use TestDataManager** - Always cleanup created records
2. **Use unique names** - Prevent collisions with `uniqueName()`
3. **Include test IDs** - Follow the `X-I-xxx` convention
4. **Handle rate limits** - Tests run sequentially for this reason

### Frontend Tests

1. **Extend SftoolsTest** - Use the base class for consistency
2. **Configure mocks in configureMocks()** - Return a MockRouter
3. **Use page objects** - Don't interact with DOM directly
4. **Use assertion helpers** - `await this.expect(x).toBe(y)`
5. **Add test IDs** - Include `testId` property for traceability

## Debugging Tests

### Unit Tests

```bash
# Run with verbose output
npm run test:unit -- --reporter=verbose

# Debug specific test
npm run test:unit -- --testNamePattern="my test name"
```

### Frontend Tests

```bash
# Run in slow mode (visible browser, human timing)
npm run test:frontend:slow

# Run with headed browser
HEADED=true npm run test:frontend

# Debug specific test
npm run test:frontend -- --filter=my-test
```

### Common Issues

| Problem | Solution |
|---------|----------|
| Chrome mock not working | Ensure `chromeMock._reset()` in beforeEach |
| Integration test fails | Check `.env.test` credentials are valid |
| Frontend test timeout | Use `--slow` mode to observe behavior |
| Mock not matching | Check exact URL/query pattern in MockRouter |

## Adding New Tests

### For new src/lib/ function

1. Create `tests/unit/lib/my-function.test.js`
2. Import the function and mocks
3. Write tests covering happy path, edge cases, errors

### For new component feature

1. Create `tests/frontend/specs/feature/my-feature.test.ts`
2. Extend `SftoolsTest`
3. Configure mocks in `configureMocks()`
4. Implement `test()` using page objects

### For new API integration

1. Create `tests/integration/feature.test.js`
2. Use `TestDataManager` for cleanup
3. Include test ID in describe block
