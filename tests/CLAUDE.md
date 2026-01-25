# Testing - sftools

> **Parent context**: This extends [../CLAUDE.md](../CLAUDE.md)

## Overview

| Aspect | Details |
|--------|---------|
| **Unit Tests** | Vitest with jsdom, Chrome API mocks, TypeScript |
| **Integration Tests** | Vitest with real Salesforce API calls |
| **Frontend Tests** | Playwright headless with mocked Chrome & Salesforce APIs |

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

# Frontend tests (headless by default)
npm run test:frontend                    # Run all (headless)
npm run test:frontend -- --filter=query  # Filter by name
npm run test:frontend:slow               # With human timing
npm run test:frontend:extension          # Run with real Chrome extension
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
│   │   ├── query-utils.test.ts
│   │   └── ...
│   └── proxy/                # Tests for sftools-proxy/src/*
│       ├── router.test.ts
│       └── ...
│
├── integration/              # Vitest integration tests (node)
│   ├── setup.ts              # Salesforce client, TestDataManager
│   ├── apex.test.ts          # A-I-001 through A-I-007
│   ├── query.test.ts         # Q-I-001 through Q-I-009
│   └── ...
│
├── frontend/                 # Playwright browser tests
│   ├── framework/
│   │   ├── base-test.ts      # SftoolsTest base class
│   │   ├── runner.ts         # Custom test runner (headless/extension modes)
│   │   ├── assertions.ts     # Fluent assertion API
│   │   └── types.ts          # TypeScript interfaces
│   ├── services/
│   │   ├── headless-loader.ts    # Headless mode: Vite + Chrome mocks
│   │   ├── extension-loader.ts   # Extension mode: real Chrome extension
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
        ├── index.ts
        ├── mock-data.ts           # Response factories
        ├── mock-scenarios.ts      # Pre-built scenarios
        ├── playwright-adapter.ts  # MockRouter for Playwright
        └── chrome-browser-mock.ts # Browser-injectable Chrome API mock
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
// tests/unit/mocks/chrome.ts
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

### Salesforce Mock

Factory functions for API responses:

```typescript
// tests/unit/mocks/salesforce.ts
import { createQueryResponse, createDescribeResponse } from '../mocks/salesforce';

it('parses query results', () => {
  const response = createQueryResponse([
    { Id: '001xx', Name: 'Test Account' }
  ]);

  const result = parseQueryResults(response);
  expect(result.records).toHaveLength(1);
});
```

### Writing Unit Tests

```typescript
// tests/unit/lib/my-util.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '../mocks/chrome';
import { myFunction } from '../../../src/lib/my-util';

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

### TypeScript Test Patterns

```typescript
// Type-safe mocks
import type { SalesforceConnection } from '../../../src/types/salesforce';

const mockConnection: SalesforceConnection = {
  id: 'test-id',
  label: 'Test Org',
  instanceUrl: 'https://test.salesforce.com',
  accessToken: 'mock-token',
  refreshToken: null,
  clientId: null,
};

// Type-safe expects
it('returns typed result', () => {
  const result = myFunction();
  expect(result satisfies MyType).toBeTruthy();
});

// Mocking modules
vi.mock('../../../src/lib/fetch', () => ({
  smartFetch: vi.fn().mockResolvedValue({ ok: true }),
}));
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

```typescript
// vitest.config.integration.ts
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/integration/setup.ts'],
    include: ['tests/integration/**/*.test.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } } // Sequential for rate limits
  }
});
```

### TestDataManager

Automatic cleanup of created records:

```typescript
// tests/integration/setup.ts
import { TestDataManager } from './setup';

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

```typescript
// tests/integration/feature.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup';

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

Frontend tests run in **headless mode** by default, using a Vite dev server with mocked Chrome APIs. This enables fast, CI-friendly execution without requiring a real Chrome extension installation.

```
TestRunner (runner.ts)
    ├── Headless Mode (default)
    │   ├── Vite dev server (auto-started)
    │   ├── Chrome API mocks (injected via addInitScript)
    │   └── No .env.test required (uses mock credentials)
    │
    └── Extension Mode (--extension flag)
        ├── Real Chrome extension loaded
        ├── Service worker for API calls
        └── Requires valid .env.test credentials

BaseTest (base-test.ts)
    ├── Page objects (lazy-loaded getters)
    ├── MockRouter (route interception)
    └── Assertion helpers
```

