# Data Import Plan — Review Addendum

Companion to `import.md`. Apply these corrections and additions during implementation. Items are ordered by phase, then severity.

---

## Phase 2 — API Layer Corrections

### Multi-job result aggregation
When `executeBulkIngest` runs multiple jobs (CSV rows > batchSize), each job produces three result CSVs. The orchestrator must:
- Concatenate success/failure/unprocessed CSVs across all jobs
- Strip the header row from jobs 2+ before concatenating
- Sum counts across all jobs for the final `BulkIngestResults`

### Add abort signal support for multi-job execution
Store the active job ID in a ref so it can be cancelled mid-stream. The orchestrator should accept an `AbortSignal` or check a cancellation ref between jobs:

```typescript
// Pseudo-pattern
for (let i = 0; i < chunks.length; i++) {
    if (cancelledRef.current) {
        await abortBulkIngestJob(currentJobId).catch(() => {});
        throw new Error('Import cancelled by user');
    }
    // ... run job i
}
```

---

## Phase 3 — CSV Utilities Corrections

### File size validation in CsvUploadSection (not csv-parse.ts)
Check `file.size` before calling `FileReader.readAsText()`. The Bulk API v2 limit is 150MB per job. If the file exceeds 150MB, show an inline warning rather than a hard block (user may have a small batchSize configured):

```
⚠ File is 200MB. Salesforce Bulk API v2 supports up to 150MB per job.
  Reduce your batch size so each chunk stays under the limit.
```

Show file size in the upload summary bar regardless.

---

## Phase 4 — Column Mapping Corrections

### Use index Maps in `autoMapColumns` — REQUIRED
Naive implementation is O(headers × fields). With 200 headers × 500 fields = 100K comparisons. Build Maps upfront:

```typescript
export function autoMapColumns(csvHeaders: string[], eligibleFields: FieldDescribe[]): ColumnMapping[] {
    const byApiName = new Map(eligibleFields.map(f => [f.name.toLowerCase(), f]));
    const byLabel = new Map(eligibleFields.map(f => [f.label.toLowerCase(), f]));

    return csvHeaders.map((header, csvIndex) => {
        const key = header.toLowerCase();
        const byName = byApiName.get(key);
        if (byName) {
            return { csvHeader: header, csvIndex, fieldApiName: byName.name, included: true, mappingSource: 'api-name' };
        }
        const byLbl = byLabel.get(key);
        if (byLbl) {
            return { csvHeader: header, csvIndex, fieldApiName: byLbl.name, included: true, mappingSource: 'label' };
        }
        return { csvHeader: header, csvIndex, fieldApiName: null, included: false, mappingSource: 'none' };
    });
}
```

### Ensure external ID field is always eligible for upsert
`getEligibleFields` for upsert must include the external ID field even if it is not otherwise createable or updateable:

```typescript
// upsert: createable || updateable fields, PLUS the externalIdField unconditionally
if (operation === 'upsert') {
    return fields.filter(f =>
        f.createable || f.updateable ||
        (externalIdFieldName && f.name === externalIdFieldName)
    );
}
```

### `SET_OPERATION` and `SET_OBJECT` must re-compute mappings
When the user changes operation or object, eligible fields change, making existing mappings stale. In the reducer:
- `SET_OPERATION`: If CSV is loaded and fields are available, re-run `autoMapColumns` with new eligible fields. Otherwise clear `mappings: []`.
- `SET_OBJECT`: Clear `mappings: []` and clear `fields` — the `DataImportTab` effect will reload fields and re-auto-map via `SET_CSV`-style dispatch.

---

## Phase 5 — UI Component Corrections

### 5.1 State management — move rawText out of reducer state

`csv.rawText` in reducer state is problematic for large files (50–150MB): every `dispatch()` call creates a new state snapshot that still references the string, and the string gets passed through React's reconciliation.

**Pattern**: Keep raw text in a `useRef` in `DataImportTab`. Only metadata goes in reducer state:

```typescript
// In reducer state:
csv: { filename: string; headers: string[]; rowCount: number; fileSize: number } | null

// In DataImportTab:
const rawCsvRef = useRef<string | null>(null);

// On file read:
rawCsvRef.current = text;
dispatch({ type: 'SET_CSV', payload: { filename, headers, rowCount, fileSize } });

// At execute time:
reconstructCsv(rawCsvRef.current!, state.mappings)
```

### 5.1 `isReadyToExecute` — derive during render, not in state

Compute as a plain expression or `useMemo` from the hook return value. Never store in state or update via effect:

