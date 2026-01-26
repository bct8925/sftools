# Testing Framework

sftools uses three testing frameworks:

- **Frontend Tests** (`tests/frontend/`) - Playwright-based browser tests with mocked API responses
- **Integration Tests** (`tests/integration/`) - Vitest-based tests with real Salesforce API calls (no browser)
- **Unit Tests** (`tests/unit/`) - Vitest-based unit tests with mocked dependencies

**Documentation:**
- This file (`docs/TESTING.md`) - Detailed framework documentation and API reference
- `docs/TEST_SCENARIOS.md` - Comprehensive test scenarios organized by feature with test IDs

## Quick Commands

```bash
# Unit tests (Vitest - mocked dependencies)
npm run test:unit                        # Run all unit tests
npm run test:unit -- auth.test.js        # Run specific test file
npm run test:unit:watch                  # Watch mode
npm run test:unit:coverage               # With coverage report

# Integration tests (Vitest - real Salesforce API)
npm run test:integration                 # Run all integration tests
npm run test:integration -- query        # Run tests matching "query"
npm run test:integration:watch           # Watch mode

# Frontend tests (Playwright - requires visible browser)
npm run test:frontend                    # Run all frontend tests
npm run test:frontend -- --filter=query  # Run tests matching "query"
npm run test:frontend:slow               # With human-like timing (for visual debugging)
```

---

# Frontend Tests (Playwright)

The frontend test framework uses **mocked API responses** via `MockRouter` for fast, reliable UI testing. Tests run in an actual Chrome browser with the extension loaded.

## Design Principles

1. **Mocked API Responses** - Uses `MockRouter` to intercept Playwright routes and return predefined responses. No real Salesforce API calls.
2. **UI/UX Focus** - Tests validate user interactions, rendering, and display logic without external dependencies.
3. **Fast Execution** - Mocks eliminate network latency and Salesforce rate limits.
4. **Deterministic** - Consistent test data ensures repeatable results.

## Quick Start

### 1. Build the Extension

```bash
npm run build
```

### 2. Run Tests

```bash
npm run test:frontend          # Run all frontend tests
```

> **Note:** Frontend tests always run with a visible browser window. Chrome extensions cannot run in headless mode.

### Test Modes

The framework supports two speed modes:

**Fast Mode (default)** - Tests run as fast as possible with no artificial delays. Best for CI and quick iteration.

```bash
npm run test:frontend
```

**Slow Mode** - Adds human-like delays (~1 second) before clicks, typing, and navigation. Use this to visually verify that tests are clicking the correct elements and navigating properly.

```bash
npm run test:frontend:slow
```

Slow mode timing:
- 800ms before each click
- 500ms after each click
- 500ms before typing
- 1000ms after navigation
- 1200ms after page load

### Running Specific Tests

Each test framework supports filtering to run specific tests:

**Unit Tests (Vitest)**
```bash
npm run test:unit -- auth.test.js           # Run single file
npm run test:unit -- lib/                   # Run all tests in lib/
npm run test:unit -- -t "returns empty"     # Run tests matching name pattern
```

**Integration Tests (Vitest)**
```bash
npm run test:integration -- query.test.js   # Run single file
npm run test:integration -- -t "Q-I-001"    # Run test by ID
```

**Frontend Tests (Custom Runner)**
```bash
npm run test:frontend -- --filter=basic-query  # Run single test file
npm run test:frontend -- --filter=apex         # Run all apex tests
npm run test:frontend -- --filter=apex/errors  # Run tests matching path
```

The frontend `--filter` matches against the full file path, so `--filter=query` matches all files containing "query" in their path.

## Directory Structure