### Modes

| Mode | Command | Use Case |
|------|---------|----------|
| **Headless** | `npm run test:frontend` | CI, fast iteration, default |
| **Extension** | `npm run test:frontend:extension` | Extension-specific behavior |
| **Slow** | `npm run test:frontend:slow` | Debugging (visible browser) |

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

```typescript
// tests/shared/mocks/mock-data.ts
export function createQueryResponse(records: SObject[]) {
  return {
    totalSize: records.length,
    done: true,
    records
  };
}

export function createDescribeResponse(fields: FieldInfo[]) {
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

```typescript
// tests/shared/mocks/mock-scenarios.ts
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

## Testing React Components

### Component Test Setup

```typescript
// tests/unit/components/example.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExampleComponent } from '../../../src/components/example/ExampleComponent';

// Mock contexts
vi.mock('../../../src/contexts', () => ({
  useConnection: () => ({
    activeConnection: { id: '1', instanceUrl: 'https://test.sf.com' },
    isAuthenticated: true,
  }),
  useTheme: () => ({
    effectiveTheme: 'light',
  }),
}));

describe('ExampleComponent', () => {
  it('renders correctly', () => {
    render(<ExampleComponent />);
    expect(screen.getByText('Execute')).toBeInTheDocument();
  });

  it('handles click', async () => {
    render(<ExampleComponent />);
    fireEvent.click(screen.getByText('Execute'));
    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });
});
```

### Testing Hooks

```typescript
// tests/unit/hooks/use-example.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExampleState } from '../../../src/components/query/useQueryState';

describe('useExampleState', () => {
  it('adds tab correctly', () => {
    const { result } = renderHook(() => useExampleState());

    act(() => {
      result.current.addTab('SELECT Id FROM Account');
    });

    expect(result.current.state.tabs).toHaveLength(1);
  });
});
```

### Testing with Contexts

```typescript
// Wrapper for tests needing context
import { ConnectionProvider } from '../../../src/contexts/ConnectionContext';

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <ConnectionProvider>
    {children}
  </ConnectionProvider>
);

describe('ComponentWithContext', () => {
  it('uses connection context', () => {
    render(<MyComponent />, { wrapper: TestWrapper });
    // assertions...
  });
});
```

## Best Practices

### Unit Tests

1. **Reset mocks in beforeEach** - Always call `chromeMock._reset()`
2. **Test one thing per test** - Keep tests focused and atomic
3. **Use descriptive names** - `it('returns empty array when no connections')`
4. **Test edge cases** - null, undefined, empty arrays, errors
5. **Type your mocks** - Use TypeScript interfaces for mock data

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

### React Component Tests

1. **Mock contexts** - Use vi.mock for context hooks
2. **Use testing-library** - Query by role/text, not implementation
3. **Test user behavior** - Focus on what users see and do
4. **Avoid testing implementation** - Don't test internal state

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

# Run specific test
npm run test:frontend -- --filter=my-test

# Run in extension mode (real Chrome extension)
npm run test:frontend:extension

# Enable debug output
DEBUG=true npm run test:frontend
```

### Common Issues

| Problem | Solution |
|---------|----------|
| Chrome mock not working | Ensure `chromeMock._reset()` in beforeEach |
| Integration test fails | Check `.env.test` credentials are valid |
| Frontend test timeout | Use `--slow` mode to observe behavior |
| Mock not matching | Check exact URL/query pattern in MockRouter |
| TypeScript errors in tests | Check tsconfig includes test files |
| Vite server port conflict | Set `VITE_PORT=5174` env var |
| Extension mode test fails | Ensure `.env.test` has valid credentials |

## Adding New Tests

### For new src/lib/ function

1. Create `tests/unit/lib/my-function.test.ts`
2. Import the function and mocks
3. Write tests covering happy path, edge cases, errors

### For new React component

1. Create `tests/unit/components/my-component.test.tsx`
2. Mock contexts as needed
3. Use testing-library to render and interact

### For new component feature (E2E)

1. Create `tests/frontend/specs/feature/my-feature.test.ts`
2. Extend `SftoolsTest`
3. Configure mocks in `configureMocks()`
4. Implement `test()` using page objects

### For new API integration

1. Create `tests/integration/feature.test.ts`
2. Use `TestDataManager` for cleanup
3. Include test ID in describe block
