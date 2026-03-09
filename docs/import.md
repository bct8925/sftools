# Data Import via Bulk API v2

## Context

**Issue**: #125 — Add native CSV data import using Salesforce Bulk API v2.

Existing tools (Data Loader, Sheets Connector) handle this, but we want it integrated directly into sftools. The extension already has Bulk API v2 **query/export** (`src/api/bulk-query.ts`); this adds the **ingest** counterpart for insert, update, upsert, and delete operations.

**Key decisions from discussion**:
- New top-level feature tab (not inside Utils)
- Papa Parse for CSV parsing
- ID-based only for reference fields (no lookup resolution)
- Works without native proxy (routes through background service worker)
- Single-page scrollable layout with progressive sections
- Toast-based progress tracking

---

## New Files

| File | Purpose |
|------|---------|
| `src/api/bulk-ingest.ts` | Bulk API v2 ingest operations (create/upload/close/poll/results/abort/orchestrate) |
| `src/lib/csv-parse.ts` | CSV parsing (Papa Parse wrapper) + CSV reconstruction with remapped columns |
| `src/lib/column-mapping.ts` | Auto-mapping algorithm, field filtering by operation, validation |
| `src/components/data-import/DataImportTab.tsx` | Top-level tab component |
| `src/components/data-import/DataImportTab.module.css` | Tab styles |
| `src/components/data-import/useImportState.ts` | useReducer state management hook |
| `src/components/data-import/OperationSection.tsx` | Operation + Object selection |
| `src/components/data-import/CsvUploadSection.tsx` | CSV file upload + drag-and-drop |
| `src/components/data-import/ColumnMappingSection.tsx` | Column-to-field mapping list |
| `src/components/data-import/ColumnMappingRow.tsx` | Individual mapping row |
| `src/components/data-import/ImportSettingsSection.tsx` | Batch size config |
| `src/components/data-import/ExecuteSection.tsx` | Execute button + results/downloads |
| `src/components/data-import/ObjectSearchSelect.tsx` | Searchable object dropdown |
| `tests/unit/lib/csv-parse.test.ts` | CSV parsing tests |
| `tests/unit/lib/column-mapping.test.ts` | Column mapping tests |
| `tests/unit/api/bulk-ingest.test.ts` | Bulk ingest API tests |

## Modified Files

| File | Change |
|------|--------|
| `src/react/TabNavigation.tsx` | Add `'data-import'` to `FeatureId`, add entry to `FEATURES` |
| `src/react/App.tsx` | Add lazy import, `TAB_COMPONENTS`, `TAB_IDS`, `TAB_PRELOADS` entries |
| `src/types/salesforce.d.ts` | Add `BulkIngestJob`, `BulkIngestOperation`, `ColumnMapping`, etc. |
| `src/lib/icons.ts` | Add `tileDataImport` icon |
| `src/style.css` | Add `--icon-data-import` CSS variable (both light + dark) |
| `src/api/salesforce.ts` | Re-export bulk ingest functions |
| `package.json` | Add `papaparse` + `@types/papaparse` |

---

## Phase 1: Foundation — Registration + Dependencies

### 1.1 Install Papa Parse
```
npm install papaparse && npm install -D @types/papaparse
```

### 1.2 Add types to `src/types/salesforce.d.ts`

```typescript
type BulkIngestOperation = 'insert' | 'update' | 'upsert' | 'delete';

type BulkIngestJobState = 'Open' | 'UploadComplete' | 'InProgress' | 'JobComplete' | 'Failed' | 'Aborted';

interface BulkIngestJob {
    id: string;
    operation: BulkIngestOperation;
    object: string;
    state: BulkIngestJobState;
    contentUrl?: string;
    externalIdFieldName?: string;
    numberRecordsProcessed?: number;
    numberRecordsFailed?: number;
    errorMessage?: string;
    totalProcessingTime?: number;
}

interface BulkIngestResults {
    successCsv: string;
    failureCsv: string;
    unprocessedCsv: string;
    successCount: number;
    failureCount: number;
    unprocessedCount: number;
}

interface ColumnMapping {
    csvHeader: string;
    csvIndex: number;
    fieldApiName: string | null;
    included: boolean;
    mappingSource: 'api-name' | 'label' | 'manual' | 'none';
}
```