```
tests/frontend/
├── framework/
│   ├── types.ts              # TypeScript interfaces
│   ├── assertions.ts         # Custom assertion helpers
│   ├── base-test.ts          # SftoolsTest base class
│   └── runner.ts             # Test runner with setup/teardown guarantee
├── services/
│   └── extension-loader.ts   # Chrome extension loading + connection injection
├── pages/
│   ├── query-tab.page.ts     # Query tab page object
│   ├── apex-tab.page.ts      # Apex tab page object
│   ├── record.page.ts        # Record viewer page object
│   ├── schema.page.ts        # Schema browser page object
│   ├── rest-api-tab.page.ts  # REST API tab page object
│   ├── settings-tab.page.ts  # Settings tab page object
│   └── utils-tab.page.ts     # Utils tab page object
├── helpers/
│   └── monaco-helpers.ts     # Monaco Editor interaction utilities
├── specs/                    # Test files organized by feature
│   ├── query/                # 11 test files
│   ├── apex/                 # 5 test files
│   ├── record/               # 4 test files
│   ├── schema/               # 1 test file
│   ├── rest-api/             # 3 test files
│   └── settings/             # 1 test file
└── run-tests.ts              # CLI entry point
```

## Writing Tests

### Basic Test Structure

Each test file exports a class that extends `SftoolsTest`:

```typescript
import { SftoolsTest } from '../../framework/base-test';
import { MockRouter } from '../../../shared/mocks/index.js';

export default class MyFeatureTest extends SftoolsTest {
  // Configure mocks - called automatically before test()
  configureMocks() {
    const router = new MockRouter();

    // Mock API responses
    router.onQuery(
      /\/query/,
      [{ Id: '001MOCK123', Name: 'Test Account' }],
      [
        { columnName: 'Id', displayName: 'Id', aggregate: false },
        { columnName: 'Name', displayName: 'Name', aggregate: false }
      ]
    );

    return router;
  }

  // The actual test logic
  async test(): Promise<void> {
    await this.navigateToExtension();
    await this.queryTab.navigateTo();

    // Execute query (will use mocked response)
    await this.queryTab.executeQuery('SELECT Id, Name FROM Account LIMIT 10');

    const count = await this.queryTab.getResultsCount();
    await this.expect(count).toBe(1);
  }
}
```

### Available Properties in Tests

The base class provides:

```typescript
// Playwright objects
this.page        // Playwright Page instance
this.context     // BrowserContext instance
this.extensionId // Chrome extension ID

// Page objects (lazy-loaded)
this.queryTab      // QueryTabPage
this.apexTab       // ApexTabPage
this.recordPage    // RecordPage
this.schemaPage    // SchemaPage
this.restApiTab    // RestApiTabPage
this.settingsTab   // SettingsTabPage
this.utilsTab      // UtilsTabPage
```

### Navigation Helpers

```typescript
// Navigate to the main extension page
await this.navigateToExtension();

// Navigate to the record viewer for a specific record
await this.navigateToRecord('Account', '001xx000003DGbX');
```

### Assertions

The `expect()` helper provides fluent assertions:

```typescript
// Equality
await this.expect(value).toBe(expected);
await this.expect(value).toEqual(expected);  // Deep equality

// Truthiness
await this.expect(value).toBeTruthy();
await this.expect(value).toBeFalsy();

// String matching
await this.expect(text).toContain('substring');

// Negation
await this.expect(value).not.toBe(unexpected);
await this.expect(text).not.toContain('bad');
```

All assertions work with both values and promises:

```typescript
// Both work:
await this.expect(someValue).toBe(1);
await this.expect(someAsyncMethod()).toBe(1);
```

## MockRouter API

Frontend tests use `MockRouter` to intercept Playwright routes and return mocked responses:

```typescript
import { MockRouter } from '../../../shared/mocks/index.js';

configureMocks() {
  const router = new MockRouter();

  // Mock SOQL query
  router.onQuery(/\/query/, records, columnMetadata);

  // Mock object describe
  router.onDescribe('Account', fields);

  // Mock record GET
  router.onRecord('Account', '001xxx', recordData);

  // Mock record PATCH
  router.onRecordUpdate('Account', '001xxx', updatedData);

  // Mock Apex execution
  router.onApex({ compiled: true, success: true }, logBody);

  // Mock REST API request
  router.onRest('GET', /\/sobjects/, responseData);

  // Mock generic fetch (catch-all)
  router.onFetch(/pattern/, responseData, { status: 200 });

  return router;
}
```

See `tests/shared/mocks/` for available mock factories and scenarios.

## Page Objects

### QueryTabPage

