# Testing Framework

sftools uses three testing frameworks:

- **Frontend Tests** (`tests/frontend/`) - Playwright-based browser tests with real Salesforce API calls
- **Integration Tests** (`tests/integration/`) - Vitest-based tests with real Salesforce API calls (no browser)
- **Unit Tests** (`tests/unit/`) - Vitest-based unit tests with mocked dependencies

## Quick Commands

```bash
# Frontend tests (Playwright - requires visible browser)
npm test                       # Run all frontend tests
npm test -- --filter=query     # Run tests matching "query"
npm run test:slow              # Run with human-like timing (for visual debugging)
npm run test:slow -- --filter=query  # Combine slow mode with filter

# Integration tests (Vitest - real Salesforce API calls)
npm run test:integration       # Run all integration tests
npm run test:integration:watch # Run in watch mode

# Unit tests (Vitest - mocked dependencies)
npm run test:unit              # Run all unit tests
npm run test:unit:watch        # Run in watch mode
npm run test:unit:coverage     # Run with coverage report
```

---

# Frontend Tests (Playwright)

The frontend test framework makes **real Salesforce API calls** against a test org. Tests run in an actual Chrome browser with the extension loaded.

## Design Principles

1. **Real Salesforce Calls** - No API mocking. Tests hit actual Salesforce endpoints.
2. **Pre-authenticated** - Access token and instance URL provided via environment variables (no OAuth flow testing).
3. **Explicit Lifecycle** - Each test class has `setup()` and `teardown()` methods for reliable test data management.
4. **Guaranteed Cleanup** - Test data is always cleaned up, even on test failure.

## Quick Start

### 1. Create Environment File

Create `.env.test` in the project root:

```
SF_ACCESS_TOKEN=00D...!...
SF_INSTANCE_URL=https://your-org.my.salesforce.com
```

To get an access token, you can:
- Use the Salesforce CLI: `sf org display --target-org your-org --json` (look for `accessToken`)
- Copy from an existing sftools connection in Chrome DevTools (`chrome.storage.local.get('connections')`)

### 2. Build the Extension

```bash
npm run build
```

### 3. Run Tests

```bash
npm test                       # Run all frontend tests
npm test -- --filter=query     # Run tests matching "query"
```

> **Note:** Frontend tests always run with a visible browser window. Chrome extensions cannot run in headless mode.

### Test Modes

The framework supports two speed modes:

**Fast Mode (default)** - Tests run as fast as possible with no artificial delays. Best for CI and quick iteration.

```bash
npm test
```

**Slow Mode** - Adds human-like delays (~1 second) before clicks, typing, and navigation. Use this to visually verify that tests are clicking the correct elements and navigating properly.

```bash
npm run test:slow
npm run test:slow -- --filter=query-errors
```

Slow mode timing:
- 800ms before each click
- 500ms after each click
- 500ms before typing
- 1000ms after navigation
- 1200ms after page load

## Directory Structure

```
tests/frontend/
├── framework/
│   ├── types.ts              # TypeScript interfaces
│   ├── assertions.ts         # Custom assertion helpers
│   ├── base-test.ts          # SftoolsTest base class
│   └── runner.ts             # Test runner with setup/teardown guarantee
├── services/
│   ├── salesforce-client.ts  # Direct Salesforce API client for test data
│   └── extension-loader.ts   # Chrome extension loading + connection injection
├── pages/
│   ├── query-tab.page.ts     # Query tab page object
│   ├── apex-tab.page.ts      # Apex tab page object
│   ├── record.page.ts        # Record viewer page object
│   └── schema.page.ts        # Schema browser page object
├── helpers/
│   └── monaco-helpers.ts     # Monaco Editor interaction utilities
├── specs/
│   ├── query/
│   │   ├── basic-query.test.ts
│   │   └── query-errors.test.ts
│   ├── apex/
│   │   └── execute-apex.test.ts
│   ├── record/
│   │   ├── view-record.test.ts
│   │   └── edit-record.test.ts
│   └── schema/
│       └── browse-schema.test.ts
└── run-tests.ts              # CLI entry point
```