### 1.3 Register as new feature tab

**`TabNavigation.tsx`**: Add `'data-import'` to `FeatureId` union, add to `FEATURES` array:
```typescript
{ id: 'data-import', label: 'Data Import', requiresAuth: true, requiresProxy: false,
  tileIcon: 'tileDataImport', tileColor: 'var(--icon-data-import)' }
```

**`App.tsx`**: Lazy import, add to `TAB_COMPONENTS`, `TAB_IDS` (before `'settings'`), and `TAB_PRELOADS`.

**`icons.ts`**: Add `tileDataImport` — use an upload/import SVG at size 32.

**`style.css`**: Add `--icon-data-import: #f97316` (orange) in both `:root` and `[data-theme='dark']`.

### 1.4 Scaffold `DataImportTab.tsx`
Minimal component with a card header — verify it renders from the home screen tile.

---

## Phase 2: API Layer — `src/api/bulk-ingest.ts`

Mirror the patterns from `src/api/bulk-query.ts`. All JSON operations use `salesforceRequest()`. The CSV upload uses `smartFetch()` directly (same pattern as `getBulkQueryResults` at line 116 of bulk-query.ts).

### Functions

```typescript
// Create job — POST /services/data/v62.0/jobs/ingest
createBulkIngestJob(config: { object, operation, externalIdFieldName? }): Promise<BulkIngestJob>

// Upload CSV — PUT to job.contentUrl with Content-Type: text/csv
// MUST use smartFetch() directly (salesforceRequest forces JSON content type)
uploadBulkIngestData(contentUrl: string, csvData: string): Promise<void>

// Close job — PATCH with { state: "UploadComplete" }
closeBulkIngestJob(jobId: string): Promise<BulkIngestJob>

// Poll status — GET
getBulkIngestJobStatus(jobId: string): Promise<BulkIngestJob>

// Get results CSVs — GET with Accept: text/csv (use smartFetch directly)
getBulkIngestSuccessResults(jobId: string): Promise<string>
getBulkIngestFailedResults(jobId: string): Promise<string>
getBulkIngestUnprocessedResults(jobId: string): Promise<string>

// Abort — PATCH with { state: "Aborted" }
abortBulkIngestJob(jobId: string): Promise<void>

// Orchestrator — full lifecycle with polling + progress callback
executeBulkIngest(
    config: { object, operation, externalIdFieldName? },
    csvData: string,
    onProgress?: (stage, message) => void
): Promise<BulkIngestResults>
```

### CSV Upload Pattern (bypasses salesforceRequest)
```typescript
async function uploadBulkIngestData(contentUrl: string, csvData: string): Promise<void> {
    const url = `${getInstanceUrl()}${contentUrl}`;
    const response = await smartFetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${getAccessToken()}`,
            'Content-Type': 'text/csv',
            Accept: 'application/json',
        },
        body: csvData,
    });
    if (!response.success) { /* parse + throw error */ }
}
```

### Polling Pattern (mirrors executeBulkQueryExport)
- Poll interval: 2 seconds
- Max attempts: 150 (5 minutes)
- Progress callback reports: creating → uploading → processing (with record counts) → fetching-results → complete/failed
- On timeout: abort job, throw error
- Fetch all 3 result CSVs in parallel on JobComplete

### Batch Size / Multi-Job
The user-configured "batch size" splits the CSV into multiple sequential Bulk API v2 jobs when the row count exceeds the batch size. Each job follows the full lifecycle independently. Default: 10,000 (practical, gives progress visibility). The `onProgress` callback reports `currentJob/totalJobs`.

Re-export key functions from `src/api/salesforce.ts`.

---

## Phase 3: CSV Utilities — `src/lib/csv-parse.ts`

```typescript
// Parse CSV for UI preview (headers, row count, first N rows)
parseCsvForPreview(csvText: string, previewLimit?: number): {
    headers: string[];
    rowCount: number;
    previewRows: string[][];
    errors: Papa.ParseError[];
}