```typescript
// Navigation
await this.queryTab.navigateTo();

// Execute queries
await this.queryTab.executeQuery('SELECT Id FROM Account LIMIT 10');
await this.queryTab.executeWithShortcut();  // Ctrl/Cmd+Enter

// Get results
const count = await this.queryTab.getResultsCount();
const headers = await this.queryTab.getResultsHeaders();
const rowCount = await this.queryTab.getResultsRowCount();

// Status
const status = await this.queryTab.getStatus();
// Returns: { text: string, type: 'success' | 'error' | 'loading' | 'default' }

// Error handling
const errorMsg = await this.queryTab.getErrorMessage();

// Subqueries
const hasSubquery = await this.queryTab.hasSubqueryResults();
await this.queryTab.expandSubquery(0);
const subqueryText = await this.queryTab.getSubqueryText(0);

// Filtering
await this.queryTab.filterResults('searchTerm');
await this.queryTab.clearFilter();

// Tab management
const tabs = await this.queryTab.getOpenTabs();
await this.queryTab.closeTab('Query 1');

// Settings
await this.queryTab.setToolingMode(true);
```

### ApexTabPage

```typescript
// Navigation
await this.apexTab.navigateTo();

// Code editing
await this.apexTab.setCode('System.debug("Hello");');
const code = await this.apexTab.getCode();

// Execution
await this.apexTab.execute();
await this.apexTab.executeWithShortcut();

// Results
const status = await this.apexTab.getStatus();
// Returns: { text: string, success: boolean }

const logContent = await this.apexTab.getLogContent();

// Error markers
const hasErrors = await this.apexTab.hasCompileErrors();
const markers = await this.apexTab.getErrorMarkers();

// Log filtering
await this.apexTab.filterLog('DEBUG');
await this.apexTab.clearLogFilter();
```

### RecordPage

```typescript
// Wait for record to load
await this.recordPage.waitForLoad();

// Get record info
const objectName = await this.recordPage.getObjectName();
const recordId = await this.recordPage.getRecordId();

// Field operations
const value = await this.recordPage.getFieldValue('Name');
await this.recordPage.setFieldValue('Name', 'New Value');
const isModified = await this.recordPage.isFieldModified('Name');
const isEditable = await this.recordPage.isFieldEditable('Name');
const fieldNames = await this.recordPage.getFieldNames();

// Save/Refresh
await this.recordPage.save();
await this.recordPage.refresh();

// Status
const status = await this.recordPage.getStatus();
const saveEnabled = await this.recordPage.isSaveEnabled();
const modifiedCount = await this.recordPage.getModifiedFieldCount();
```

### SchemaPage

```typescript
// Wait for objects to load
await this.schemaPage.waitForLoad();

// Object operations
const count = await this.schemaPage.getObjectCount();
await this.schemaPage.filterObjects('Account');
const objects = await this.schemaPage.getVisibleObjectNames();
await this.schemaPage.selectObject('Account');

// Selected object info
const label = await this.schemaPage.getSelectedObjectLabel();
const apiName = await this.schemaPage.getSelectedObjectApiName();

// Field operations
await this.schemaPage.filterFields('Name');
const fields = await this.schemaPage.getVisibleFieldNames();
const details = await this.schemaPage.getFieldDetails('Name');
// Returns: { label: string, type: string } | null

// Formula fields
const isFormula = await this.schemaPage.isFormulaField('Custom_Formula__c');
await this.schemaPage.openFormulaEditor('Custom_Formula__c');
const formula = await this.schemaPage.getFormulaContent();
await this.schemaPage.setFormulaContent('NEW_FORMULA');
await this.schemaPage.saveFormula();
await this.schemaPage.cancelFormulaEdit();

// Panel operations
await this.schemaPage.closeFieldsPanel();
await this.schemaPage.refreshObjects();
```

## Monaco Editor Helpers

For interacting with Monaco editors directly:

```typescript
const monaco = new MonacoHelpers(page, 'query-tab .query-editor');

// Get/set content
const value = await monaco.getValue();
await monaco.setValue('new content');

// Execute shortcut (Ctrl/Cmd+Enter)
await monaco.pressExecuteShortcut();

// Error markers
const markers = await monaco.getMarkers();
```

## Extension Loading

The test framework handles extension loading automatically:

