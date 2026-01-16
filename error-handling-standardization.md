# Standardize Error Handling Patterns

## Problem Statement

The codebase currently uses **three different error handling patterns** across Salesforce API methods, making error handling inconsistent and harder to reason about:

**Pattern A - Throws Exceptions:**
```javascript
// Most methods (getRecord, updateRecord, executeQueryWithColumns)
export async function getRecord(objectType, recordId) {
    const response = await salesforceRequest(...);
    return response.json;  // salesforceRequest throws on error
}
```

**Pattern B - Returns Result Object with success flag:**
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

This inconsistency creates several issues:
1. Callers must know which pattern each API method uses
2. Error handling code is duplicated (try/catch vs success checks)
3. Violates coding standard: "Prefer Result Objects Over Exceptions"
4. Makes layered error handling confusing (401 retries happen at multiple levels)

## Recommended Solution

Standardize on **Result Object Pattern** (similar to Pattern B/C) across all Salesforce API methods. This aligns with the project's stated coding preference and provides explicit error handling.

### Standard Result Object Shape

```javascript
{
    success: boolean,
    data?: any,      // Successful response data
    error?: string,  // Error message if failed
    status?: number  // HTTP status code
}
```

## Implementation Plan

### Phase 1: Update Core Request Function

**File:** `src/lib/salesforce-request.js`

**Current Implementation:**
```javascript
export async function salesforceRequest(endpoint, options = {}) {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await smartFetch(url, { ... });

    if (!response.success && response.status !== 404) {
        // Check for 401 Unauthorized (session expired)
        if (response.status === 401 && !response.authExpired) {
            const connectionId = getActiveConnectionId();
            triggerAuthExpired(connectionId, 'Session expired');
        }

        // Use response.error if available, otherwise parse response data
        if (response.error) {
            throw new Error(response.error);  // ❌ THROWS
        }
        const error = response.data ? JSON.parse(response.data) : { message: response.statusText };
        throw new Error(error[0]?.message || error.message || 'Request failed');  // ❌ THROWS
    }

    return {
        ...response,
        json: response.data ? JSON.parse(response.data) : null
    };
}
```

**New Implementation:**
```javascript
export async function salesforceRequest(endpoint, options = {}) {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await smartFetch(url, { ... });

    // Handle 401 auth expiration
    if (response.status === 401 && !response.authExpired) {
        const connectionId = getActiveConnectionId();
        triggerAuthExpired(connectionId, 'Session expired');
    }

    // Success case
    if (response.success || response.status === 404) {
        return {
            success: true,
            status: response.status,
            json: response.data ? JSON.parse(response.data) : null,
            error: null
        };
    }

    // Error case - parse error message
    let errorMessage = 'Request failed';
    if (response.error) {
        errorMessage = response.error;
    } else if (response.data) {
        try {
            const error = JSON.parse(response.data);
            errorMessage = error[0]?.message || error.message || errorMessage;
        } catch (e) {
            errorMessage = response.statusText || errorMessage;
        }
    }

    return {
        success: false,
        status: response.status,
        json: null,
        error: errorMessage
    };
}
```

### Phase 2: Update All Salesforce API Method Callers

All methods in `src/lib/salesforce.js` that use `salesforceRequest()` need to be updated to check the result object instead of using try/catch.

**Pattern to Replace:**
```javascript
// OLD - throws on error
export async function getRecord(objectType, recordId) {
    const response = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`);
    return response.json;  // Caller must wrap in try/catch
}
```

**New Pattern:**
```javascript
// NEW - returns result object
export async function getRecord(objectType, recordId) {
    const result = await salesforceRequest(`/services/data/v${API_VERSION}/sobjects/${objectType}/${recordId}`);
    if (!result.success) {
        return { success: false, error: result.error };
    }
    return { success: true, record: result.json };
}
```

### Phase 3: Update Component Callers

All components that call Salesforce API methods need to be updated to handle result objects.

**Pattern to Replace:**
```javascript
// OLD - try/catch pattern
try {
    const record = await getRecord(objectType, recordId);
    this.displayRecord(record);
    this.updateStatus('Loaded', 'success');
} catch (error) {
    this.updateStatus('Error', 'error');
    this.showError(error.message);
}
```

**New Pattern:**
```javascript
// NEW - explicit success check
const result = await getRecord(objectType, recordId);
if (!result.success) {
    this.updateStatus('Error', 'error');
    this.showError(result.error);
    return;
}

