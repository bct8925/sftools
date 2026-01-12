# Code Review: sftools Chrome Extension

## Executive Summary

The sftools codebase demonstrates **strong adherence** to your coding standards in most areas:
- Excellent naming conventions (methods, variables, booleans)
- Consistent use of guard clauses and early returns
- Clean dependency injection patterns
- Well-organized component architecture
- Good bulk operation patterns

However, there are **significant opportunities** for refactoring:
- **~200 lines of duplicated history/favorites logic** across QueryTab and ApexTab
- **Bulk delete pattern duplicated 3 times** in salesforce.js (identical 40-line blocks)
- **Status update logic duplicated in 6+ components** (identical pattern)
- **Some methods exceed 50-100 lines** (primarily rendering methods)
- **Inconsistent error handling** patterns across API calls
- **utils.js is a re-export artifact** marked "for backward compatibility"

**Overall Grade: B+** - Solid foundation with clear refactoring path to excellence.

---

## Critical Findings (Fix These First)

### 1. History/Favorites Manager Duplication (HIGH PRIORITY)
**Issue:** ~200 lines of identical code in QueryTab and ApexTab for managing history and favorites

**Files:**
- `src/components/query/query-tab.js` (lines 427-627)
- `src/components/apex/apex-tab.js` (similar section)

**Duplicated Logic:**
- `saveToHistory()` - Save query/apex to history
- `addToFavorite()` - Add to favorites with label
- `removeFromHistory()` - Remove history item
- `removeFromFavorite()` - Remove favorite item
- `loadHistory()` / `loadFavorites()` - Load from storage
- `renderHistoryList()` / `renderFavoritesList()` - Render dropdowns
- List click handlers with data attribute delegation

**Recommendation:**
Extract to `src/lib/history-manager.js`:
```javascript
export class HistoryManager {
    constructor(storageKey, options = {}) {
        this.storageKey = storageKey;
        this.maxSize = options.maxSize || 30;
    }

    async save(item) { ... }
    async addToFavorites(item, label) { ... }
    async remove(list, id) { ... }
    async load() { ... }
    getPreview(item, length = 50) { ... }
}
```

**Impact:** Reduces duplication by ~200 lines, makes history/favorites behavior consistent

---

### 2. Bulk Delete Pattern Duplication (HIGH PRIORITY)
**Issue:** Identical 40-line bulk delete pattern duplicated 3 times

**Files & Lines:**
- `src/lib/salesforce.js:deleteAllDebugLogs()` (565-598)
- `src/lib/salesforce.js:deleteAllTraceFlags()` (657-689)
- `src/lib/salesforce.js:deleteInactiveFlowVersions()` (723-749)

**Duplicated Pattern:**
```javascript
const batchSize = 25;
for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const compositeRequest = {
        allOrNone: false,
        compositeRequest: batch.map((id, idx) => ({
            method: 'DELETE',
            url: `/services/data/v${API_VERSION}/tooling/sobjects/${OBJECT}/${id}`,
            referenceId: `delete_${idx}`
        }))
    };
    await salesforceRequest(`/services/data/v${API_VERSION}/tooling/composite`, {
        method: 'POST',
        body: JSON.stringify(compositeRequest)
    });
    deletedCount += batch.length;
}
```

**Recommendation:**
Extract to utility function in salesforce.js:
```javascript
async function bulkDeleteTooling(sobjectType, ids) {
    let deletedCount = 0;
    const batchSize = 25;

    for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        const compositeRequest = {
            allOrNone: false,
            compositeRequest: batch.map((id, idx) => ({
                method: 'DELETE',
                url: `/services/data/v${API_VERSION}/tooling/sobjects/${sobjectType}/${id}`,
                referenceId: `delete_${idx}`
            }))
        };
        await salesforceRequest(`/services/data/v${API_VERSION}/tooling/composite`, {
            method: 'POST',
            body: JSON.stringify(compositeRequest)
        });
        deletedCount += batch.length;
    }

    return deletedCount;
}
```