1. Launches Chrome with `--load-extension` pointing to the project root
2. Waits for the service worker to initialize
3. Extracts the extension ID from the service worker URL
4. Injects a test connection into `chrome.storage.local`
5. Navigates to the extension and waits for connection to be active

## Known Gotchas

### Status Badge Selectors

The extension's `updateStatusBadge()` function replaces the element's entire `className`:

```javascript
element.className = 'status-badge';  // Removes original class!
element.classList.add(`status-${type}`);
```

So if an element starts with `class="status-badge my-status"`, after an update it becomes `class="status-badge status-success"`. Page objects use stable selectors like `.query-footer .status-badge` instead of the original class.

### Hamburger Menu Navigation

The app uses a hamburger menu for navigation. Page object `navigateTo()` methods must:
1. Check if already on the target tab
2. Open the hamburger menu
3. Click the nav item
4. Wait for the tab to become active

### Async Assertions

Always `await` assertions:

```typescript
// Correct
await this.expect(value).toBe(1);

// Wrong - assertion won't run properly
this.expect(value).toBe(1);
```

## Debugging Tests

### Add Console Logging

```typescript
async test(): Promise<void> {
  console.log('Starting test...');
  await this.navigateToExtension();

  console.log('Executing query...');
  await this.queryTab.executeQuery('SELECT Id FROM Account');

  const status = await this.queryTab.getStatus();
  console.log('Status:', status);
}
```

### Automatic Failure Artifacts

When a test fails, the runner automatically captures debugging artifacts:

| Artifact | Location | Content |
|----------|----------|---------|
| Screenshot | `/tmp/test-failure-{TestName}.png` | Visual state at failure |
| HTML dump | `/tmp/test-failure-{TestName}.html` | Full page DOM |

Console output on failure:
```
  Failed: <error message>
  Screenshot saved: /tmp/test-failure-MyTest.png
  Current URL: chrome-extension://...
  HTML saved: /tmp/test-failure-MyTest.html
```

Use these artifacts to debug failures:
- **Screenshot**: See what the UI looked like when the test failed
- **HTML dump**: Inspect the DOM structure, find missing elements, check attribute values

For additional screenshots during test execution:
```typescript
await this.page.screenshot({ path: 'debug-screenshot.png' });
```

## Adding New Tests

1. Create a new file in the appropriate `tests/frontend/specs/` subdirectory
2. Export a default class extending `SftoolsTest`
3. Implement `setup()`, `teardown()`, and `test()` methods
4. Run with `npm run test:frontend -- --filter=your-test-name`

## Adding New Page Objects

1. Create a new file in `tests/frontend/pages/`
2. Export a class with the page's element locators and interaction methods
3. Add a getter in `tests/frontend/framework/base-test.ts`:

```typescript
// In base-test.ts
private _myPage?: MyPage;

get myPage(): MyPage {
  if (!this._myPage) {
    this._myPage = new MyPage(this.page);
  }
  return this._myPage;
}
```

---

# Integration Tests (Vitest)

Integration tests use Vitest with real Salesforce API calls to verify API behavior that the UI components rely on. Unlike frontend tests, these run in Node.js without browser automation, making them faster and more focused on API contracts.

## Design Principles

1. **Real Salesforce API Calls** - Tests hit actual Salesforce endpoints (REST and Tooling API)
2. **No Browser** - Pure API testing without Playwright overhead
3. **Automatic Cleanup** - Test data is tracked and cleaned up via `TestDataManager`
4. **Sequential Execution** - Single-threaded to avoid Salesforce API rate limits
5. **Test IDs** - Each test has an ID (e.g., Q-I-001, A-I-007) for traceability

## Quick Start

### 1. Create Environment File

Use the same `.env.test` file as frontend tests:

```
SF_ACCESS_TOKEN=00D...!...
SF_INSTANCE_URL=https://your-org.my.salesforce.com
```

### 2. Run Tests

```bash
npm run test:integration          # Run all integration tests
npm run test:integration:watch    # Watch mode
```

## Directory Structure