## Writing Tests

### Basic Test Structure

Each test file exports a class that extends `SftoolsTest`:

```typescript
import { SftoolsTest } from '../../framework/base-test';

export default class MyFeatureTest extends SftoolsTest {
  // Instance variables for test data
  private testAccountId: string = '';

  // Called BEFORE test() - create test data here
  async setup(): Promise<void> {
    this.testAccountId = await this.salesforce.createAccount('Test Account');
  }

  // Called AFTER test() - cleanup here (always runs, even on failure)
  async teardown(): Promise<void> {
    if (this.testAccountId) {
      await this.salesforce.deleteRecord('Account', this.testAccountId);
    }
  }

  // The actual test logic
  async test(): Promise<void> {
    await this.navigateToExtension();
    await this.queryTab.navigateTo();

    await this.queryTab.executeQuery(
      `SELECT Id, Name FROM Account WHERE Id = '${this.testAccountId}'`
    );

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

// Salesforce client (for setup/teardown)
this.salesforce  // SalesforceClient instance

// Page objects (lazy-loaded)
this.queryTab    // QueryTabPage
this.apexTab     // ApexTabPage
this.recordPage  // RecordPage
this.schemaPage  // SchemaPage
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

## Salesforce Client

The `SalesforceClient` is used in `setup()` and `teardown()` to manage test data:

### Creating Records

```typescript
// Create an Account
const accountId = await this.salesforce.createAccount('Test Account');

// Create an Account with extra fields
const accountId = await this.salesforce.createAccount('Test Account', {
  Industry: 'Technology',
  Website: 'https://example.com'
});

// Create a Contact
const contactId = await this.salesforce.createContact({
  LastName: 'Smith',
  FirstName: 'John',
  AccountId: accountId
});

// Create any record type
const recordId = await this.salesforce.createRecord('CustomObject__c', {
  Name: 'Test',
  CustomField__c: 'value'
});
```

### Deleting Records

```typescript
// Delete a specific record
await this.salesforce.deleteRecord('Account', accountId);

// Delete all records created during the test (automatic tracking)
await this.salesforce.cleanupAll();
```

### Querying

```typescript
// Query records
const records = await this.salesforce.query<{ Id: string; Name: string }>(
  'SELECT Id, Name FROM Account LIMIT 10'
);
```

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

## Test Org Requirements

The test org should have:

1. **API Access** - API enabled for the user
2. **Standard Objects** - Account, Contact available
3. **Permissions** - User can create/delete Account and Contact records
4. **Apex Execution** - User can execute anonymous Apex
5. **Tooling API** - Access to TraceFlag, ApexLog objects

A Developer Edition org or Scratch org works well. Avoid production orgs.

## Debugging Tests

### Filter to Single Test

```bash
npm test -- --filter=basic-query
```

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

### Screenshot on Failure

Add to your test:

```typescript
try {
  await this.queryTab.executeQuery('...');
} catch (error) {
  await this.page.screenshot({ path: 'debug-screenshot.png' });
  throw error;
}
```

## Adding New Tests

1. Create a new file in the appropriate `tests/frontend/specs/` subdirectory
2. Export a default class extending `SftoolsTest`
3. Implement `setup()`, `teardown()`, and `test()` methods
4. Run with `npm test -- --filter=your-test-name`

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
└── lib/
    ├── auth.test.js
    ├── cors-detection.test.js
    ├── fetch.test.js
    ├── history-manager.test.js
    ├── oauth-credentials.test.js
    ├── salesforce-request.test.js
    ├── salesforce.test.js
    ├── soql-autocomplete.test.js
    ├── text-utils.test.js
    └── ui-helpers.test.js
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