// Reconstruct CSV with remapped columns for Bulk API upload
// - Only includes columns where included=true && fieldApiName!=null
// - Header row uses Salesforce field API names
// - Reuses escapeCsvField() from csv-utils.ts
reconstructCsv(csvText: string, mappings: ColumnMapping[]): string

// Split CSV into chunks for multi-job execution
splitCsvIntoChunks(csvText: string, maxRowsPerChunk: number): string[]
```

---

## Phase 4: Column Mapping — `src/lib/column-mapping.ts`

```typescript
// Filter fields by operation capability
getEligibleFields(fields: FieldDescribe[], operation: BulkIngestOperation,
    externalIdFieldName?: string): FieldDescribe[]
// insert: createable fields | update: updateable + Id | upsert: createable||updateable + extId | delete: Id only

// Auto-map CSV headers to Salesforce fields
autoMapColumns(csvHeaders: string[], eligibleFields: FieldDescribe[]): ColumnMapping[]
// Algorithm per header:
//   1. Case-insensitive match on field API name → mappingSource: 'api-name'
//   2. Case-insensitive match on field label → mappingSource: 'label'
//   3. No match → fieldApiName: null, included: false, mappingSource: 'none'

// Validate mappings are ready for execution
validateMappings(mappings: ColumnMapping[], operation: BulkIngestOperation,
    externalIdFieldName?: string): { valid: boolean; errors: string[] }