```
tests/integration/
├── setup.js              # Salesforce client, TestDataManager, helpers
├── apex.test.js          # Apex Tab tests (A-I-001 through A-I-007)
├── query.test.js         # Query Tab tests (Q-I-001 through Q-I-009)
├── utils.test.js         # Utils Tab tests
├── rest-api.test.js      # REST API Tab tests
├── events.test.js        # Events Tab tests
├── settings.test.js      # Settings Tab tests
├── record-viewer.test.js # Record Viewer tests
└── schema-browser.test.js # Schema Browser tests
```

## Writing Tests

### Basic Test Structure

Tests use standard Vitest patterns with the shared `salesforce` client:

```javascript
import { describe, it, expect, afterEach } from 'vitest';
import { salesforce, TestDataManager, uniqueName } from './setup.js';

describe('My Feature Integration', () => {
    const testData = new TestDataManager();

    afterEach(async () => {
        await testData.cleanup();
    });

    it('creates and queries a record', async () => {
        // Create test data (tracked for cleanup)
        const accountId = await testData.create('Account', {
            Name: uniqueName('TestAccount')
        });

        // Query it back
        const result = await salesforce.query(
            `SELECT Id, Name FROM Account WHERE Id = '${accountId}'`
        );

        expect(result).toHaveLength(1);
        expect(result[0].Id).toBe(accountId);
    });
});
```

### Salesforce Client

The `salesforce` client provides methods for API operations:

```javascript
// REST API
await salesforce.query('SELECT Id FROM Account');
await salesforce.createRecord('Account', { Name: 'Test' });
await salesforce.getRecord('Account', accountId);
await salesforce.updateRecord('Account', accountId, { Name: 'Updated' });
await salesforce.deleteRecord('Account', accountId);
await salesforce.describeObject('Account');
await salesforce.describeGlobal();
await salesforce.getCurrentUser();

// Tooling API
await salesforce.toolingQuery('SELECT Id FROM ApexClass');
await salesforce.executeAnonymousApex('System.debug("Hello");');

// Generic REST request
await salesforce.request('GET', '/services/data/v62.0/limits');

// Generic Tooling request
await salesforce.toolingRequest('GET', '/sobjects');

// REST API Tab-style request (returns full response object)
const response = await salesforce.restRequest('/services/data/v62.0/sobjects');
// response: { status, statusText, ok, headers, body }
```

### Test Data Management

Use `TestDataManager` to track records for automatic cleanup:

```javascript
const testData = new TestDataManager();

// Create and track
const accountId = await testData.create('Account', { Name: 'Test' });

// Manual tracking
const contactId = await salesforce.createRecord('Contact', { LastName: 'Smith' });
testData.track('Contact', contactId);

// Cleanup (in afterEach)
await testData.cleanup();
```

### Helper Utilities

```javascript
// Generate unique test names
const name = uniqueName('TestAccount');
// Returns: "TestAccount_1234567890_abc123"

// Wait for a condition
await waitFor(
    async () => {
        const logs = await salesforce.toolingQuery('SELECT Id FROM ApexLog');
        return logs.length > 0;
    },
    { timeout: 10000, interval: 1000, message: 'Log not created' }
);
```

## Test ID Conventions

Each test has an ID for traceability:

| Prefix | Feature | Example |
|--------|---------|---------|
| Q-I-xxx | Query Tab | Q-I-001: Query with no results |
| A-I-xxx | Apex Tab | A-I-001: Execute valid Apex |
| R-I-xxx | REST API Tab | R-I-001: GET request |
| E-I-xxx | Events Tab | E-I-001: Subscribe to event |
| S-I-xxx | Settings Tab | S-I-001: Save connection |
| RV-I-xxx | Record Viewer | RV-I-001: Load record |
| SB-I-xxx | Schema Browser | SB-I-001: Load objects |
| U-I-xxx | Utils Tab | U-I-001: Enable trace flag |

Test IDs are included in `describe()` blocks for easy filtering and reference.

## Configuration

**Config file:** `vitest.config.integration.js`

Key settings:
- **Environment:** Node.js
- **Setup:** `tests/integration/setup.js`
- **Timeout:** 30s for tests, 10s for hooks
- **Execution:** Single-threaded sequential (avoid rate limits)

## Test Org Requirements

The test org should have:

1. **API Access** - API enabled for the user
2. **Standard Objects** - Account, Contact available
3. **Permissions** - User can create/delete records
4. **Apex Execution** - User can execute anonymous Apex
5. **Tooling API** - Access to Tooling API objects

A Developer Edition org or Scratch org works well. Avoid production orgs.

## Debugging Tests

### Filter to Specific Test

```bash
npm run test:integration -- query.test.js
npm run test:integration -- -t "Q-I-001"
```

### Add Console Logging

```javascript
it('creates a record', async () => {
    console.log('Creating test account...');
    const id = await testData.create('Account', { Name: 'Test' });
    console.log('Created:', id);
    // ...
});
```

### Check API Responses

```javascript
const response = await salesforce.request('GET', '/sobjects/Account/describe');
console.log(JSON.stringify(response, null, 2));
```

---

# Unit Tests (Vitest)

Unit tests use Vitest with jsdom to test `src/lib/` modules in isolation, with Chrome extension APIs and Salesforce responses mocked.

## Directory Structure

```
tests/unit/
├── mocks/
│   ├── chrome.js             # Chrome extension API mock
│   └── salesforce.js         # Salesforce API response factories
├── setup.js                  # Global test setup
├── lib/                      # 21 test files for src/lib/* utilities
│   ├── apex-utils.test.js
│   ├── app-utils.test.js
│   ├── auth.test.js
│   ├── background-utils.test.js
│   ├── cors-detection.test.js
│   ├── events-utils.test.js
│   ├── fetch.test.js
│   ├── history-manager.test.js
│   ├── icons.test.js
│   ├── oauth-credentials.test.js
│   ├── query-utils.test.js
│   ├── record-utils.test.js
│   ├── rest-api-utils.test.js
│   ├── salesforce.test.js
│   ├── salesforce-request.test.js
│   ├── schema-utils.test.js
│   ├── settings-utils.test.js
│   ├── soql-autocomplete.test.js
│   ├── text-utils.test.js
│   ├── theme.test.js
│   └── ui-helpers.test.js
└── proxy/                    # 4 test files for proxy utilities
    ├── http-server.test.js
    ├── payload-store.test.js
    ├── router.test.js
    └── subscription-manager.test.js
```

## Running Unit Tests

```bash
npm run test:unit              # Run once
npm run test:unit:watch        # Watch mode
npm run test:unit:coverage     # With coverage report
```

## Writing Unit Tests

Unit tests use standard Vitest patterns:

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockConnection } from '../../mocks/salesforce.js';
import { getAccessToken, setActiveConnection } from '../../../src/lib/auth.js';

describe('auth', () => {
    beforeEach(() => {
        setActiveConnection(null);
    });

    it('returns empty values when no connection is set', () => {
        expect(getAccessToken()).toBe('');
    });

    it('returns connection values after setActiveConnection', () => {
        const connection = createMockConnection({
            accessToken: 'my-token',
        });
        setActiveConnection(connection);
        expect(getAccessToken()).toBe('my-token');
    });
});
```

## Mocks

### Chrome Mock (`tests/unit/mocks/chrome.js`)

Simulates Chrome extension APIs:
- `chrome.storage.local` - get, set, remove, clear
- `chrome.storage.onChanged` - listeners
- `chrome.runtime.sendMessage` - mocked with vi.fn()
- `chrome.runtime.getManifest` - returns test manifest

Test helpers:
- `chromeMock._reset()` - Reset all state
- `chromeMock._setStorageData(data)` - Pre-populate storage
- `chromeMock._triggerStorageChange(changes)` - Simulate storage events

### Salesforce Mock (`tests/unit/mocks/salesforce.js`)

Factory functions for Salesforce API responses:
- `createMockResponse(data, options)` - Generic response
- `createErrorResponse(message, status)` - Error response
- `createMockConnection(overrides)` - Connection object

Salesforce-specific factories via `createSalesforceMocks()`:
- `queryResponse(records)` - SOQL query result
- `objectDescribe(name, fields)` - Object describe
- `globalDescribe(sobjects)` - Global describe
- `recordResponse(record)` - Single record
- `apexExecutionResponse(compiled, success)` - Apex execution