this.displayRecord(result.record);
this.updateStatus('Loaded', 'success');
```

## Files to Update

### Critical Files (salesforce.js methods)

**File:** `src/lib/salesforce.js`

Methods that need updating (currently throw on error):
1. `getObjectDescribe()` - line ~309
2. `getRecord()` - line ~362
3. `getRecordWithRelationships()` - line ~377
4. `updateRecord()` - line ~399
5. `executeQueryWithColumns()` - line ~243
6. `executeAnonymousApex()` - line ~178
7. `deleteAllDebugLogs()` - line ~565
8. `deleteAllTraceFlags()` - line ~657
9. `searchUsers()` - line ~605
10. `enableTraceFlagForUser()` - line ~619
11. `searchFlows()` - line ~696
12. `getFlowVersions()` - line ~710
13. `deleteInactiveFlowVersions()` - line ~723
14. `getFormulaFieldMetadata()` - line ~956
15. `updateFormulaField()` - line ~993
16. `getGlobalDescribe()` - line ~285
17. `getCurrentUserId()` - line ~85
18. `getAllStreamingChannels()` - lines ~420-470
19. `executeBulkQueryExport()` - lines ~822-929

### Component Files (API callers)

Estimated 15-20 component files that call Salesforce API methods:

1. `src/components/query/query-tab.js` - calls `executeQueryWithColumns()`, `executeBulkQueryExport()`, `getObjectDescribe()`, `updateRecord()`
2. `src/components/apex/apex-tab.js` - calls `executeAnonymousApex()`
3. `src/components/record/record-page.js` - calls `getObjectDescribe()`, `getRecordWithRelationships()`, `updateRecord()`
4. `src/components/schema/schema-page.js` - calls `getGlobalDescribe()`, `getObjectDescribe()`, `getFormulaFieldMetadata()`, `updateFormulaField()`
5. `src/components/events/events-tab.js` - calls `getAllStreamingChannels()`, `publishPlatformEvent()`
6. `src/components/settings/settings-tab.js` - uses auth methods
7. `src/components/utils-tools/debug-logs.js` - calls `getCurrentUserId()`, `searchUsers()`, `enableTraceFlagForUser()`, `deleteAllDebugLogs()`, `deleteAllTraceFlags()`
8. `src/components/utils-tools/flow-cleanup.js` - calls `searchFlows()`, `getFlowVersions()`, `deleteInactiveFlowVersions()`
9. `src/pages/app/app.js` - OAuth and connection methods
10. `src/pages/callback/callback.js` - OAuth methods
11. `src/lib/soql-autocomplete.js` - calls `getGlobalDescribe()`, `getObjectDescribe()`

## Benefits of This Change

1. **Consistency:** All API methods use the same error handling pattern
2. **Explicit Error Handling:** Callers explicitly check for success
3. **No Try/Catch Nesting:** Eliminates nested try/catch blocks
4. **Cleaner Variable Scope:** Result object keeps variables in scope after error checks
5. **Aligned with Coding Standards:** Matches stated preference for result objects over exceptions
6. **Easier Testing:** Result objects are easier to test than thrown exceptions
7. **Better Error Flow:** Clear distinction between happy path and error path

## Risks & Considerations

### Breaking Change
This is a **breaking change** that requires updating ~20-30 files. All existing code that calls Salesforce API methods will need to be updated.

### Mitigation Strategy
1. Update `salesforceRequest()` first
2. Update all methods in `salesforce.js` one at a time
3. Update components systematically by tab
4. Test each component after updating
5. Run full regression test suite before merging

### Backward Compatibility
Consider adding a temporary `throwOnError` flag to `salesforceRequest()` to allow gradual migration:

```javascript
export async function salesforceRequest(endpoint, options = {}) {
    // ... implementation ...

    const result = { success, status, json, error };

    // Temporary backward compatibility - remove after migration
    if (!result.success && options.throwOnError) {
        throw new Error(result.error);
    }

    return result;
}
```

This would allow updating callers gradually. **Remove this flag after migration is complete.**

## Verification Plan

### Unit Testing
After each method update, verify:
1. Success case returns `{ success: true, data, error: null }`
2. Error case returns `{ success: false, data: null, error: string }`
3. 401 errors trigger auth expiration
4. 404 errors are handled appropriately

### Integration Testing
After component updates, test each feature end-to-end:

**Query Tab:**
- Execute successful query
- Execute query with syntax error
- Execute query with invalid object
- Handle 401 session expiration
- Inline editing and save

**Apex Tab:**
- Execute successful Apex
- Execute Apex with compile error
- Execute Apex with runtime error
- Handle 401 session expiration

**Record Viewer:**
- Load record successfully
- Load non-existent record
- Update record successfully
- Update with validation error

**Schema Browser:**
- Load objects successfully
- View field details
- Edit formula field successfully
- Edit formula field with invalid syntax

**Utils Tab:**
- Debug Logs: Enable trace flag, delete logs
- Flow Cleanup: Search flows, delete versions
- Handle errors gracefully in all tools

**Events Tab:**
- Load channels successfully
- Publish event successfully
- Handle publish errors

### Error Scenarios to Test
1. Network error (offline)
2. 401 Unauthorized (expired session)
3. 403 Forbidden (insufficient permissions)
4. 404 Not Found (invalid record ID)
5. 400 Bad Request (validation errors)
6. 500 Server Error (Salesforce down)
7. Malformed response data

## Implementation Checklist

### Step 1: Update Core
- [ ] Update `salesforceRequest()` in `salesforce-request.js`
- [ ] Add temporary `throwOnError` flag for backward compatibility (optional)
- [ ] Test with existing code to ensure no immediate breakage

### Step 2: Update API Methods
- [ ] Update `getObjectDescribe()`
- [ ] Update `getRecord()`
- [ ] Update `getRecordWithRelationships()`
- [ ] Update `updateRecord()`
- [ ] Update `executeQueryWithColumns()`
- [ ] Update `executeAnonymousApex()`
- [ ] Update `deleteAllDebugLogs()`
- [ ] Update `deleteAllTraceFlags()`
- [ ] Update `searchUsers()`
- [ ] Update `enableTraceFlagForUser()`
- [ ] Update `searchFlows()`
- [ ] Update `getFlowVersions()`
- [ ] Update `deleteInactiveFlowVersions()`
- [ ] Update `getFormulaFieldMetadata()`
- [ ] Update `updateFormulaField()`
- [ ] Update `getGlobalDescribe()`
- [ ] Update `getCurrentUserId()`
- [ ] Update `getAllStreamingChannels()`
- [ ] Update `executeBulkQueryExport()`

### Step 3: Update Components
- [ ] Update `query-tab.js`
- [ ] Update `apex-tab.js`
- [ ] Update `record-page.js`
- [ ] Update `schema-page.js`
- [ ] Update `events-tab.js`
- [ ] Update `debug-logs.js`
- [ ] Update `flow-cleanup.js`
- [ ] Update `app.js`
- [ ] Update `callback.js`
- [ ] Update `soql-autocomplete.js`

### Step 4: Testing
- [ ] Run manual tests for each component
- [ ] Test all error scenarios
- [ ] Test 401 session expiration handling
- [ ] Verify no console errors
- [ ] Test in both side panel and full tab

### Step 5: Cleanup
- [ ] Remove `throwOnError` flag if used
- [ ] Update JSDoc comments to reflect new return types
- [ ] Update any remaining try/catch blocks to use result objects

## Estimated Effort

- **Core Update (Step 1):** 1 hour
- **API Methods (Step 2):** 3-4 hours (~19 methods × 10-15 min each)
- **Components (Step 3):** 4-5 hours (~10 components × 30 min each)
- **Testing (Step 4):** 2-3 hours (comprehensive testing)
- **Cleanup (Step 5):** 1 hour

**Total Estimated Effort:** 11-14 hours

## Alternative Approach: Hybrid Pattern

If the breaking change is too risky, consider a **hybrid approach**:

1. Keep `salesforceRequest()` throwing for now
2. Add new `salesforceRequestSafe()` that returns result objects
3. Gradually migrate callers to use `salesforceRequestSafe()`
4. Once all callers migrated, rename `salesforceRequestSafe()` to `salesforceRequest()`

This allows incremental migration without breaking existing code.

## Success Criteria

- [ ] All Salesforce API methods return result objects with `{ success, data, error }` shape
- [ ] No component code uses try/catch for Salesforce API errors
- [ ] All error paths explicitly check `result.success`
- [ ] All manual tests pass
- [ ] No console errors during normal operation
- [ ] 401 errors still trigger auth expiration flow
- [ ] Error messages are clear and actionable

## Notes

- This change aligns with the project's coding standards: "Prefer Result Objects Over Exceptions"
- Result objects make the happy path and error path explicit
- Removes layered error handling complexity
- Makes testing easier (no need to expect thrown exceptions)
- Consider this for future API additions as well