// Checks: update/delete has Id mapped, upsert has extId mapped,
//   no duplicate field mappings, at least one data column for non-delete
```

---

## Phase 5: UI Components

### 5.1 State Management — `useImportState.ts`

`useReducer` hook following the `useQueryState.ts` pattern.

**State shape:**
```typescript
interface ImportState {
    operation: BulkIngestOperation;
    objectName: string | null;
    externalIdField: string | null;
    csv: { filename: string; rawText: string; headers: string[]; rowCount: number } | null;
    mappings: ColumnMapping[];
    batchSize: number;
    jobPhase: 'idle' | 'running' | 'complete' | 'failed';
    jobResult: BulkIngestResults | null;
    error: string | null;
}
```

**Key actions**: `SET_OPERATION`, `SET_OBJECT`, `SET_EXTERNAL_ID_FIELD`, `SET_CSV` (with auto-mapped mappings), `CLEAR_CSV`, `TOGGLE_MAPPING`, `SET_MAPPING_TARGET`, `SET_BATCH_SIZE`, `SET_JOB_PHASE`, `SET_JOB_RESULT`, `SET_ERROR`, `RESET`.

**Derived state**: `isReadyToExecute` (object set, CSV loaded, mappings valid).

### 5.2 DataImportTab.tsx — Top-level orchestrator

- Owns `useImportState()`, `useConnection()`, `useToast()`
- Loads global describe on mount → `getGlobalDescribe()`
- Loads object fields when object changes → `getObjectDescribe(objectName)`
- Resets state on `activeConnection?.id` change
- Handles execute flow with toast progress tracking
- Renders all sections in a scrollable column

### 5.3 OperationSection.tsx

- Operation `<select>`: Insert, Update, Upsert, Delete
- `ObjectSearchSelect` for searchable object selection
  - Input field with `.input` class, filters objects as user types
  - Uses `filterObjects()` from `schema-utils.ts`
  - Dropdown: `position: absolute`, `max-height: 200px`, `z-index: var(--z-dropdown)`
  - Shows `Label` (bold) + `ApiName` (muted) per item
  - Filter objects by capability based on operation
- When Upsert: External ID field dropdown (fields where `externalId === true`)
- Disabled when job is running

### 5.4 CsvUploadSection.tsx

- Hidden `<input type="file" accept=".csv">` triggered by button (pattern from `DataManagement.tsx`)
- Drag-and-drop zone (new pattern): dashed border, highlights on drag-over
- After upload: filename, row count, column count summary bar
- "Remove" button to clear CSV
- Calls `parseCsvForPreview()` on file read, dispatches `SET_CSV`

### 5.5 ColumnMappingSection.tsx + ColumnMappingRow.tsx

Inspired by the Sheets Connector screenshot — optimized for ~400px side panel width.

Each row layout:
```
[checkbox 28px] [CSV column ~120px] [Field select fills remaining]
```

- Checkbox to include/exclude column
- CSV column name (truncated with ellipsis)
- Target field: `<select>` with options showing `Label (ApiName)` format
  - First option: "-- Do not import --"
  - Already-assigned fields filtered from other rows' dropdowns
- Auto-mapped columns show a green dot indicator
- For delete operation: only show the Id mapping row, hide all others
- Header: "X of Y columns mapped" count
- Note at bottom: "\*Only createable/updateable fields are shown" (based on operation)

### 5.6 ImportSettingsSection.tsx

- Batch size `<input type="number">` (min 200, max 10,000,000, default 10,000)
- Uses `.form-element` + `.input` global classes

### 5.7 ExecuteSection.tsx

- "Import X Records" `.button-brand` button
- Disabled when `!isReadyToExecute` or job running
- `confirm()` dialog before executing (matching existing pattern)
- After completion: inline summary with success/failure/unprocessed counts
- Download buttons for each result CSV using `downloadCsv()` from `csv-utils.ts`

### 5.8 Toast Progress

Follow the pattern from `QueryTab.tsx` bulk export (lines 243-304):
```typescript
const toastId = toast.show('Creating import job...', 'loading');
// → toast.update(toastId, 'Uploading CSV...', 'loading');
// → toast.update(toastId, 'Processing: 500/1000 records...', 'loading');
// → toast.update(toastId, 'Import complete: 950 succeeded, 50 failed', 'success');
```

---

## Phase 6: Tests

### Unit tests
- `csv-parse.test.ts`: parseCsvForPreview (headers, row count, edge cases), reconstructCsv (remapping, filtering, escaping), splitCsvIntoChunks
- `column-mapping.test.ts`: getEligibleFields (per operation), autoMapColumns (API name match, label match, no match, case-insensitive), validateMappings (all error conditions)
- `bulk-ingest.test.ts`: Each API function mocked, orchestrator polling flow

### Frontend tests
- DataImportTab renders and shows on home screen
- Operation change updates object filter
- CSV upload populates mappings
- Column mapping toggle/override
- Execute button enabled/disabled states

---

## Implementation Sequencing

1. **Phase 1** — Foundation: Install deps, add types, register tab, scaffold component
2. **Phase 2** — API: `bulk-ingest.ts` with all Bulk API v2 ingest functions
3. **Phase 3** — CSV: `csv-parse.ts` with parse/reconstruct/split
4. **Phase 4** — Mapping: `column-mapping.ts` with auto-map/validate
5. **Phase 5** — UI: Build components top-down (DataImportTab → sections)
6. **Phase 6** — Tests: Unit tests for lib/api, frontend tests for UI

---

## Verification

1. **Build**: `npm run build` compiles without errors
2. **Type check**: `npm run typecheck` passes
3. **Validate**: `npm run validate` passes (lint + format + typecheck)
4. **Unit tests**: `npm run test:unit` passes
5. **Frontend tests**: `npm run test:frontend` passes
6. **Manual test**: Open extension → Data Import tile visible → select Insert + Account → upload CSV → auto-mapping populates → execute → toast shows progress → results downloadable
