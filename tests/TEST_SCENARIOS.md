# TEST_SCENARIOS.md

Comprehensive test scenarios for the sftools Chrome Extension. Organized by feature and test type (Frontend, Integration, Unit).

**Test Types:**
- **Frontend**: UI/UX tests using Playwright with mocked API responses - validates user interactions, rendering, and display logic
- **Integration**: End-to-end tests with real Salesforce API calls - validates API behavior and data accuracy
- **Unit**: Isolated function tests with mocked dependencies - validates business logic and utilities

---

## Table of Contents

1. [Query Tab](#1-query-tab)
2. [Apex Tab](#2-apex-tab)
3. [REST API Tab](#3-rest-api-tab)
4. [Events Tab](#4-events-tab)
5. [Settings Tab](#5-settings-tab)
6. [Utils Tab](#6-utils-tab)
7. [Record Viewer](#7-record-viewer)
8. [Schema Browser](#8-schema-browser)
9. [Monaco Editor Component](#9-monaco-editor-component)
10. [App Shell & Navigation](#10-app-shell--navigation)
11. [OAuth & Authentication](#11-oauth--authentication)
12. [Background Service Worker](#12-background-service-worker)
13. [Library Utilities](#13-library-utilities)
14. [Local Proxy](#14-local-proxy)

---

## 1. Query Tab

**Source:** `src/components/query/query-tab.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| Q-F-001 | Execute simple SOQL query | Results display in table with correct columns | `query/basic-query.test.ts` |
| Q-F-002 | Execute query via Ctrl/Cmd+Enter | Same as button click | `query/query-shortcut.test.ts` |
| Q-F-004 | Execute query with subquery | Nested records show as expandable "▶ N records" | `query/query-subquery.test.ts` |
| Q-F-005 | Expand subquery results | Nested table displays inline | `query/query-subquery.test.ts` |
| Q-F-006 | Collapse subquery results | Nested table hides | `query/query-subquery.test.ts` |
| Q-F-008 | Toggle Edit mode | Input fields appear for editable fields | `query/query-edit-mode.test.ts` |
| Q-F-009 | Edit field value | Field highlighted, changes counter updates | `query/query-edit-mode.test.ts` |
| Q-F-010 | Save edited records | PATCH request sent, success feedback shown | `query/query-edit-mode.test.ts` |
| Q-F-011 | Clear changes | All edits discarded, counter resets | `query/query-edit-mode.test.ts` |
| Q-F-012 | Export to CSV | CSV file downloads with correct data | `query/query-export.test.ts` |
| Q-F-013 | Bulk export via Bulk API | Progress shown, CSV downloads | - |
| Q-F-014 | Search/filter results | Table filters to matching rows | `query/query-filter.test.ts` |
| Q-F-015 | Click Id field | Opens Record Viewer for that record | `query/query-record-link.test.ts` |
| Q-F-016 | View query history | Dropdown shows previous queries | `query/query-history.test.ts` |
| Q-F-017 | Load query from history | Editor populated with selected query | `query/query-history.test.ts` |
| Q-F-018 | Delete query from history | Query removed from list | `query/query-history.test.ts` |
| Q-F-019 | Save query to favorites | Prompt for label, query saved | `query/query-favorites.test.ts` |
| Q-F-020 | Load query from favorites | Editor populated with selected query | `query/query-favorites.test.ts` |
| Q-F-021 | Delete query from favorites | Query removed from list | `query/query-favorites.test.ts` |
| Q-F-022 | Create new result tab | Same query reuses existing tab | `query/query-tabs.test.ts` |
| Q-F-023 | Different query creates new tab | New tab appears | `query/query-tabs.test.ts` |
| Q-F-024 | Switch between tabs | Correct results displayed | `query/query-tabs.test.ts` |
| Q-F-025 | Refresh tab | Query re-executed, results updated | - |
| Q-F-026 | Close tab | Tab removed from list | `query/query-tabs.test.ts` |
| Q-F-027 | Status badge shows loading | Spinner during query execution | - |
| Q-F-028 | Status badge shows success | Check icon with record count | - |
| Q-F-029 | Status badge shows error | X icon with error message | `query/query-errors.test.ts` |
| Q-F-032 | Query with invalid SOQL | Error message with details | `query/query-errors.test.ts` |
| Q-F-033 | Status badge shows success | Check icon displayed | `query/basic-query.test.ts` |
| Q-F-034 | Record count displayed | Record count shown in status | `query/basic-query.test.ts` |
| Q-F-035 | Column headers displayed | Headers match query columns | `query/basic-query.test.ts` |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| Q-I-001 | Query with no results | Empty table, "No records" message | `tests/integration/query.test.js:19` |
| Q-I-002 | Query with invalid SOQL | Error message with details | `tests/integration/query.test.js:28` |
| Q-I-003 | Query with aggregate functions | Results non-editable | `tests/integration/query.test.js:48` |
| Q-I-004 | Query without Id field | Results non-editable | `tests/integration/query.test.js:80` |
| Q-I-005 | Query COUNT() | Single row with count value | `tests/integration/query.test.js:95` |
| Q-I-006 | Query with LIMIT | Correct number of rows | `tests/integration/query.test.js:109` |
| Q-I-007 | Query with ORDER BY | Rows in correct order | `tests/integration/query.test.js:136` |
| Q-I-008 | Query with WHERE clause | Only matching records | `tests/integration/query.test.js:171` |
| Q-I-009 | Query Tooling API object | Results from Tooling API | `tests/integration/query.test.js:221` |
| Q-I-010 | Large result set (10K+ rows) | Pagination or bulk export prompt | - |
| Q-I-011 | Connection change | Autocomplete state cleared, cache reset | - |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| Q-U-001 | `normalizeQuery()` | Removes extra whitespace | `lib/query-utils.test.js` |
| Q-U-002 | `normalizeQuery()` | Converts to lowercase | `lib/query-utils.test.js` |
| Q-U-003 | `flattenColumnMetadata()` | Flattens nested joinColumns | `lib/query-utils.test.js` |
| Q-U-004 | `flattenColumnMetadata()` | Handles multiple nesting levels | `lib/query-utils.test.js` |
| Q-U-005 | `extractColumnsFromRecord()` | Extracts keys from record | `lib/query-utils.test.js` |
| Q-U-006 | `getValueByPath()` | Returns nested value by dot path | `lib/query-utils.test.js` |
| Q-U-007 | `getValueByPath()` | Returns null for missing path | `lib/query-utils.test.js` |
| Q-U-008 | `recordsToCsv()` | Generates valid CSV | `lib/query-utils.test.js` |
| Q-U-009 | `recordsToCsv()` | Handles null values | `lib/query-utils.test.js` |
| Q-U-010 | `escapeCsvField()` | Escapes quotes | `lib/query-utils.test.js` |
| Q-U-011 | `escapeCsvField()` | Handles commas | `lib/query-utils.test.js` |
| Q-U-012 | `escapeCsvField()` | Handles newlines | `lib/query-utils.test.js` |
| Q-U-013 | `formatCellValue()` | Formats dates | `lib/query-utils.test.js` |
| Q-U-014 | `formatCellValue()` | Formats booleans | `lib/query-utils.test.js` |
| Q-U-015 | `formatCellValue()` | Handles null/undefined | `lib/query-utils.test.js` |
| Q-U-016 | `parseValueFromInput()` | Parses numbers | `lib/query-utils.test.js` |
| Q-U-017 | `parseValueFromInput()` | Parses booleans | `lib/query-utils.test.js` |
| Q-U-018 | `parseValueFromInput()` | Returns null for empty string | `lib/query-utils.test.js` |
| Q-U-019 | `isFieldEditable()` | Returns false for formula fields | `lib/query-utils.test.js` |
| Q-U-020 | `isFieldEditable()` | Returns true for updateable fields | `lib/query-utils.test.js` |
| Q-U-021 | `checkIfEditable()` | Returns false without Id | `lib/query-utils.test.js` |
| Q-U-022 | `checkIfEditable()` | Returns false for aggregate | `lib/query-utils.test.js` |
| Q-U-023 | `normalizeQuery()` | Trims leading/trailing whitespace | `lib/query-utils.test.js` |
| Q-U-024 | `normalizeQuery()` | Collapses multiple spaces to single | `lib/query-utils.test.js` |
| Q-U-025 | `normalizeQuery()` | Preserves quoted strings | `lib/query-utils.test.js` |
| Q-U-026 | `normalizeQuery()` | Converts to lowercase except quotes | `lib/query-utils.test.js` |
| Q-U-027 | `normalizeQuery()` | Handles empty/whitespace-only input | `lib/query-utils.test.js` |
| Q-U-028 | `flattenColumnMetadata()` | Handles empty metadata array | `lib/query-utils.test.js` |
| Q-U-029 | `flattenColumnMetadata()` | Flattens single-level columns | `lib/query-utils.test.js` |
| Q-U-030 | `flattenColumnMetadata()` | Flattens nested relationship columns | `lib/query-utils.test.js` |
| Q-U-031 | `flattenColumnMetadata()` | Handles multiple nesting levels | `lib/query-utils.test.js` |
| Q-U-032 | `flattenColumnMetadata()` | Builds proper dot-notation paths | `lib/query-utils.test.js` |
| Q-U-033 | `extractColumnsFromRecord()` | Extracts top-level keys | `lib/query-utils.test.js` |
| Q-U-034 | `extractColumnsFromRecord()` | Excludes attributes key | `lib/query-utils.test.js` |
| Q-U-035 | `extractColumnsFromRecord()` | Handles empty record | `lib/query-utils.test.js` |
| Q-U-036 | `getValueByPath()` | Returns direct property value | `lib/query-utils.test.js` |
| Q-U-037 | `getValueByPath()` | Returns nested property via dot path | `lib/query-utils.test.js` |
| Q-U-038 | `getValueByPath()` | Returns null for undefined path | `lib/query-utils.test.js` |
| Q-U-039 | `getValueByPath()` | Handles null intermediate values | `lib/query-utils.test.js` |
| Q-U-040 | `recordsToCsv()` | Generates valid CSV with headers | `lib/query-utils.test.js` |
| Q-U-041 | `recordsToCsv()` | Quotes fields with commas | `lib/query-utils.test.js` |
| Q-U-042 | `recordsToCsv()` | Escapes quotes in values | `lib/query-utils.test.js` |
| Q-U-043 | `recordsToCsv()` | Handles newlines in values | `lib/query-utils.test.js` |
| Q-U-044 | `recordsToCsv()` | Handles null/undefined values | `lib/query-utils.test.js` |
| Q-U-045 | `escapeCsvField()` | Escapes double quotes | `lib/query-utils.test.js` |
| Q-U-046 | `escapeCsvField()` | Quotes fields with commas | `lib/query-utils.test.js` |
| Q-U-047 | `escapeCsvField()` | Quotes fields with newlines | `lib/query-utils.test.js` |
| Q-U-048 | `escapeCsvField()` | Handles null/undefined | `lib/query-utils.test.js` |
| Q-U-049 | `formatCellValue()` | Formats datetime values | `lib/query-utils.test.js` |
| Q-U-050 | `formatCellValue()` | Formats boolean values | `lib/query-utils.test.js` |
| Q-U-051 | `formatCellValue()` | Handles null values | `lib/query-utils.test.js` |
| Q-U-052 | `formatCellValue()` | Preserves string values | `lib/query-utils.test.js` |
| Q-U-053 | `parseValueFromInput()` | Parses string to number | `lib/query-utils.test.js` |
| Q-U-054 | `parseValueFromInput()` | Parses "true"/"false" to boolean | `lib/query-utils.test.js` |
| Q-U-055 | `parseValueFromInput()` | Returns null for empty string | `lib/query-utils.test.js` |
| Q-U-056 | `parseValueFromInput()` | Preserves regular strings | `lib/query-utils.test.js` |
| Q-U-057 | `isFieldEditable()` | Returns false for formula/calculated fields | `lib/query-utils.test.js` |

---

## 2. Apex Tab

**Source:** `src/components/apex/apex-tab.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| A-F-002 | Execute via Ctrl/Cmd+Enter | Same as button click | `apex/apex-shortcut.test.ts` |
| A-F-004 | View compilation error | Error marker on line/column | `apex/apex-errors.test.ts` |
| A-F-006 | Search/filter debug log | Output filtered to matches | `apex/apex-log-filter.test.ts` |
| A-F-007 | Clear filter | All output visible | `apex/apex-log-filter.test.ts` |
| A-F-008 | View execution history | Dropdown shows previous scripts | `apex/apex-history.test.ts` |
| A-F-009 | Load script from history | Editor populated | `apex/apex-history.test.ts` |
| A-F-010 | Delete script from history | Script removed | `apex/apex-history.test.ts` |
| A-F-011 | Save script to favorites | Prompt for label, saved | `apex/apex-favorites.test.ts` |
| A-F-012 | Load script from favorites | Editor populated | `apex/apex-favorites.test.ts` |
| A-F-013 | Delete script from favorites | Script removed | `apex/apex-favorites.test.ts` |
| A-F-014 | Status badge loading | Spinner during execution | - |
| A-F-015 | Status badge success | Green check | - |
| A-F-016 | Status badge compile error | Red X with "Compile Error" | `apex/apex-errors.test.ts` |
| A-F-017 | Status badge runtime error | Red X with "Runtime Error" | - |
| A-F-018 | Compilation error on specific line | Marker on line 5 | `apex/apex-errors.test.ts` |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| A-I-001 | Execute System.debug() | Debug statement in log | `tests/integration/apex.test.js:17` |
| A-I-002 | Execute DML operation | Record created/updated | `tests/integration/apex.test.js:29` |
| A-I-003 | Execute with governor limits | Logs show limits usage | `tests/integration/apex.test.js:79` |
| A-I-004 | Compilation error on line 5 | Marker on line 5 | `tests/integration/apex.test.js:124` |
| A-I-005 | Runtime NullPointerException | Exception details in output | `tests/integration/apex.test.js:164` |
| A-I-006 | No debug log available | Message indicating no log | `tests/integration/apex.test.js:194` |
| A-I-007 | Empty code submission | Error or no-op | `tests/integration/apex.test.js:210` |
| A-I-008 | Not authenticated | Auth error message | - |
| A-I-009 | Large debug log (>2MB) | Truncation or streaming | - |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| A-U-001 | `getPreview()` | Returns short lines unchanged | `lib/apex-utils.test.js` |
| A-U-002 | `applyFilter()` | Filters to matching lines | `lib/apex-utils.test.js` |
| A-U-003 | `applyFilter()` | Case insensitive match | `lib/apex-utils.test.js` |
| A-U-004 | `clearFilter()` | Shows all output | `lib/apex-utils.test.js` |
| A-U-005 | `getPreview()` | Returns first non-comment line | `lib/apex-utils.test.js` |
| A-U-006 | `getPreview()` | Truncates long lines | `lib/apex-utils.test.js` |
| A-U-007 | `getPreview()` | Skips empty lines | `lib/apex-utils.test.js` |
| A-U-008 | `getPreview()` | Skips multiple comment lines | `lib/apex-utils.test.js` |
| A-U-009 | `formatOutput()` | Formats success result | `lib/apex-utils.test.js` |
| A-U-010 | `formatOutput()` | Formats error result | `lib/apex-utils.test.js` |
| A-U-011 | `getPreview()` | Returns first line as fallback if all comments | `lib/apex-utils.test.js` |
| A-U-012 | `getPreview()` | Returns "Empty script" for empty string | `lib/apex-utils.test.js` |
| A-U-013 | `getPreview()` | Truncates first line fallback if over 50 chars | `lib/apex-utils.test.js` |
| A-U-014 | `getPreview()` | Handles code with only whitespace | `lib/apex-utils.test.js` |
| A-U-015 | `formatOutput()` | Formats runtime error without line number | `lib/apex-utils.test.js` |
| A-U-016 | `formatOutput()` | Formats runtime error without stack trace | `lib/apex-utils.test.js` |
| A-U-017 | `formatOutput()` | Uses default message for runtime error without exception message | `lib/apex-utils.test.js` |
| A-U-018 | `formatOutput()` | Defaults column to 1 if missing in compile error | `lib/apex-utils.test.js` |
| A-U-019 | `formatOutput()` | Includes debug log with successful execution | `lib/apex-utils.test.js` |
| A-U-020 | `filterLines()` | Returns all lines when filter is null | `lib/apex-utils.test.js` |
| A-U-021 | `filterLines()` | Returns all lines when filter is undefined | `lib/apex-utils.test.js` |
| A-U-022 | `filterLines()` | Returns empty array when no matches | `lib/apex-utils.test.js` |
| A-U-023 | `filterLines()` | Handles empty lines array | `lib/apex-utils.test.js` |
| A-U-024 | `filterLines()` | Matches partial strings | `lib/apex-utils.test.js` |
| A-U-025 | `filterLines()` | Matches multiple criteria across different lines | `lib/apex-utils.test.js` |

---

## 3. REST API Tab

**Source:** `src/components/rest-api/rest-api-tab.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| R-F-006 | Select POST method | Request body editor appears | `rest-api/rest-api-body-visibility.test.ts` |
| R-F-007 | Select GET method | Request body editor hidden | `rest-api/rest-api-body-visibility.test.ts` |
| R-F-008 | Execute via Ctrl/Cmd+Enter in body | Request executed | `rest-api/rest-api-shortcut.test.ts` |
| R-F-009 | Error response received | Status badge shows error state | `rest-api/rest-api-errors.test.ts` |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| R-I-001 | GET /services/data | Returns API versions | `tests/integration/rest-api.test.js:38` |
| R-I-002 | POST to sobjects | Creates record | `tests/integration/rest-api.test.js:55` |
| R-I-003 | Invalid JSON in body | Error before sending | `tests/integration/rest-api.test.js:80` |
| R-I-004 | Empty URL | Error message | - |
| R-I-005 | Not authenticated | Auth error | - |
| R-I-006 | Non-JSON response | Raw text displayed | `tests/integration/rest-api.test.js:95` |
| R-I-007 | HTTP 400 error | Error response displayed | `tests/integration/rest-api.test.js:123` |
| R-I-008 | HTTP 500 error | Error response displayed | - |
| R-I-009 | PATCH updates record | Record updated successfully | `tests/integration/rest-api.test.js:177` |
| R-I-010 | GET retrieves record by ID | Record data returned | `tests/integration/rest-api.test.js:204` |
| R-I-011 | DELETE removes record | Record deleted, subsequent GET returns 404 | `tests/integration/rest-api.test.js:228` |
| R-I-012 | Response headers verification | Content-type and request ID headers present | `tests/integration/rest-api.test.js:257` |
| R-I-013 | SOQL query via REST endpoint | Query results returned | `tests/integration/rest-api.test.js:277` |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| R-U-001 | `shouldShowBody()` | Shows body for POST | `lib/rest-api-utils.test.js` |
| R-U-002 | `shouldShowBody()` | Hides body for GET | `lib/rest-api-utils.test.js` |
| R-U-003 | `shouldShowBody()` | Shows body for PATCH | `lib/rest-api-utils.test.js` |
| R-U-004 | `shouldShowBody()` | Shows body for PUT | `lib/rest-api-utils.test.js` |
| R-U-005 | `shouldShowBody()` | Hides body for DELETE | `lib/rest-api-utils.test.js` |
| R-U-004 | `shouldShowBody()` | Shows body for PUT | `lib/rest-api-utils.test.js` |
| R-U-005 | `shouldShowBody()` | Hides body for DELETE | `lib/rest-api-utils.test.js` |

---

## 4. Events Tab

**Source:** `src/components/events/events-tab.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| E-F-001 | Load channel list | Grouped dropdown (Events, PushTopics, SystemTopics) | - |
| E-F-002 | Subscribe to channel | "Subscribed" status, stream active | - |
| E-F-003 | Receive streaming event | Event displayed in output | - |
| E-F-004 | Unsubscribe from channel | "Unsubscribed" status | - |
| E-F-005 | Clear stream output | Output area cleared | - |
| E-F-006 | Publish Platform Event | Publish request sent | - |
| E-F-007 | Select replay option LATEST | New events only | - |
| E-F-008 | Select replay option EARLIEST | All retained events | - |
| E-F-009 | Enter custom replay ID | Replay from specific ID | - |
| E-F-010 | Status badges update correctly | Loading, subscribed, error states | - |

| E-F-011 | Subscribe to Platform Event (gRPC) | Connection via proxy, events received | - |
| E-F-012 | Subscribe to PushTopic (CometD) | Connection via proxy, events received | - |
| E-F-013 | Subscribe to System Topic (CometD) | Connection via proxy, events received | - |
| E-F-014 | Proxy not connected | Tab disabled with overlay | - |
| E-F-015 | Not authenticated | Error message | - |
| E-F-016 | Stream error from server | Error displayed | - |
| E-F-017 | Stream end from server | End notification | - |
| E-F-018 | Connection change | Unsubscribes, reloads channels | - |
| E-F-019 | Tab visibility | Lazy loads on first view | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| E-I-006 | Invalid JSON in publish payload | Validation error | `tests/integration/events.test.js:59` |
| E-I-007 | Query custom Platform Events | Returns event definitions via EntityDefinition | `tests/integration/events.test.js:24` |
| E-I-008 | Query CustomNotificationType | Returns notification types | `tests/integration/events.test.js:33` |
| E-I-009 | Query active PushTopics | Returns active PushTopic records | `tests/integration/events.test.js:42` |
| E-I-010 | Query all PushTopics | Returns all PushTopic records | `tests/integration/events.test.js:50` |
| E-I-011 | Get API versions | Returns API versions info | `tests/integration/events.test.js:84` |
| E-I-012 | Verify streaming API support | Confirms PushTopic availability in org | `tests/integration/events.test.js:93` |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| E-U-001 | `buildChannelOptions()` | Creates grouped optgroups | `lib/events-utils.test.js` |
| E-U-002 | `parseStreamMessage()` | Processes event messages | `lib/events-utils.test.js` |
| E-U-003 | `parseStreamMessage()` | Handles error messages | `lib/events-utils.test.js` |
| E-U-004 | `parseStreamMessage()` | Handles end messages | `lib/events-utils.test.js` |
| E-U-005 | `formatEventEntry()` | Adds event to output | `lib/events-utils.test.js` |
| E-U-006 | `formatSystemMessage()` | Adds system message | `lib/events-utils.test.js` |

---

## 5. Settings Tab

**Source:** `src/components/settings/settings-tab.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| S-F-001 | Select System theme | Theme follows OS | `settings/settings-theme.test.ts` |
| S-F-002 | Select Light theme | Light mode applied | `settings/settings-theme.test.ts` |
| S-F-003 | Select Dark theme | Dark mode applied | `settings/settings-theme.test.ts` |
| S-F-004 | Theme persists on reload | Same theme on return | - |
| S-F-005 | Toggle proxy on | Proxy connection attempted | - |
| S-F-006 | Toggle proxy off | Proxy disconnected | - |
| S-F-007 | Proxy status connected | Green indicator | - |
| S-F-008 | Proxy status disconnected | Red indicator | - |
| S-F-009 | View connection list | All connections displayed | - |
| S-F-010 | Edit connection label | Label updated | - |
| S-F-011 | Edit connection Client ID | Re-auth prompted | - |
| S-F-012 | Re-authorize connection | OAuth flow started | - |
| S-F-013 | Delete connection | Connection removed | - |
| S-F-014 | Add connection - select domain | Domain selected | - |
| S-F-015 | Add connection - custom domain | Custom domain input shown | - |
| S-F-016 | Add connection - custom Client ID | Client ID input shown | - |
| S-F-017 | Clear describe cache | Success message | - |
| S-F-018 | Theme syncs across tabs | Change in one tab affects others | - |
| S-F-019 | Proxy connection failure | Error message displayed | - |
| S-F-020 | Delete active connection | Another connection selected | - |
| S-F-021 | No connections state | "Authorize" prompt shown | - |
| S-F-022 | Cache clear when not authenticated | Error or no-op | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| S-I-001 | Validate credentials | Fetches user info successfully | `tests/integration/settings.test.js:54` |
| S-I-002 | Retrieve org identity info | Returns Chatter user info | `tests/integration/settings.test.js:60` |
| S-I-003 | Get API limits | Returns API usage information | `tests/integration/settings.test.js:69` |
| S-I-004 | Fetch global describe | Returns all sObjects | `tests/integration/settings.test.js:80` |
| S-I-005 | Describe specific object | Returns field metadata | `tests/integration/settings.test.js:90` |
| S-I-006 | Describe multiple objects | Returns metadata for each object | `tests/integration/settings.test.js:97` |
| S-I-007 | Query API versions | Returns available API versions | `tests/integration/settings.test.js:109` |
| S-I-008 | Access REST resources | Returns REST API resources list | `tests/integration/settings.test.js:100` |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| S-U-001 | `applyTheme()` | Applies light theme | `lib/theme.test.js` |
| S-U-002 | `applyTheme()` | Applies dark theme | `lib/theme.test.js` |
| S-U-003 | `createConnectionCardData()` | Renders connection details | `lib/settings-utils.test.js` |
| S-U-004 | `getProxyStatusText()` | Shows connected status | `lib/settings-utils.test.js` |
| S-U-005 | `getProxyStatusText()` | Shows disconnected status | `lib/settings-utils.test.js` |
| S-U-006 | `createConnectionCardData()` | Renders inactive connection | `lib/settings-utils.test.js` |
| S-U-007 | `createConnectionCardData()` | Escapes HTML in connection label | `lib/settings-utils.test.js` |
| S-U-008 | `createConnectionCardData()` | Handles refresh token without custom client ID | `lib/settings-utils.test.js` |
| S-U-009 | `createConnectionCardData()` | Handles custom client ID without refresh token | `lib/settings-utils.test.js` |
| S-U-010 | `createConnectionCardData()` | Defaults activeId to null | `lib/settings-utils.test.js` |

---

## 6. Utils Tab

**Source:** `src/components/utils/utils-tab.js`, `src/components/utils-tools/*`

### 6.1 Debug Logs Tool

**Source:** `src/components/utils-tools/debug-logs.js`

#### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-DL-F-002 | Search for other users | Results dropdown | - |
| U-DL-F-003 | Enable trace flag for selected user | Success status | - |
| U-DL-F-004 | Delete all trace flags | Confirmation, success | - |
| U-DL-F-005 | Delete all debug logs | Confirmation, success | - |
| U-DL-F-006 | Status indicator loading | Yellow spinner | - |
| U-DL-F-008 | Status indicator error | Red X | - |
| U-DL-F-009 | Not authenticated | Error message | - |

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-DL-I-002 | User search with no results | Empty list | `tests/integration/utils.test.js:37` |
| U-DL-I-003 | Trace flag already exists | Updated (not duplicate) | `tests/integration/utils.test.js:64` |
| U-DL-I-004 | No trace flags to delete | Success (no-op) | `tests/integration/utils.test.js:82` |
| U-DL-I-005 | No logs to delete | Success (no-op) | `tests/integration/utils.test.js:99` |

### 6.2 Flow Cleanup Tool

**Source:** `src/components/utils-tools/flow-cleanup.js`

#### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-FC-F-001 | Search flows by API name | Results displayed | - |
| U-FC-F-002 | Select flow | Versions panel shows | - |
| U-FC-F-003 | View version count | Total and inactive count | - |
| U-FC-F-004 | Active version highlighted | Visual distinction | - |
| U-FC-F-005 | Delete inactive versions | Confirmation, deletion | - |
| U-FC-F-006 | Status indicators | Loading, success, error states | - |

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-FC-I-001 | Flow search with no results | Empty list | `tests/integration/utils.test.js:117` |
| U-FC-I-002 | Flow with no inactive versions | Delete button disabled | `tests/integration/utils.test.js:134` |
| U-FC-I-003 | Flow with only active version | No deletable versions | `tests/integration/utils.test.js:165` |

### 6.3 Schema Browser Link

**Source:** `src/components/utils-tools/schema-browser-link.js`

#### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-SB-F-001 | Click link | Opens Schema Browser in new tab | - |
| U-SB-F-002 | Connection ID passed | Correct connection context | - |

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| U-SB-I-001 | No active connection | Link disabled or error | - |

---

## 7. Record Viewer

**Source:** `src/components/record/record-page.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| RV-F-001 | Load record data | All fields displayed | `record/view-record.test.ts` |
| RV-F-002 | Fields sorted correctly | Id first, Name second, alphabetical | `record/view-record.test.ts` |
| RV-F-003 | Display field label | Human-readable label shown | `record/view-record.test.ts` |
| RV-F-004 | Display API name | Developer name shown | `record/record-field-types.test.ts` |
| RV-F-005 | Display field type | Type indicator shown | `record/view-record.test.ts` |
| RV-F-006 | Display field value | Current value displayed | `record/record-field-types.test.ts` |
| RV-F-007 | Edit text field | Input accepts text | `record/edit-record.test.ts` |
| RV-F-008 | Edit picklist field | Dropdown with options | - |
| RV-F-009 | View boolean field | Checkbox visual | - |
| RV-F-010 | View date field | Formatted date | - |
| RV-F-011 | View datetime field | Formatted datetime | - |
| RV-F-012 | View reference field | Link to related record | - |
| RV-F-013 | View rich text field | Preview button | - |
| RV-F-014 | Click Preview for rich text | Modal with HTML | - |
| RV-F-015 | Save modified fields | PATCH request, success | `record/edit-record.test.ts` |
| RV-F-016 | Refresh record | Data reloaded | `record/record-refresh.test.ts` |
| RV-F-017 | Open in Salesforce | New tab with record | - |
| RV-F-018 | Change counter updates | Shows modified count | - |
| RV-F-019 | Modified fields highlighted | Visual distinction | `record/edit-record.test.ts` |
| RV-F-020 | Missing URL parameters | Error message | - |
| RV-F-021 | Connection not found | Error message | - |
| RV-F-022 | CORS error | Modal with proxy prompt | - |
| RV-F-023 | Rich text XSS attempt | Content sanitized (DOMPurify) | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| RV-I-003 | Record not found | Error message | `tests/integration/record-viewer.test.js:28` |
| RV-I-004 | Save failure | Error message displayed | `tests/integration/record-viewer.test.js:65` |
| RV-I-005 | Fetch record with all fields | All field data returned | `tests/integration/record-viewer.test.js:154` |
| RV-I-006 | Fetch record with specific fields | Only requested fields returned | `tests/integration/record-viewer.test.js:169` |
| RV-I-007 | Fetch object describe | Field metadata returned | `tests/integration/record-viewer.test.js:185` |
| RV-I-008 | Update single field | Field updated successfully | `tests/integration/record-viewer.test.js:204` |
| RV-I-009 | Update multiple fields | All fields updated successfully | `tests/integration/record-viewer.test.js:217` |
| RV-I-010 | Handle null field values | Null values cleared successfully | `tests/integration/record-viewer.test.js:234` |
| RV-I-011 | Handle boolean field values | Boolean values updated correctly | `tests/integration/record-viewer.test.js:249` |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| RV-U-001 | `sortFields()` | Id first | `lib/record-utils.test.js` |
| RV-U-002 | `sortFields()` | Name second | `lib/record-utils.test.js` |
| RV-U-003 | `sortFields()` | Alphabetical after | `lib/record-utils.test.js` |
| RV-U-004 | `filterFields()` | Excludes address type | `lib/record-utils.test.js` |
| RV-U-005 | `filterFields()` | Excludes location type | `lib/record-utils.test.js` |
| RV-U-006 | `formatValue()` | Formats boolean | `lib/record-utils.test.js` |
| RV-U-007 | `formatValue()` | Formats date | `lib/record-utils.test.js` |
| RV-U-008 | `formatValue()` | Handles null | `lib/record-utils.test.js` |
| RV-U-009 | `formatPreviewHtml()` | Creates reference link | `lib/record-utils.test.js` |
| RV-U-010 | `formatPreviewHtml()` | Creates preview button for rich text | `lib/record-utils.test.js` |
| RV-U-011 | `parseValue()` | Parses string to boolean | `lib/record-utils.test.js` |
| RV-U-012 | `parseValue()` | Parses string to number | `lib/record-utils.test.js` |
| RV-U-013 | `getChangedFields()` | Returns only modified | `lib/record-utils.test.js` |
| RV-U-014 | `sortFields()` | Sorts Id field first | `lib/record-utils.test.js` |
| RV-U-015 | `sortFields()` | Sorts Name field second | `lib/record-utils.test.js` |
| RV-U-016 | `sortFields()` | Sorts remaining fields alphabetically | `lib/record-utils.test.js` |
| RV-U-017 | `sortFields()` | Handles missing Id field | `lib/record-utils.test.js` |
| RV-U-018 | `sortFields()` | Handles missing Name field | `lib/record-utils.test.js` |
| RV-U-019 | `filterFields()` | Excludes address type fields | `lib/record-utils.test.js` |
| RV-U-020 | `filterFields()` | Excludes location type fields | `lib/record-utils.test.js` |
| RV-U-021 | `filterFields()` | Includes standard field types | `lib/record-utils.test.js` |
| RV-U-022 | `formatValue()` | Formats boolean true as "true" | `lib/record-utils.test.js` |
| RV-U-023 | `formatValue()` | Formats boolean false as "false" | `lib/record-utils.test.js` |
| RV-U-024 | `formatValue()` | Formats datetime with timezone | `lib/record-utils.test.js` |
| RV-U-025 | `formatValue()` | Formats date YYYY-MM-DD | `lib/record-utils.test.js` |
| RV-U-026 | `formatValue()` | Formats null as empty string | `lib/record-utils.test.js` |
| RV-U-027 | `formatValue()` | Preserves string values | `lib/record-utils.test.js` |
| RV-U-028 | `formatPreviewHtml()` | Creates reference link for lookup fields | `lib/record-utils.test.js` |
| RV-U-029 | `formatPreviewHtml()` | Creates preview button for rich text | `lib/record-utils.test.js` |
| RV-U-030 | `formatPreviewHtml()` | Returns plain value for other types | `lib/record-utils.test.js` |
| RV-U-031 | `parseValue()` | Parses "true" to boolean true | `lib/record-utils.test.js` |
| RV-U-032 | `parseValue()` | Parses "false" to boolean false | `lib/record-utils.test.js` |
| RV-U-033 | `parseValue()` | Parses numeric strings to numbers | `lib/record-utils.test.js` |
| RV-U-034 | `parseValue()` | Preserves regular strings | `lib/record-utils.test.js` |
| RV-U-035 | `getChangedFields()` | Returns fields with modified values | `lib/record-utils.test.js` |
| RV-U-036 | `getChangedFields()` | Excludes unchanged fields | `lib/record-utils.test.js` |
| RV-U-037 | `getChangedFields()` | Handles boolean changes | `lib/record-utils.test.js` |
| RV-U-038 | `getChangedFields()` | Handles null values | `lib/record-utils.test.js` |
| RV-U-039 | `getChangedFields()` | Returns empty object when no changes | `lib/record-utils.test.js` |

---

## 8. Schema Browser

**Source:** `src/components/schema/schema-page.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| SB-F-001 | Load all objects | Object list populated | `schema/browse-schema.test.ts` |
| SB-F-002 | Filter objects by name | Matching objects shown | `schema/browse-schema.test.ts` |
| SB-F-003 | Filter objects by label | Matching objects shown | - |
| SB-F-004 | Select object | Field panel opens | `schema/browse-schema.test.ts` |
| SB-F-005 | Filter fields | Matching fields shown | `schema/browse-schema.test.ts` |
| SB-F-006 | Display field type | Type shown with indicators | - |
| SB-F-007 | Formula field indicator | "Formula" tag shown | - |
| SB-F-008 | Rollup field indicator | "Rollup" tag shown | - |
| SB-F-009 | Reference field link | Clickable to related object | - |
| SB-F-010 | Click reference link | Navigates to object | - |
| SB-F-011 | Edit formula (hover menu) | Triple-dot button visible | - |
| SB-F-012 | Open formula editor | Monaco editor with formula | - |
| SB-F-013 | Formula autocomplete | Field suggestions work | - |
| SB-F-014 | Save formula | Tooling API update | - |
| SB-F-015 | Cancel formula edit | Modal closes, no change | - |
| SB-F-016 | Refresh objects list | List reloaded | - |
| SB-F-017 | Refresh fields list | Fields reloaded | - |
| SB-F-018 | Close fields panel | Panel closes | - |
| SB-F-019 | Connection not found | Error message | - |
| SB-F-020 | CORS error | Modal with proxy prompt | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| SB-I-002 | Object describe error | Error message | `tests/integration/schema-browser.test.js:21` |
| SB-I-003 | Formula field not found | Error message | `tests/integration/schema-browser.test.js:57` |
| SB-I-004 | Save formula error | Error displayed | `tests/integration/schema-browser.test.js:119` |
| SB-I-005 | Describe standard object | Object and field metadata returned | `tests/integration/schema-browser.test.js:222` |
| SB-I-006 | Query CustomField records | Returns custom field list | `tests/integration/schema-browser.test.js:231` |
| SB-I-007 | Get field metadata from describe | Field label, type returned | `tests/integration/schema-browser.test.js:240` |
| SB-I-008 | Identify formula fields | Formula fields marked as calculated | `tests/integration/schema-browser.test.js:249` |
| SB-I-009 | Get global describe | All org objects returned | `tests/integration/schema-browser.test.js:260` |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| SB-U-001 | `filterObjects()` | Filters by API name | `lib/schema-utils.test.js` |
| SB-U-002 | `filterObjects()` | Filters by label | `lib/schema-utils.test.js` |
| SB-U-003 | `filterObjects()` | Case insensitive | `lib/schema-utils.test.js` |
| SB-U-004 | `filterFields()` | Filters by API name | `lib/schema-utils.test.js` |
| SB-U-005 | `filterFields()` | Filters by label | `lib/schema-utils.test.js` |
| SB-U-006 | `getFieldTypeDisplay()` | Returns "Formula" for calculated | `lib/schema-utils.test.js` |
| SB-U-007 | `getFieldTypeDisplay()` | Returns type name | `lib/schema-utils.test.js` |
| SB-U-008 | `buildFieldSuggestions()` | Creates Monaco completions for object fields | `lib/schema-utils.test.js` |
| SB-U-009 | `buildFieldSuggestions()` | Filters fields by prefix | `lib/schema-utils.test.js` |
| SB-U-010 | `buildFieldSuggestions()` | Includes field labels in details | `lib/schema-utils.test.js` |
| SB-U-011 | `buildFieldSuggestions()` | Handles empty field list | `lib/schema-utils.test.js` |
| SB-U-012 | `filterObjects()` | Filters by object API name | `lib/schema-utils.test.js` |
| SB-U-013 | `filterObjects()` | Filters by object label | `lib/schema-utils.test.js` |
| SB-U-014 | `filterObjects()` | Case-insensitive search | `lib/schema-utils.test.js` |
| SB-U-015 | `filterFields()` | Filters by field API name | `lib/schema-utils.test.js` |
| SB-U-016 | `filterFields()` | Filters by field label | `lib/schema-utils.test.js` |
| SB-U-017 | `filterFields()` | Case-insensitive search | `lib/schema-utils.test.js` |
| SB-U-018 | `getFieldTypeDisplay()` | Returns "Formula" for calculated fields | `lib/schema-utils.test.js` |
| SB-U-019 | `getFieldTypeDisplay()` | Returns actual type name for non-calculated | `lib/schema-utils.test.js` |
| SB-U-020 | `loadRelationshipFields()` | Loads related object fields for autocomplete | `lib/schema-utils.test.js` |

---

## 9. Monaco Editor Component

**Source:** `src/components/monaco-editor/monaco-editor.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| ME-F-001 | Set language to JSON | JSON syntax highlighting | - |
| ME-F-002 | Set language to SQL | SQL syntax highlighting | - |
| ME-F-003 | Set language to Apex | Apex syntax highlighting | - |
| ME-F-004 | Get editor value | Returns current content | - |
| ME-F-005 | Set editor value | Content updated | - |
| ME-F-006 | Read-only mode | Content not editable | - |
| ME-F-007 | Ctrl/Cmd+Enter fires execute | Event dispatched | - |
| ME-F-008 | Append value | Text added at end | - |
| ME-F-009 | Scroll to bottom on append | Editor scrolls down | - |
| ME-F-010 | Set error markers | Red squiggles appear | - |
| ME-F-011 | Clear markers | Squiggles removed | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| ME-I-001 | Editor not initialized | Methods handle gracefully | - |
| ME-I-002 | Multiple editors on page | Each independent | - |

---

## 10. App Shell & Navigation

**Source:** `src/pages/app/app.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| AS-F-001 | App loads | Theme initialized, tabs visible | - |
| AS-F-002 | Click tab | Tab content shown | - |
| AS-F-003 | Mobile menu toggle | Menu opens/closes | - |
| AS-F-004 | Responsive nav overflow | "More" dropdown appears | - |
| AS-F-005 | Click tab in overflow | Tab activates | - |
| AS-F-006 | Open Org button | Salesforce opens in new tab | - |
| AS-F-007 | Open in Tab button | sftools opens in new tab | - |
| AS-F-008 | Connection selector | Dropdown shows connections | - |
| AS-F-009 | Switch connection | Active connection changes | - |
| AS-F-010 | Remove connection via selector | Connection removed | - |
| AS-F-011 | Add connection from selector | OAuth flow starts | - |
| AS-F-012 | Events tab disabled without proxy | Overlay shown | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| AS-I-001 | No connections on startup | Authorize prompt | - |
| AS-I-002 | Active connection removed | Another selected | - |
| AS-I-003 | Auth expiration | Modal prompts re-auth | - |
| AS-I-004 | Storage change from other tab | UI updates | - |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| AS-U-001.1 | `startAuthorization()` | Opens OAuth URL in new tab | `lib/app-utils.test.js` |
| AS-U-001.2 | `startAuthorization()` | Uses pending auth params if available | `lib/app-utils.test.js` |
| AS-U-001.3 | `startAuthorization()` | Falls back to detecting login domain | `lib/app-utils.test.js` |
| AS-U-001.4 | `startAuthorization()` | Uses manifest default client ID | `lib/app-utils.test.js` |
| AS-U-001.5 | `startAuthorization()` | Includes state parameter | `lib/app-utils.test.js` |
| AS-U-002.1 | `detectLoginDomain()` | Returns login.salesforce.com for prod | `lib/app-utils.test.js` |
| AS-U-002.2 | `detectLoginDomain()` | Returns test.salesforce.com for sandbox | `lib/app-utils.test.js` |
| AS-U-002.3 | `detectLoginDomain()` | Handles custom domains | `lib/app-utils.test.js` |
| AS-U-003.1 | `selectConnection()` | Sets active connection ID | `lib/app-utils.test.js` |
| AS-U-003.2 | `selectConnection()` | Updates lastUsedAt timestamp | `lib/app-utils.test.js` |
| AS-U-003.3 | `selectConnection()` | Dispatches connection-changed event | `lib/app-utils.test.js` |
| AS-U-004.1 | `updateFeatureGating()` | Disables Events tab without proxy | `lib/app-utils.test.js` |
| AS-U-004.2 | `updateFeatureGating()` | Enables Events tab with proxy | `lib/app-utils.test.js` |
| AS-U-005.1 | `updateConnectionGating()` | Disables tabs without connection | `lib/app-utils.test.js` |
| AS-U-005.2 | `updateConnectionGating()` | Enables tabs with connection | `lib/app-utils.test.js` |

---

## 11. OAuth & Authentication

**Source:** `src/pages/callback/callback.js`, `src/lib/auth.js`

### Frontend Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| OA-F-001 | Authorization code flow | Tokens exchanged, connection saved | - |
| OA-F-002 | Implicit flow | Token from hash, connection saved | - |
| OA-F-003 | OAuth error response | Error displayed | - |
| OA-F-004 | Tab auto-closes on success | Window closes | - |

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| OA-I-001 | Valid state parameter | Proceeds normally | - |
| OA-I-002 | Invalid state parameter (CSRF) | Error displayed | - |
| OA-I-003 | Expired state parameter | Error displayed | - |
| OA-I-004 | Token exchange failure | Error displayed | - |
| OA-I-005 | Missing authorization response | Error displayed | - |
| OA-I-006 | Create new connection | Added to storage | - |
| OA-I-007 | Update existing connection (re-auth) | Tokens updated | - |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| OA-U-001 | `deriveLoginDomain()` | Extracts login.salesforce.com | `lib/auth.test.js` |
| OA-U-002 | `deriveLoginDomain()` | Extracts test.salesforce.com | `lib/auth.test.js` |
| OA-U-003 | `deriveLoginDomain()` | Handles custom domains | `lib/auth.test.js` |
| OA-U-004 | `addOrUpdateConnection()` | Creates new if not exists | `lib/auth.test.js` |
| OA-U-005 | `addOrUpdateConnection()` | Updates if connectionId matches | `lib/auth.test.js` |
| OA-U-006 | `generateOAuthState()` | Creates unique state | `lib/auth.test.js` |
| OA-U-007 | `validateOAuthState()` | Returns true for valid | `lib/auth.test.js` |
| OA-U-008 | `validateOAuthState()` | Returns false for invalid | `lib/auth.test.js` |
| OA-U-009 | `setPendingAuth()` | Stores auth params | `lib/auth.test.js` |
| OA-U-010 | `consumePendingAuth()` | Returns and clears params | `lib/auth.test.js` |
| OA-U-011 | `migrateFromSingleConnection()` | Converts old format | `lib/auth.test.js` |
| OA-U-012 | `migrateCustomConnectedApp()` | Migrates app config | `lib/auth.test.js` |
| OA-U-013 | `addOrUpdateConnection()` | Creates new connection when connectionId is null | `lib/auth.test.js` |
| OA-U-014 | `addOrUpdateConnection()` | Updates existing connection by connectionId | `lib/auth.test.js` |
| OA-U-015 | `deriveLoginDomain()` | Derives login domain from instance URL | `lib/auth.test.js` |

---

## 12. Background Service Worker

**Source:** `src/background/background.js`, `src/background/auth.js`, `src/background/native-messaging.js`

### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| BG-I-001 | Extension fetch with valid auth | Request succeeds | - |
| BG-I-002 | Extension fetch with 401 | Token refreshed, retry | - |
| BG-I-003 | Token refresh failure | Auth expiration event | - |
| BG-I-004 | Connect to native proxy | Connection established | - |
| BG-I-005 | Disconnect from proxy | Connection closed | - |
| BG-I-006 | Check proxy connection | Status returned | - |
| BG-I-007 | Token exchange via proxy | Tokens returned | - |
| BG-I-008 | Proxy fetch request | Request via native host | - |
| BG-I-009 | Subscribe message routing | Forwarded to proxy | - |
| BG-I-010 | Unsubscribe message routing | Forwarded to proxy | - |
| BG-I-011 | Streaming event forwarding | Events sent to pages | - |

### Context Menu Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| BG-CM-001 | "View/Edit Record" on record page | Record Viewer opens | - |
| BG-CM-002 | Parse Lightning URL | Extracts objectType, recordId | - |
| BG-CM-003 | Find connection by domain | Matches saved connection | - |
| BG-CM-004 | Context menu on non-record page | Record Viewer with error | - |
| BG-CM-005 | No matching connection | Record Viewer with error | - |

### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| BG-U-001 | `parseLightningUrl()` | Extracts from /r/Account/001.../view | `lib/background-utils.test.js` |
| BG-U-002 | `parseLightningUrl()` | Returns null for invalid | `lib/background-utils.test.js` |
| BG-U-003 | `extractOrgIdentifier()` | Extracts sandbox identifier | `lib/background-utils.test.js` |
| BG-U-004 | `extractOrgIdentifier()` | Extracts scratch org identifier | `lib/background-utils.test.js` |
| BG-U-005 | `extractOrgIdentifier()` | Handles trailhead orgs | `lib/background-utils.test.js` |
| BG-U-006 | `findConnectionByDomain()` | Matches by domain | `lib/background-utils.test.js` |
| BG-U-007 | `findConnectionByDomain()` | Returns null if no match | `lib/background-utils.test.js` |
| BG-U-008 | `extractOrgIdentifier()` | Extracts sandbox identifier | `lib/background-utils.test.js` |
| BG-U-009 | `extractOrgIdentifier()` | Extracts scratch org identifier | `lib/background-utils.test.js` |
| BG-U-010 | `extractOrgIdentifier()` | Handles trailhead orgs | `lib/background-utils.test.js` |
| BG-U-011 | `extractOrgIdentifier()` | Returns domain for production orgs | `lib/background-utils.test.js` |
| BG-U-012 | `findConnectionByDomain()` | Matches by org identifier | `lib/background-utils.test.js` |
| BG-U-013 | `findConnectionByDomain()` | Matches by full domain | `lib/background-utils.test.js` |
| BG-U-014 | `findConnectionByDomain()` | Returns null for no match | `lib/background-utils.test.js` |
| BG-U-015 | `parseLightningUrl()` | Extracts objectType and recordId from Lightning URL | `lib/background-utils.test.js` |
| BG-U-016 | `parseLightningUrl()` | Returns null for non-record URLs | `lib/background-utils.test.js` |
| BG-U-017 | `parseLightningUrl()` | Handles URL with query params | `lib/background-utils.test.js` |
| BG-U-008 | `proxyRequired()` | Rejects if not connected | - |
| BG-U-009 | `fetchWithRetry()` | Retries on 401 | - |
| BG-U-010 | `handle401WithRefresh()` | Refreshes and retries | - |
| BG-U-011 | `exchangeCodeForTokens()` | Returns tokens | - |
| BG-U-012 | `refreshAccessToken()` | Returns new token | - |
| BG-U-013 | `updateConnectionToken()` | Updates storage | - |
| BG-U-014 | `connectNative()` | Establishes connection | - |
| BG-U-015 | `sendProxyRequest()` | Sends via native port | - |
| BG-U-016 | `isProxyConnected()` | Returns connection status | - |

---

## 13. Library Utilities

### 13.1 Salesforce API (`src/lib/salesforce.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| SF-U-001 | `getCurrentUserId()` | Returns user ID | `lib/salesforce.test.js` |
| SF-U-002 | `executeAnonymousApex()` | Returns execution result | `lib/salesforce.test.js` |
| SF-U-003 | `executeQueryWithColumns()` | Returns columns and records | `lib/salesforce.test.js` |
| SF-U-004 | `getGlobalDescribe()` | Returns cached on second call | `lib/salesforce.test.js` |
| SF-U-005 | `getObjectDescribe()` | Returns cached on second call | `lib/salesforce.test.js` |
| SF-U-006 | `getRecord()` | Returns record data | `lib/salesforce.test.js` |
| SF-U-007 | `updateRecord()` | Sends PATCH request | `lib/salesforce.test.js` |
| SF-U-008 | `executeRestRequest()` | Makes authenticated request | `lib/salesforce.test.js` |
| SF-U-009 | `getEventChannels()` | Returns Platform Events | `lib/salesforce.test.js` |
| SF-U-010 | `getPushTopics()` | Returns PushTopics | `lib/salesforce.test.js` |
| SF-U-011 | `publishPlatformEvent()` | Publishes event | `lib/salesforce.test.js` |
| SF-U-012 | `deleteAllDebugLogs()` | Deletes ApexLog records | `lib/salesforce.test.js` |
| SF-U-013 | `searchUsers()` | Searches by name/username | `lib/salesforce.test.js` |
| SF-U-014 | `enableTraceFlagForUser()` | Creates TraceFlag | `lib/salesforce.test.js` |
| SF-U-015 | `searchFlows()` | Searches FlowDefinition | `lib/salesforce.test.js` |
| SF-U-016 | `getFlowVersions()` | Returns Flow versions | `lib/salesforce.test.js` |
| SF-U-017 | `deleteInactiveFlowVersions()` | Composite delete | `lib/salesforce.test.js` |
| SF-U-018 | `createBulkQueryJob()` | Creates Bulk API job | `lib/salesforce.test.js` |
| SF-U-019 | `getBulkQueryJobStatus()` | Returns job status | `lib/salesforce.test.js` |
| SF-U-020 | `executeBulkQueryExport()` | Full export flow | `lib/salesforce.test.js` |
| SF-U-021 | `getFormulaFieldMetadata()` | Returns formula metadata | `lib/salesforce.test.js` |
| SF-U-022 | `updateFormulaField()` | Updates via Tooling API | `lib/salesforce.test.js` |
| SF-U-023 | `bulkDeleteTooling()` | Batches in 25s | `lib/salesforce.test.js` |
| SF-U-024 | `escapeSoql()` | Escapes special chars | `lib/salesforce.test.js` |
| SF-U-025 | `clearDescribeCache()` | Clears cache | `lib/salesforce.test.js` |

### 13.2 SOQL Autocomplete (`src/lib/soql-autocomplete.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| SA-U-001 | `parseSOQL()` | Parses valid query | `lib/soql-autocomplete.test.js` |
| SA-U-002 | `parseSOQL()` | Handles invalid query | `lib/soql-autocomplete.test.js` |
| SA-U-003 | `extractFromObject()` | Extracts FROM object | `lib/soql-autocomplete.test.js` |
| SA-U-004 | `detectClause()` | Detects SELECT clause | `lib/soql-autocomplete.test.js` |
| SA-U-005 | `detectClause()` | Detects WHERE clause | `lib/soql-autocomplete.test.js` |
| SA-U-006 | `extractDotChain()` | Extracts Account.Owner | `lib/soql-autocomplete.test.js` |
| SA-U-007 | `resolveRelationshipChain()` | Resolves to User | `lib/soql-autocomplete.test.js` |
| SA-U-008 | `buildFieldSuggestions()` | Creates completions | `lib/soql-autocomplete.test.js` |
| SA-U-009 | `buildObjectSuggestions()` | Creates object list | `lib/soql-autocomplete.test.js` |
| SA-U-010 | `buildKeywordSuggestions()` | Returns clause keywords | `lib/soql-autocomplete.test.js` |
| SA-U-011 | `buildAggregateSuggestions()` | Returns COUNT, SUM, etc. | `lib/soql-autocomplete.test.js` |
| SA-U-012 | `buildDateLiteralSuggestions()` | Returns TODAY, LAST_WEEK, etc. | `lib/soql-autocomplete.test.js` |

### 13.3 History Manager (`src/lib/history-manager.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| HM-U-001 | `load()` | Loads from storage | `lib/history-manager.test.js` |
| HM-U-002 | `saveToHistory()` | Adds to history | `lib/history-manager.test.js` |
| HM-U-003 | `saveToHistory()` | Deduplicates | `lib/history-manager.test.js` |
| HM-U-004 | `saveToHistory()` | Trims to max size | `lib/history-manager.test.js` |
| HM-U-005 | `addToFavorites()` | Adds with label | `lib/history-manager.test.js` |
| HM-U-006 | `removeFromHistory()` | Removes by ID | `lib/history-manager.test.js` |
| HM-U-007 | `removeFromFavorites()` | Removes by ID | `lib/history-manager.test.js` |
| HM-U-008 | `getPreview()` | Truncates content | `lib/history-manager.test.js` |
| HM-U-009 | `formatRelativeTime()` | Returns "2 hours ago" | `lib/history-manager.test.js` |
| HM-U-010 | `HistoryManager.constructor()` | Initializes with empty arrays | `lib/history-manager.test.js` |
| HM-U-011 | `load()` | Loads history and favorites from storage | `lib/history-manager.test.js` |
| HM-U-012 | `load()` | Handles missing storage data | `lib/history-manager.test.js` |
| HM-U-013 | `save()` | Persists history and favorites to storage | `lib/history-manager.test.js` |
| HM-U-014 | `saveToHistory()` | Adds entry to history | `lib/history-manager.test.js` |
| HM-U-015 | `saveToHistory()` | Deduplicates by normalized content | `lib/history-manager.test.js` |
| HM-U-016 | `saveToHistory()` | Trims history to maxSize | `lib/history-manager.test.js` |
| HM-U-017 | `saveToHistory()` | Updates timestamp on duplicate | `lib/history-manager.test.js` |
| HM-U-018 | `addToFavorites()` | Adds entry with label | `lib/history-manager.test.js` |
| HM-U-019 | `addToFavorites()` | Deduplicates by normalized content | `lib/history-manager.test.js` |
| HM-U-020 | `addToFavorites()` | Generates ID automatically | `lib/history-manager.test.js` |
| HM-U-021 | `removeFromHistory()` | Removes by ID | `lib/history-manager.test.js` |
| HM-U-022 | `removeFromHistory()` | Persists after removal | `lib/history-manager.test.js` |
| HM-U-023 | `removeFromFavorites()` | Removes by ID | `lib/history-manager.test.js` |
| HM-U-024 | `removeFromFavorites()` | Persists after removal | `lib/history-manager.test.js` |
| HM-U-025 | `getHistory()` | Returns history array | `lib/history-manager.test.js` |
| HM-U-026 | `getFavorites()` | Returns favorites array | `lib/history-manager.test.js` |
| HM-U-027 | `getPreview()` | Returns first 50 chars | `lib/history-manager.test.js` |
| HM-U-028 | `getPreview()` | Truncates with ellipsis | `lib/history-manager.test.js` |
| HM-U-029 | `getPreview()` | Handles short content | `lib/history-manager.test.js` |
| HM-U-030 | `formatRelativeTime()` | Returns "just now" for < 1 min | `lib/history-manager.test.js` |
| HM-U-031 | `formatRelativeTime()` | Returns "X minutes ago" | `lib/history-manager.test.js` |
| HM-U-032 | `formatRelativeTime()` | Returns "X hours ago" | `lib/history-manager.test.js` |
| HM-U-033 | `formatRelativeTime()` | Returns "X days ago" | `lib/history-manager.test.js` |
| HM-U-034 | `formatRelativeTime()` | Returns "X months ago" | `lib/history-manager.test.js` |
| HM-U-035 | `formatRelativeTime()` | Returns "X years ago" | `lib/history-manager.test.js` |
| HM-U-036 | `formatRelativeTime()` | Handles singular vs plural | `lib/history-manager.test.js` |
| HM-U-037 | `normalize()` | Trims whitespace | `lib/history-manager.test.js` |
| HM-U-038 | `normalize()` | Converts to lowercase | `lib/history-manager.test.js` |
| HM-U-039 | `normalize()` | Collapses multiple spaces | `lib/history-manager.test.js` |

### 13.4 Fetch Utilities (`src/lib/fetch.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| FE-U-001 | `isProxyConnected()` | Returns cached status | `lib/fetch.test.js` |
| FE-U-002 | `checkProxyStatus()` | Queries background | `lib/fetch.test.js` |
| FE-U-003 | `extensionFetch()` | Routes via background | `lib/fetch.test.js` |
| FE-U-004 | `proxyFetch()` | Routes via proxy | `lib/fetch.test.js` |
| FE-U-005 | `smartFetch()` | Uses proxy if connected | `lib/fetch.test.js` |
| FE-U-006 | `smartFetch()` | Falls back to extension | `lib/fetch.test.js` |
| FE-U-007 | `isProxyConnected()` | Returns cached proxy connection status | `lib/fetch.test.js` |
| FE-U-008 | `checkProxyStatus()` | Queries background for proxy status | `lib/fetch.test.js` |
| FE-U-009 | `extensionFetch()` | Routes request via background service worker | `lib/fetch.test.js` |
| FE-U-010 | `proxyFetch()` | Routes request via native proxy | `lib/fetch.test.js` |
| FE-U-011 | `smartFetch()` | Uses proxy when connected | `lib/fetch.test.js` |
| FE-U-012 | `smartFetch()` | Falls back to extension when proxy not connected | `lib/fetch.test.js` |
| FE-U-013 | `smartFetch()` | Passes through fetch options | `lib/fetch.test.js` |

### 13.5 Other Utilities

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| UT-U-003 | `initTheme()` | Applies stored theme | `lib/theme.test.js` |
| UT-U-004 | `setTheme()` | Updates storage and DOM (via applyTheme) | `lib/theme.test.js` |
| UT-U-005 | `isCorsError()` | Detects status 0 | `lib/cors-detection.test.js` |
| UT-U-006 | `showCorsErrorModal()` | Dispatches event | `lib/cors-detection.test.js` |
| UT-U-007 | `getOAuthCredentials()` | Returns connection client ID | `lib/oauth-credentials.test.js` |
| UT-U-008 | `getOAuthCredentials()` | Returns manifest default | `lib/oauth-credentials.test.js` |
| UT-U-009 | `salesforceRequest()` | Builds correct URL | `lib/salesforce-request.test.js` |
| UT-U-010 | `updateStatusBadge()` | Updates badge element | `lib/ui-helpers.test.js` |
| UT-U-011 | `replaceIcons()` | Replaces placeholders with SVG icons | `lib/icons.test.js` |
| UT-U-012 | `getOAuthCredentials()` | Handles empty connections array | `lib/oauth-credentials.test.js` |
| UT-U-013 | `getOAuthCredentials()` | Handles missing connections in storage | `lib/oauth-credentials.test.js` |
| UT-U-014 | `getOAuthCredentials()` | Finds correct connection among multiple connections | `lib/oauth-credentials.test.js` |
| UT-U-015 | `getOAuthCredentials()` | Returns isCustom false for manifest default, true for connection clientId | `lib/oauth-credentials.test.js` |
| UT-U-016 | `escapeHtml()` | Does not escape quotes (use escapeAttr for attributes) | `lib/text-utils.test.js` |
| UT-U-017 | `escapeHtml()` | Handles combined special characters | `lib/text-utils.test.js` |
| UT-U-018 | `escapeHtml()` | Returns empty string for null | `lib/text-utils.test.js` |
| UT-U-019 | `escapeHtml()` | Returns empty string for undefined | `lib/text-utils.test.js` |
| UT-U-020 | `escapeHtml()` | Returns empty string for empty string | `lib/text-utils.test.js` |
| UT-U-021 | `escapeHtml()` | Preserves safe strings unchanged | `lib/text-utils.test.js` |
| UT-U-022 | `escapeAttr()` | Escapes ampersand | `lib/text-utils.test.js` |
| UT-U-023 | `escapeAttr()` | Escapes angle brackets | `lib/text-utils.test.js` |
| UT-U-024 | `escapeAttr()` | Returns empty string for null | `lib/text-utils.test.js` |
| UT-U-025 | `escapeAttr()` | Returns empty string for undefined | `lib/text-utils.test.js` |
| UT-U-026 | `escapeAttr()` | Preserves safe strings unchanged | `lib/text-utils.test.js` |
| UT-U-027 | `truncate()` | Returns original string when shorter than limit | `lib/text-utils.test.js` |
| UT-U-028 | `truncate()` | Returns original string when equal to limit | `lib/text-utils.test.js` |
| UT-U-029 | `truncate()` | Truncates and adds ellipsis when longer than limit | `lib/text-utils.test.js` |
| UT-U-030 | `truncate()` | Returns empty string for null | `lib/text-utils.test.js` |
| UT-U-031 | `truncate()` | Returns empty string for undefined | `lib/text-utils.test.js` |
| UT-U-032 | `truncate()` | Returns empty string for empty string | `lib/text-utils.test.js` |
| UT-U-033 | `truncate()` | Truncates at exact position | `lib/text-utils.test.js` |
| UT-U-036 | `salesforceRequest()` | Builds correct URL from instanceUrl and endpoint | `lib/salesforce-request.test.js` |
| UT-U-037 | `salesforceRequest()` | Includes Authorization Bearer header | `lib/salesforce-request.test.js` |
| UT-U-038 | `salesforceRequest()` | Includes Content-Type and Accept headers | `lib/salesforce-request.test.js` |
| UT-U-039 | `salesforceRequest()` | Merges custom headers with defaults | `lib/salesforce-request.test.js` |
| UT-U-040 | `salesforceRequest()` | Uses GET method by default | `lib/salesforce-request.test.js` |
| UT-U-041 | `salesforceRequest()` | Passes method and body from options | `lib/salesforce-request.test.js` |
| UT-U-042 | `salesforceRequest()` | Parses JSON response | `lib/salesforce-request.test.js` |
| UT-U-043 | `salesforceRequest()` | Handles 200 response successfully | `lib/salesforce-request.test.js` |
| UT-U-044 | `salesforceRequest()` | Handles 404 response without throwing | `lib/salesforce-request.test.js` |
| UT-U-045 | `salesforceRequest()` | Returns null json when data is empty | `lib/salesforce-request.test.js` |
| UT-U-046 | `salesforceRequest()` | Throws on CORS error and calls showCorsErrorModal | `lib/salesforce-request.test.js` |
| UT-U-047 | `salesforceRequest()` | Triggers authExpired on 401 without authExpired flag | `lib/salesforce-request.test.js` |
| UT-U-048 | `salesforceRequest()` | Does not trigger authExpired when authExpired flag already set | `lib/salesforce-request.test.js` |
| UT-U-049 | `salesforceRequest()` | Extracts error from response.error | `lib/salesforce-request.test.js` |
| UT-U-050 | `salesforceRequest()` | Extracts error from Salesforce array format [{ message }] | `lib/salesforce-request.test.js` |
| UT-U-051 | `salesforceRequest()` | Extracts error from Salesforce object format { message } | `lib/salesforce-request.test.js` |
| UT-U-052 | `salesforceRequest()` | Uses statusText when data is null | `lib/salesforce-request.test.js` |
| UT-U-053 | `salesforceRequest()` | Falls back to Request failed when data is empty object | `lib/salesforce-request.test.js` |
| UT-U-054 | `salesforceRequest()` | Defaults to "Request failed" when no message available | `lib/salesforce-request.test.js` |
| UT-U-055 | `salesforceRequest()` | Uses statusText from empty data response | `lib/salesforce-request.test.js` |
| UT-U-056 | `isCorsError()` | Returns true for status 0 with "failed to fetch" error | `lib/cors-detection.test.js` |
| UT-U-057 | `isCorsError()` | Returns true for error containing "cors" keyword | `lib/cors-detection.test.js` |
| UT-U-058 | `isCorsError()` | Returns true for error containing "cross-origin" keyword | `lib/cors-detection.test.js` |
| UT-U-059 | `isCorsError()` | Returns true for error containing "access-control" keyword | `lib/cors-detection.test.js` |
| UT-U-060 | `isCorsError()` | Is case-insensitive for keyword detection | `lib/cors-detection.test.js` |
| UT-U-061 | `isCorsError()` | Returns false for successful responses | `lib/cors-detection.test.js` |
| UT-U-062 | `isCorsError()` | Returns false for 401 Unauthorized errors | `lib/cors-detection.test.js` |
| UT-U-063 | `isCorsError()` | Returns false for 500 server errors without CORS keywords | `lib/cors-detection.test.js` |
| UT-U-064 | `isCorsError()` | Returns false for 404 not found errors | `lib/cors-detection.test.js` |
| UT-U-065 | `isCorsError()` | Handles missing error property gracefully | `lib/cors-detection.test.js` |
| UT-U-066 | `isCorsError()` | Handles null error property gracefully | `lib/cors-detection.test.js` |
| UT-U-067 | `isCorsError()` | Requires both status 0 and "failed to fetch" for network error detection | `lib/cors-detection.test.js` |
| UT-U-068 | `updateStatusBadge()` | Sets element text content to message | `lib/ui-helpers.test.js` |
| UT-U-069 | `updateStatusBadge()` | Sets base class to status-badge | `lib/ui-helpers.test.js` |
| UT-U-070 | `updateStatusBadge()` | Adds status-loading class for loading type | `lib/ui-helpers.test.js` |
| UT-U-071 | `updateStatusBadge()` | Adds status-success class for success type | `lib/ui-helpers.test.js` |
| UT-U-072 | `updateStatusBadge()` | Adds status-error class for error type | `lib/ui-helpers.test.js` |
| UT-U-073 | `updateStatusBadge()` | Resets to base class when type is empty string | `lib/ui-helpers.test.js` |
| UT-U-074 | `updateStatusBadge()` | Removes previous status classes on subsequent calls | `lib/ui-helpers.test.js` |
| UT-U-075 | `updateStatusBadge()` | Defaults type to empty string when not provided | `lib/ui-helpers.test.js` |

---

## 14. Local Proxy

**Source:** `sftools-proxy/src/*`

### 14.1 Main Entry Point (`sftools-proxy/src/index.js`)

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| PX-I-001 | Proxy initialization | Returns port and secret | - |
| PX-I-002 | Ping/healthcheck | Returns success with version | - |
| PX-I-003 | Message routing | Routes to correct handler | - |
| PX-I-004 | Large payload response | Returns largePayload reference | - |
| PX-I-005 | Unknown message type | Returns error | - |

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| PX-U-001 | `processMessage()` | Routes valid type | - |
| PX-U-002 | `processMessage()` | Returns error for missing type | - |
| PX-U-003 | `sendResponse()` | Sends small payloads directly | - |
| PX-U-004 | `sendResponse()` | Stores large payloads | - |

### 14.2 Native Messaging (`sftools-proxy/src/native-messaging.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| NM-U-001 | `readMessage()` | Parses length prefix + JSON | - |
| NM-U-002 | `readMessage()` | Handles zero-length | - |
| NM-U-003 | `readMessage()` | Rejects > 1MB | - |
| NM-U-004 | `readBytes()` | Assembles partial reads | - |
| NM-U-005 | `sendMessage()` | Writes little-endian length | - |

### 14.3 Protocol Router (`sftools-proxy/src/protocols/router.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| PR-U-001 | `getProtocolForChannel()` | Returns grpc for /event/* | `proxy/router.test.js` |
| PR-U-002 | `getProtocolForChannel()` | Returns cometd for /topic/* | `proxy/router.test.js` |
| PR-U-003 | `getProtocolForChannel()` | Returns cometd for /data/* | `proxy/router.test.js` |
| PR-U-004 | `isGrpcChannel()` | Returns true for /event/* | `proxy/router.test.js` |
| PR-U-005 | `isCometdChannel()` | Returns true for /topic/* | `proxy/router.test.js` |
| PR-U-006 | `getProtocolForChannel()` | Returns grpc for /event/CustomEvent__e | `proxy/router.test.js` |
| PR-U-007 | `getProtocolForChannel()` | Returns cometd for /topic/PushTopic | `proxy/router.test.js` |
| PR-U-008 | `getProtocolForChannel()` | Returns cometd for /systemTopic/Logging | `proxy/router.test.js` |
| PR-U-009 | `getProtocolForChannel()` | Returns cometd for /data/ChangeEvents | `proxy/router.test.js` |
| PR-U-010 | `getProtocolForChannel()` | Throws error for unknown channel | `proxy/router.test.js` |
| PR-U-011 | `isGrpcChannel()` | Returns true for /event/ prefix | `proxy/router.test.js` |
| PR-U-012 | `isGrpcChannel()` | Returns false for /topic/ prefix | `proxy/router.test.js` |
| PR-U-013 | `isGrpcChannel()` | Returns false for /systemTopic/ | `proxy/router.test.js` |
| PR-U-014 | `isGrpcChannel()` | Returns false for /data/ prefix | `proxy/router.test.js` |
| PR-U-015 | `isCometdChannel()` | Returns true for /topic/ prefix | `proxy/router.test.js` |
| PR-U-016 | `isCometdChannel()` | Returns true for /systemTopic/ | `proxy/router.test.js` |
| PR-U-017 | `isCometdChannel()` | Returns true for /data/ prefix | `proxy/router.test.js` |
| PR-U-018 | `isCometdChannel()` | Returns false for /event/ prefix | `proxy/router.test.js` |
| PR-U-019 | `validateChannel()` | Returns true for valid grpc channel | `proxy/router.test.js` |
| PR-U-020 | `validateChannel()` | Returns true for valid cometd channel | `proxy/router.test.js` |
| PR-U-021 | `validateChannel()` | Returns false for invalid prefix | `proxy/router.test.js` |
| PR-U-022 | `validateChannel()` | Returns false for empty channel | `proxy/router.test.js` |
| PR-U-023 | `getChannelType()` | Returns "Platform Event" for /event/ | `proxy/router.test.js` |
| PR-U-024 | `getChannelType()` | Returns "PushTopic" for /topic/ | `proxy/router.test.js` |
| PR-U-025 | `getChannelType()` | Returns "System Topic" for /systemTopic/ | `proxy/router.test.js` |
| PR-U-026 | `getChannelType()` | Returns "Change Data Capture" for /data/ | `proxy/router.test.js` |
| PR-U-027 | `getChannelType()` | Returns "Unknown" for invalid | `proxy/router.test.js` |
| PR-U-028 | `extractEventName()` | Extracts event name from /event/ | `proxy/router.test.js` |
| PR-U-029 | `extractEventName()` | Returns null for other channels | `proxy/router.test.js` |

### 14.4 Subscription Manager (`sftools-proxy/src/subscription-manager.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| SM-U-001 | `add()` | Adds subscription | `proxy/subscription-manager.test.js` |
| SM-U-002 | `get()` | Returns subscription | `proxy/subscription-manager.test.js` |
| SM-U-003 | `remove()` | Removes subscription | `proxy/subscription-manager.test.js` |
| SM-U-004 | `getByChannel()` | Returns by channel | `proxy/subscription-manager.test.js` |
| SM-U-005 | `count()` | Returns correct count | `proxy/subscription-manager.test.js` |
| SM-U-006 | `clear()` | Removes all | `proxy/subscription-manager.test.js` |
| SM-U-007 | `add()` | Adds subscription to map | `proxy/subscription-manager.test.js` |
| SM-U-008 | `add()` | Stores subscription with ID as key | `proxy/subscription-manager.test.js` |
| SM-U-009 | `add()` | Stores full subscription object | `proxy/subscription-manager.test.js` |
| SM-U-010 | `get()` | Returns subscription by ID | `proxy/subscription-manager.test.js` |
| SM-U-011 | `get()` | Returns undefined for missing ID | `proxy/subscription-manager.test.js` |
| SM-U-012 | `remove()` | Removes subscription by ID | `proxy/subscription-manager.test.js` |
| SM-U-013 | `remove()` | Returns true when removed | `proxy/subscription-manager.test.js` |
| SM-U-014 | `remove()` | Returns false when ID not found | `proxy/subscription-manager.test.js` |
| SM-U-015 | `getByChannel()` | Returns subscription matching channel | `proxy/subscription-manager.test.js` |
| SM-U-016 | `getByChannel()` | Returns undefined for non-matching | `proxy/subscription-manager.test.js` |
| SM-U-017 | `getByChannel()` | Handles multiple subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-018 | `getAll()` | Returns array of all subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-019 | `getAll()` | Returns empty array when empty | `proxy/subscription-manager.test.js` |
| SM-U-020 | `count()` | Returns number of subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-021 | `count()` | Returns 0 when empty | `proxy/subscription-manager.test.js` |
| SM-U-022 | `has()` | Returns true for existing ID | `proxy/subscription-manager.test.js` |
| SM-U-023 | `has()` | Returns false for missing ID | `proxy/subscription-manager.test.js` |
| SM-U-024 | `clear()` | Removes all subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-025 | `clear()` | Resets map to empty | `proxy/subscription-manager.test.js` |
| SM-U-026 | `getByProtocol()` | Returns subscriptions by protocol | `proxy/subscription-manager.test.js` |
| SM-U-027 | `getByProtocol()` | Filters grpc subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-028 | `getByProtocol()` | Filters cometd subscriptions | `proxy/subscription-manager.test.js` |
| SM-U-029 | `updateStatus()` | Updates subscription status | `proxy/subscription-manager.test.js` |
| SM-U-030 | `updateStatus()` | Preserves other fields | `proxy/subscription-manager.test.js` |
| SM-U-031 | `updateStatus()` | Returns false for missing ID | `proxy/subscription-manager.test.js` |
| SM-U-032 | `updateLastEvent()` | Updates lastEventTime timestamp | `proxy/subscription-manager.test.js` |

### 14.5 REST Handler (`sftools-proxy/src/handlers/rest.js`)

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| RH-I-001 | GET request proxy | Returns response | - |
| RH-I-002 | POST with JSON body | Body sent correctly | - |
| RH-I-003 | Response headers captured | Headers in response | - |
| RH-I-004 | 4xx/5xx response | Returns success: false | - |

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| RH-U-001 | `handleRest()` | Returns error for missing URL | - |
| RH-U-002 | `handleRest()` | Default method is GET | - |
| RH-U-003 | `handleRest()` | Stringifies object body | - |
| RH-U-004 | `handleRest()` | Passes string body as-is | - |

### 14.6 gRPC Handler (`sftools-proxy/src/handlers/grpc.js`)

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| GH-I-001 | Subscribe to Platform Event | Receives events | - |
| GH-I-002 | GetTopic | Returns metadata | - |
| GH-I-003 | GetSchema | Returns Avro schema | - |
| GH-I-004 | Unsubscribe | Cleans up stream | - |
| GH-I-005 | Stream error | Error forwarded | - |

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| GH-U-001 | `handleGrpcSubscribe()` | Returns error for missing fields | - |
| GH-U-002 | `handleGrpcSubscribe()` | Default replay is LATEST | - |
| GH-U-003 | `handleGrpcUnsubscribe()` | Returns error for missing ID | - |
| GH-U-004 | `handleGetTopic()` | Returns error for missing fields | - |
| GH-U-005 | `handleGetSchema()` | Returns error for missing fields | - |

### 14.7 gRPC Pub/Sub Client (`sftools-proxy/src/grpc/pubsub-client.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| PC-U-001 | `extractOrgIdFromToken()` | Extracts from session token | - |
| PC-U-002 | `extractOrgIdFromToken()` | Extracts from JWT | - |
| PC-U-003 | `extractOrgIdFromToken()` | Returns empty for invalid | - |
| PC-U-004 | `createAuthMetadata()` | Contains required fields | - |
| PC-U-005 | `subscribe()` | Creates bidirectional stream | - |
| PC-U-006 | `subscribe()` | Sends initial FetchRequest | - |
| PC-U-007 | `unsubscribe()` | Ends stream | - |

### 14.8 Schema Cache (`sftools-proxy/src/grpc/schema-cache.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| SC-U-001 | `getOrFetchSchema()` | Fetches on cache miss | - |
| SC-U-002 | `getOrFetchSchema()` | Returns cached on hit | - |
| SC-U-003 | `decodePayload()` | Decodes Avro buffer | - |
| SC-U-004 | `decodeConsumerEvent()` | Decodes full event | - |
| SC-U-005 | `encodePayload()` | Encodes to Avro | - |
| SC-U-006 | `clearCache()` | Empties cache | - |

### 14.9 CometD Handler (`sftools-proxy/src/handlers/cometd.js`)

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| CH-I-001 | Subscribe to PushTopic | Receives events | - |
| CH-I-002 | Subscribe to System Topic | Receives events | - |
| CH-I-003 | Unsubscribe | Cleans up | - |

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| CH-U-001 | `handleCometdSubscribe()` | Returns error for missing fields | - |
| CH-U-002 | `handleCometdUnsubscribe()` | Returns error for missing ID | - |

### 14.10 CometD Client (`sftools-proxy/src/cometd/cometd-client.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| CC-U-001 | `getClientKey()` | Creates unique key | - |
| CC-U-002 | `getOrCreateClient()` | Creates new client | - |
| CC-U-003 | `getOrCreateClient()` | Reuses existing client | - |
| CC-U-004 | `releaseClient()` | Decrements refCount | - |
| CC-U-005 | `releaseClient()` | Disconnects at zero | - |
| CC-U-006 | `getReplayId()` | Returns -1 for LATEST | - |
| CC-U-007 | `getReplayId()` | Returns -2 for EARLIEST | - |
| CC-U-008 | `subscribe()` | Adds to manager | - |
| CC-U-009 | `unsubscribe()` | Removes and releases | - |

### 14.11 HTTP Server (`sftools-proxy/src/http-server.js`)

#### Integration Tests

| Test ID | Scenario | Expected Behavior | Test File |
|---------|----------|-------------------|-----------|
| HS-I-001 | Start server | Returns port and secret | - |
| HS-I-002 | Fetch payload | Returns data | - |
| HS-I-003 | One-time retrieval | Second fetch returns 404 | - |

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| HS-U-001 | `generateSecret()` | Returns 64-char hex | `proxy/http-server.test.js` |
| HS-U-002 | `startServer()` | Reuses existing | `proxy/http-server.test.js` |
| HS-U-003 | OPTIONS request | Returns 204 | - |
| HS-U-004 | Non-GET request | Returns 405 | - |
| HS-U-005 | Missing secret | Returns 401 | - |
| HS-U-006 | Wrong secret | Returns 401 | - |
| HS-U-007 | Invalid UUID | Returns 404 | - |
| HS-U-008 | Non-existent payload | Returns 404 | - |

### 14.12 Payload Store (`sftools-proxy/src/payload-store.js`)

#### Unit Tests

| Test ID | Function | Test Case | Test File |
|---------|----------|-----------|-----------|
| PS-U-001 | `storePayload()` | Returns UUID | `proxy/payload-store.test.js` |
| PS-U-002 | `getPayload()` | Returns stored data | `proxy/payload-store.test.js` |
| PS-U-003 | `getPayload()` | Returns null for expired | `proxy/payload-store.test.js` |
| PS-U-004 | `deletePayload()` | Removes from store | `proxy/payload-store.test.js` |
| PS-U-005 | `shouldUseLargePayload()` | True for >= 800KB | `proxy/payload-store.test.js` |
| PS-U-006 | `shouldUseLargePayload()` | False for < 800KB | `proxy/payload-store.test.js` |
| PS-U-007 | `storePayload()` | Stores payload and returns UUID | `proxy/payload-store.test.js` |
| PS-U-008 | `storePayload()` | Generates unique UUIDs | `proxy/payload-store.test.js` |
| PS-U-009 | `storePayload()` | Stores payload with timestamp | `proxy/payload-store.test.js` |
| PS-U-010 | `storePayload()` | Sets expiration time | `proxy/payload-store.test.js` |
| PS-U-011 | `getPayload()` | Returns stored payload by UUID | `proxy/payload-store.test.js` |
| PS-U-012 | `getPayload()` | Returns null for missing UUID | `proxy/payload-store.test.js` |
| PS-U-013 | `getPayload()` | Returns null for expired payload | `proxy/payload-store.test.js` |
| PS-U-014 | `getPayload()` | Returns payload within TTL | `proxy/payload-store.test.js` |
| PS-U-015 | `deletePayload()` | Removes payload from store | `proxy/payload-store.test.js` |
| PS-U-016 | `deletePayload()` | Returns true when deleted | `proxy/payload-store.test.js` |
| PS-U-017 | `deletePayload()` | Returns false for missing UUID | `proxy/payload-store.test.js` |
| PS-U-018 | `shouldUseLargePayload()` | Returns true for >= 800KB | `proxy/payload-store.test.js` |
| PS-U-019 | `shouldUseLargePayload()` | Returns false for < 800KB | `proxy/payload-store.test.js` |
| PS-U-020 | `shouldUseLargePayload()` | Calculates JSON size correctly | `proxy/payload-store.test.js` |
| PS-U-021 | `cleanupExpired()` | Removes expired payloads | `proxy/payload-store.test.js` |
| PS-U-022 | `cleanupExpired()` | Preserves non-expired payloads | `proxy/payload-store.test.js` |
| PS-U-023 | `cleanupExpired()` | Returns count of removed items | `proxy/payload-store.test.js` |
| PS-U-024 | `count()` | Returns number of stored payloads | `proxy/payload-store.test.js` |
| PS-U-025 | `count()` | Returns 0 when empty | `proxy/payload-store.test.js` |
| PS-U-026 | `clear()` | Removes all payloads | `proxy/payload-store.test.js` |
| PS-U-027 | `has()` | Returns true for existing UUID | `proxy/payload-store.test.js` |
| PS-U-028 | `has()` | Returns false for missing UUID | `proxy/payload-store.test.js` |

---

Note: Integration test counts include documented scenarios that may not yet be implemented (marked with "-").

---

## Edge Cases Index

### Authentication Edge Cases
- Not authenticated state
- Token expiration during operation
- Token refresh failure
- Invalid/expired OAuth state (CSRF)
- Connection removed mid-operation

### Proxy Edge Cases
- Proxy not connected
- Proxy connection failure
- Large payload handling (>800KB)
- Native host not installed
- Stream disconnection

### Data Edge Cases
- Empty result sets
- Large result sets
- Null/undefined values
- Special characters in data
- Unicode content

### Network Edge Cases
- CORS errors
- Request timeout
- Server errors (4xx, 5xx)
- Network disconnection

### Concurrency Edge Cases
- Multiple tabs with different connections
- Storage changes from other tabs
- Concurrent API requests
- Race conditions in autocomplete