```typescript
// In useImportState hook return or in DataImportTab:
const isReadyToExecute =
    state.objectName !== null &&
    state.csv !== null &&
    state.jobPhase === 'idle' &&
    validateMappings(state.mappings, state.operation, state.externalIdField ?? undefined).valid;
```

Same pattern for derived counts: "X of Y columns mapped" is computed inline from `state.mappings`, not stored.

### 5.2 DataImportTab — narrow effect dependencies

```typescript
// CORRECT — primitive dep
const connectionId = activeConnection?.id;
useEffect(() => {
    dispatch({ type: 'RESET' });
    rawCsvRef.current = null;
}, [connectionId]);

// CORRECT — narrow to objectName string
useEffect(() => {
    if (!state.objectName) return;
    const requestedName = state.objectName;
    const id = ++describeRequestIdRef.current;
    getObjectDescribe(requestedName).then(result => {
        if (id === describeRequestIdRef.current) {
            setFields(result.fields);
        }
    });
}, [state.objectName]);
```

### 5.2 DataImportTab — add Cancel button and abort ref

```typescript
const cancelledRef = useRef(false);
const activeJobIdRef = useRef<string | null>(null);

// In ExecuteSection, when jobPhase === 'running':
// Show "Cancel Import" button that sets cancelledRef.current = true
// and calls abortBulkIngestJob(activeJobIdRef.current)
```

### 5.3 OperationSection — filter objects by operation capability

When building the object list for the picker, filter `SObjectDescribe` by operation:
- insert → `createable: true`
- update → `updateable: true`
- upsert → `createable: true` OR `updateable: true`
- delete → `deletable: true`

Apply this filter before passing to `ObjectSearchSelect`.

### 5.5 ColumnMappingSection + ColumnMappingRow — memoization is REQUIRED

The mapping list re-renders on every state change. Without memoization, 200 rows × 500-option selects is expensive.

**ColumnMappingSection** — compute shared state before rendering rows:
```typescript
// Compute once per render; pass as stable prop to each row
const assignedFieldNames = useMemo(
    () => new Set(state.mappings.filter(m => m.fieldApiName && m.included).map(m => m.fieldApiName!)),
    [state.mappings]
);
```

**ColumnMappingRow** — wrap in `memo()` with stable callbacks:
```typescript
// Module-level constant for stable default
const NOOP = () => {};

const ColumnMappingRow = memo(function ColumnMappingRow({
    mapping,
    eligibleFields,
    assignedFieldNames,
    onToggle = NOOP,
    onChangeTarget = NOOP,
}: ColumnMappingRowProps) {
    // Per-row available options — only changes when assignments change
    const availableFields = useMemo(
        () => eligibleFields.filter(
            f => !assignedFieldNames.has(f.name) || f.name === mapping.fieldApiName
        ),
        [eligibleFields, assignedFieldNames, mapping.fieldApiName]
    );

    // ...
});
```

Callbacks from the parent must be stable (`useCallback` with `[dispatch]` — `dispatch` is already stable from `useReducer`).

### 5.5 Delete operation — use explicit ternary, not &&

```typescript
// CORRECT
{operation === 'delete'
    ? <ColumnMappingRow ... />   // only Id row
    : mappings.map(m => <ColumnMappingRow key={m.csvIndex} ... />)
}

// WRONG — could render '0' if mappings.length is 0
{mappings.length && <ColumnMappingRow ... />}
```

### 5.6 ImportSettingsSection — lower the max batch size

Max 10,000,000 rows at ~100 bytes/row = ~1GB, far over the 150MB Bulk API limit. Use max `100_000` as a practical cap, or remove the max and rely on the server-side error. Default remains `10_000`.

### 5.7 ExecuteSection — Cancel button

During `jobPhase === 'running'`, render:
```
[Cancel Import]   (neutral/destructive secondary button, not brand)
```

On click: set `cancelledRef.current = true`. The orchestrator checks this between batches and aborts cleanly.

### 5.8 Tab position in FEATURES array and TAB_IDS

Add `'data-import'` after `'schema'` and before `'events'` in both `FEATURES` (TabNavigation.tsx) and `TAB_IDS` (App.tsx). This groups it with other data-oriented tools.

---

## Verification Additions

Add to the existing verification checklist:

7. **Large file smoke test**: Upload a 10MB CSV → UI should not freeze, file size shown in summary
8. **Operation switch test**: Upload CSV, change operation Insert → Delete → mapping section shows only Id row, stale mappings cleared
9. **Multi-job test**: Set batch size to 5, upload 12-row CSV → 3 jobs run sequentially, all result CSVs concatenated correctly
10. **Cancel test**: Start import, click Cancel → active job aborted, no further jobs dispatched
11. **Object switch race condition**: Rapidly switch objects → only the last selection's fields populate the mapping
