# Testing Framework

sftools uses two testing frameworks:

- **Frontend Tests** (`tests/frontend/`) - Playwright-based integration tests with real Salesforce API calls
- **Unit Tests** (`tests/unit/`) - Vitest-based unit tests with mocked dependencies

## Quick Commands

```bash
# Frontend tests (Playwright - requires visible browser)
npm test                       # Run all frontend tests
npm test -- --filter=query     # Run tests matching "query"

# Unit tests (Vitest)
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