Then simplify each method:
```javascript
export async function deleteAllDebugLogs() {
    const query = encodeURIComponent('SELECT Id FROM ApexLog');
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/tooling/query/?q=${query}`);
    const logIds = (response.json.records || []).map(l => l.Id);

    if (logIds.length === 0) return { deletedCount: 0 };

    const deletedCount = await bulkDeleteTooling('ApexLog', logIds);
    return { deletedCount };
}
```

**Impact:** Reduces duplication by ~120 lines, centralizes composite API batch logic

---

### 3. Status Update Duplication (MEDIUM PRIORITY)
**Issue:** Identical status update pattern in 6+ components

**Files:**
- `src/components/query/query-tab.js:updateStatus()`
- `src/components/apex/apex-tab.js:updateStatus()`
- `src/components/rest-api/rest-api-tab.js:updateStatus()`
- `src/components/events/events-tab.js:updateStreamStatus()`
- `src/components/record/record-page.js:updateStatus()`
- `src/components/utils-tools/debug-logs.js:updateStatus()`
- `src/components/utils-tools/flow-cleanup.js:updateStatus()`

**Duplicated Pattern:**
```javascript
updateStatus(text, type = '') {
    this.statusEl.textContent = text;
    this.statusEl.className = 'status-badge';
    if (type) this.statusEl.classList.add(`status-${type}`);
}
```

**Recommendation:**
Extract to `src/lib/ui-helpers.js`:
```javascript
export function updateStatusBadge(element, message, type = '') {
    element.textContent = message;
    element.className = 'status-badge';
    if (type) element.classList.add(`status-${type}`);
}
```

Usage in components:
```javascript
import { updateStatusBadge } from '../../lib/ui-helpers.js';

// Replace this.updateStatus(text, type) with:
updateStatusBadge(this.statusEl, text, type);
```

**Impact:** Reduces duplication by ~50 lines, centralizes UI state management pattern

---

### 4. SOQL String Escaping Duplication (LOW PRIORITY)
**Issue:** SOQL quote escaping duplicated in 3+ search functions

**Files:**
- `src/lib/salesforce.js:searchUsers()` line 606
- `src/lib/salesforce.js:searchFlows()` line 697
- Similar pattern likely in `searchProfiles()` and others

**Duplicated Code:**
```javascript
const escaped = searchTerm.replace(/'/g, "\\'");
```

**Recommendation:**
Add utility function in salesforce.js:
```javascript
function escapeSoql(str) {
    return str.replace(/'/g, "\\'");
}
```

Then use in search functions:
```javascript
export async function searchUsers(searchTerm) {
    const escaped = escapeSoql(searchTerm);
    // ... rest of function
}
```

**Impact:** Small duplication fix, improves clarity of intent

---

## Code Organization Issues

### 5. utils.js Re-Export Module (MEDIUM PRIORITY)
**Issue:** `src/lib/utils.js` is a re-export file with comment "for backward compatibility"

**Current Structure:**
```javascript
// Lines 6-35: Re-exports from auth.js
export { getAccessToken, getInstanceUrl, ... } from './auth.js';

// Lines 37: Also imports to use internally
import { getAccessToken, ... } from './auth.js';

// Lines 61-134: Defines fetch helpers (extensionFetch, proxyFetch, smartFetch)
// Lines 143-176: Defines salesforceRequest()
```

**Problems:**
1. Not a true "utility" file - has specific responsibilities (fetch routing, auth re-exports)
2. Re-export comment suggests it's a migration artifact
3. Mixes concerns: auth state access + fetch routing + API request wrapper

**Recommendation:**
Refactor into focused modules:

**Option A: Keep Current Structure (Document Better)**
- Add clear JSDoc explaining this is a central export point
- Group exports by category with section comments

**Option B: Split Into Focused Modules** (Recommended)
- Keep `auth.js` for frontend auth state
- Create `fetch.js` for fetch routing (extensionFetch, proxyFetch, smartFetch)
- Create `salesforce-request.js` for salesforceRequest() wrapper
- Update imports across codebase

**Impact:** Improves code organization clarity, but requires updating ~20 import statements

**Decision Needed:** Ask if you want to keep current structure or split into focused modules

---

### 6. Long Methods - Rendering Logic (MEDIUM PRIORITY)
**Issue:** Several methods exceed 50-100 lines, primarily rendering methods

**Files & Methods:**
1. `query-tab.js:renderResults()` - 99 lines (788-886)
   - Handles: guard clauses, edit mode detection, table creation, headers, rows, cell types (subquery/id/editable/readonly)

2. `query-tab.js:fetchQueryData()` - 58 lines (571-628)
   - Handles: parallel API calls, column metadata processing, field describe fetching, error handling

3. `record-page.js:renderFields()` - 60+ lines (141-202+)
   - Handles: table creation, field sorting, picklist detection, input creation

4. `settings-tab.js:renderConnectionList()` - 40+ lines
   - Handles: HTML generation for connection cards

**Your Standard:** Methods should be short, breaking complex sections into named methods

**Recommendation:**
Extract sub-methods by responsibility:

**For query-tab.js:renderResults():**
```javascript
renderResults() {
    const tabData = this.getActiveTabData();
    if (!tabData) {
        this.showEmptyState();
        return;
    }

    if (tabData.error) {
        this.showError(tabData.error);
        return;
    }

    const table = this.createResultsTable(tabData);
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.appendChild(table);
}

createResultsTable(tabData) {
    const table = document.createElement('table');
    table.className = 'query-results-table';
    table.appendChild(this.createTableHeader(tabData.columns));
    table.appendChild(this.createTableBody(tabData));
    return table;
}

createTableBody(tabData) {
    const tbody = document.createElement('tbody');
    for (const record of tabData.records) {
        tbody.appendChild(this.createRecordRow(record, tabData));
    }
    return tbody;
}

createRecordRow(record, tabData) {
    const row = document.createElement('tr');
    for (const col of tabData.columns) {
        row.appendChild(this.createCell(record, col, tabData));
    }
    return row;
}

createCell(record, col, tabData) {
    const td = document.createElement('td');
    const value = this.getValueByPath(record, col.path);

    if (col.isSubquery) {
        this.renderSubqueryCell(td, value, col);
    } else if (col.path === 'Id') {
        this.renderIdCell(td, value, tabData);
    } else if (this.isEditMode() && this.isFieldEditable(col.path, tabData)) {
        this.renderEditableCell(td, value, col, tabData);
    } else {
        this.renderReadOnlyCell(td, value, col);
    }

    return td;
}
```

**Impact:**
- Improves readability - each method has clear, single purpose
- Makes testing easier (can test cell rendering independently)
- Follows your "method extraction based on single responsibility" guideline

**Trade-off:** More methods means more navigation, but each method is self-explanatory

---

### 7. Inconsistent Error Handling Patterns (MEDIUM PRIORITY)
**Issue:** Three different error handling patterns in salesforce.js

**Pattern A - Throws Exception:**
```javascript
// Most methods (getRecord, updateRecord, executeQueryWithColumns)
export async function getRecord(objectType, recordId) {
    const response = await salesforceRequest(...);
    return response.json;  // salesforceRequest throws on error
}
```

**Pattern B - Returns Result Object with success:**
```javascript
// executeRestRequest()
export async function executeRestRequest(...) {
    const response = await smartFetch(...);
    return {
        success: response.success,
        status: response.status,
        data: response.data,
        raw: response
    };
}
```

**Pattern C - Returns Result Object with explicit success check:**
```javascript
// publishPlatformEvent()
export async function publishPlatformEvent(...) {
    const response = await smartFetch(...);
    if (response.success) {
        return { success: true, id: ... };
    }
    return { success: false, error: ... };
}
```

**Your Standard Preference:** "Prefer Result Objects Over Exceptions" - avoid try/catch nesting in callers

**Recommendation:**
Standardize on Result Object pattern (Pattern B/C):

```javascript
// Modify salesforceRequest to return result object instead of throwing
export async function salesforceRequest(endpoint, options = {}) {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await smartFetch(url, { ... });

    if (!response.success && response.status !== 404) {
        return {
            success: false,
            status: response.status,
            error: response.error || this.parseError(response.data),
            json: null
        };
    }

    return {
        success: true,
        status: response.status,
        json: response.data ? JSON.parse(response.data) : null,
        error: null
    };
}
```

Then callers check success:
```javascript
export async function getRecord(objectType, recordId) {
    const result = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`);
    if (!result.success) {
        return { success: false, error: result.error };
    }
    return { success: true, record: result.json };
}
```

**Impact:**
- Removes layered try/catch in components
- Makes error handling explicit
- Aligns with your stated preference
- **Breaking change** - requires updating all salesforceRequest callers (~20 places)

**Decision Needed:** This is a significant refactor. Do you want to standardize on result objects?

---

## Consistency & Standards Alignment

### Strengths (Keep These Patterns)

✅ **Variable Naming:**
- Collections are plural: `connections`, `records`, `columns`, `fields`
- Booleans use prefixes: `isAuthenticated()`, `hasResults`, `canProcess`
- Source differentiation: `localItems` vs `remoteItems`

✅ **Method Naming:**
- Verb-based action names: `getRecord()`, `updateRecord()`, `executeQuery()`
- Event handlers: `handleClick()`, `handleConnectionChange()`
- Rendering: `renderResults()`, `renderFields()`

✅ **Guard Clauses:**
- Early returns consistently applied
- Minimal nesting throughout
- Example: record-page.js lines 81-84, salesforce.js lines 570-572

✅ **Bulk Operations:**
- `deleteAllDebugLogs()` uses 25-item batches
- `grantApexAccessToProfile()` uses 200-item batches
- Good pattern of: fetch all → filter → batch process

✅ **Component Architecture:**
- All custom elements follow same pattern (template via ?raw, CSS import, connectedCallback)
- Clean separation: template HTML, component JS, styles CSS
- No Shadow DOM - keeps CSS simple

### Issues Found

❌ **Method Length:** Several 50-100 line methods (see #6 above)

❌ **Error Patterns:** Three different patterns for success/failure (see #7 above)

❌ **Duplication:** Significant duplication in history, bulk delete, status updates (see #1-3)

⚠️ **Comment Usage:** Generally good, but some complex algorithms lack "why" explanations
- `query-tab.js:flattenColumnMetadata()` - Recursive relationship handling could use more context
- `record-page.js:formatPreviewHtml()` - Why certain field types get special treatment

⚠️ **Method Naming:** Minor inconsistencies
- `handleEnableForMe()` - "handle" is implied, could be `enableForCurrentUser()`
- `doUserSearch()` - Redundant "do" prefix, could be `searchUsers()`

---

## Additional Refactoring Opportunities

### 8. HTML Escaping Utilities (LOW PRIORITY)
**Issue:** `escapeHtml()` and `escapeAttr()` duplicated in 8+ components

**Recommendation:**
Create `src/lib/text-utils.js`:
```javascript
export const TextUtils = {
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    escapeAttr(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    truncate(str, length) {
        if (!str || str.length <= length) return str;
        return str.substring(0, length) + '...';
    }
};
```

---

### 9. Modal Dialog Standardization (LOW PRIORITY)
**Issue:** Different modal implementations across components

**Components Using Modals:**
- QueryTab - Favorite label modal (custom implementation)
- RecordPage - Field preview modal (uses `<modal-popup>`)
- SchemaPage - Formula editor modal (uses `<modal-popup>`)

**Recommendation:**
Standardize on `<modal-popup>` component (already exists) for all modals

---

### 10. OAuth Credentials Duplication (LOW PRIORITY)
**Issue:** `getOAuthCredentials()` implemented identically in two places

**Files:**
- `src/lib/auth.js:getOAuthCredentials()` (lines 272-284)
- `src/background/auth.js:getBackgroundOAuthCredentials()` (lines 12-24)

**Recommendation:**
Extract to shared location if both frontend and background need it, or document why duplication is necessary (module contexts)

---

## Verification Plan

Once refactoring is complete, verify:

### Functional Testing
1. **Query Tab:**
   - Execute SOQL query
   - Save to history
   - Add to favorites
   - Edit results inline
   - Export to CSV

2. **Apex Tab:**
   - Execute anonymous Apex
   - Save to history
   - Add to favorites
   - View debug logs

3. **Utils Tab - Debug Logs:**
   - Search users
   - Enable trace flag
   - Delete all logs

4. **Utils Tab - Flow Cleanup:**
   - Search flows
   - View versions
   - Delete inactive versions

5. **Record Viewer:**
   - Open record from context menu
   - View all fields
   - Edit field values
   - Save changes

6. **Schema Browser:**
   - Browse objects
   - View fields
   - Edit formula fields

### Technical Verification
1. No console errors in browser
2. All API calls still work
3. Connection switching works
4. Proxy toggle works
5. History/favorites persist correctly
6. Bulk operations complete successfully

---

## Priority Matrix

| Priority | Issue | Impact | Effort | Files Affected |
|----------|-------|--------|--------|----------------|
| **HIGH** | History/Favorites duplication | Reduces ~200 lines | Medium | 3 files (2 components + new utility) |
| **HIGH** | Bulk delete duplication | Reduces ~120 lines | Low | 1 file (salesforce.js) |
| **MEDIUM** | Status update duplication | Reduces ~50 lines | Low | 8 files (7 components + new utility) |
| **MEDIUM** | utils.js organization | Improves clarity | Medium | ~20 import updates |
| **MEDIUM** | Long rendering methods | Improves readability | Medium | 4 files |
| **MEDIUM** | Error handling standardization | Improves consistency | **High** | ~20 callers |
| **LOW** | SOQL escaping | Small fix | Low | 1 file |
| **LOW** | HTML escaping utilities | Reduces ~30 lines | Low | 9 files (8 components + new utility) |
| **LOW** | Modal standardization | Improves consistency | Low | 2 files |
| **LOW** | OAuth duplication | Clarify intent | Low | Document or dedupe |

### Recommended Sequence

**Phase 1 - Quick Wins (1-2 hours):**
1. Extract bulk delete pattern (#2)
2. Extract SOQL escaping (#4)
3. Extract status update utility (#3)
4. Extract HTML escaping utilities (#8)

**Phase 2 - Major Refactors (3-4 hours):**
5. Extract history/favorites manager (#1)
6. Break up long rendering methods (#6)
7. Reorganize utils.js (#5)

**Phase 3 - Architectural (Optional, 4-6 hours):**
8. Standardize error handling (#7) - **Breaking change, requires careful testing**

---

## Critical Files to Modify

### High Priority Changes
- `src/lib/salesforce.js` - Extract bulk delete, SOQL escaping
- `src/components/query/query-tab.js` - Use history manager, break up renderResults
- `src/components/apex/apex-tab.js` - Use history manager
- Create `src/lib/history-manager.js` - New file
- Create `src/lib/ui-helpers.js` - New file for status updates

### Medium Priority Changes
- `src/lib/utils.js` - Reorganize or document better
- `src/components/record/record-page.js` - Break up renderFields
- `src/components/rest-api/rest-api-tab.js` - Use status utility
- `src/components/events/events-tab.js` - Use status utility
- `src/components/utils-tools/*.js` - Use status utility

### Optional Architectural Changes
- `src/lib/salesforce.js` - Change salesforceRequest to return result objects
- All files importing salesforceRequest - Update to check result.success

---

## Questions for You

Before proceeding with implementation:

1. **Error Handling (#7):** Do you want to standardize on result objects (`{success, data, error}`) instead of throwing exceptions? This aligns with your stated preference but requires updating ~20 callers.

2. **utils.js Organization (#5):** Keep current re-export structure (just document better) or split into focused modules (fetch.js, salesforce-request.js)?

3. **Method Extraction Priority (#6):** Should I extract rendering methods into smaller pieces now, or defer until after other refactoring is complete?

4. **Breaking Changes:** Are you comfortable with refactoring that requires updating multiple component files, or prefer to keep changes isolated to library code?
