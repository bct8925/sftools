// Data Import Tab — CSV import via Salesforce Bulk API v2
import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { useToast } from '../../contexts/ToastContext';
import { getGlobalDescribe, getObjectDescribe } from '../../api/salesforce';
import { executeBulkIngest, abortBulkIngestJob } from '../../api/salesforce';
import { reconstructCsv, splitCsvIntoChunks } from '../../lib/csv-parse';
import {
    getEligibleFields,
    autoMapColumns,
    remapColumns,
    validateMappings,
} from '../../lib/column-mapping';
import { useImportState } from './useImportState';
import { OperationSection } from './OperationSection';
import { CsvUploadSection } from './CsvUploadSection';
import { ColumnMappingSection } from './ColumnMappingSection';
import { ImportSettingsSection } from './ImportSettingsSection';
import { ExecuteSection } from './ExecuteSection';
import type { SObjectDescribe, FieldDescribe } from '../../types/salesforce';
import type { ImportCsvMeta } from './useImportState';
import styles from './DataImportTab.module.css';

export function DataImportTab() {
    const { activeConnection } = useConnection();
    const toast = useToast();

    const {
        state,
        setOperation,
        setObject,
        setExternalIdField,
        setCsv,
        setMappings,
        toggleMapping,
        setMappingTarget,
        setBatchSize,
        setJobPhase,
        setJobResult,
        setError,
        reset,
    } = useImportState();

    // Raw CSV text lives here — NOT in reducer state (avoids copying large strings through reconciliation)
    const rawCsvRef = useRef<string | null>(null);

    // For cancellation and active job tracking
    const cancelledRef = useRef(false);
    const activeJobIdRef = useRef<string | null>(null);

    // Skip the re-mapping useEffect after handleCsvLoaded already computed mappings
    const skipRemapRef = useRef(false);

    // Read current mappings inside handleCsvLoaded without adding to its deps
    const mappingsRef = useRef(state.mappings);
    mappingsRef.current = state.mappings;

    // Stale describe request guard
    const describeRequestIdRef = useRef(0);

    const [objects, setObjects] = useState<SObjectDescribe[]>([]);
    const [fields, setFields] = useState<FieldDescribe[]>([]);
    const [objectsLoading, setObjectsLoading] = useState(false);

    // Reset on connection change
    const connectionId = activeConnection?.id;
    useEffect(() => {
        reset();
        rawCsvRef.current = null;
        setFields([]);
    }, [connectionId, reset]);

    // Load global describe on mount / connection change
    useEffect(() => {
        if (!connectionId) {
            setObjects([]);
            return;
        }
        setObjectsLoading(true);
        getGlobalDescribe()
            .then(result => setObjects(result.sobjects))
            .catch(() => setObjects([]))
            .finally(() => setObjectsLoading(false));
    }, [connectionId]);

    // Load object fields when object changes (stale-request guard)
    useEffect(() => {
        if (!state.objectName) {
            setFields([]);
            return;
        }
        const requestId = ++describeRequestIdRef.current;
        getObjectDescribe(state.objectName)
            .then(result => {
                if (requestId === describeRequestIdRef.current) {
                    setFields(result.fields);
                }
            })
            .catch(() => {
                if (requestId === describeRequestIdRef.current) {
                    setFields([]);
                }
            });
    }, [state.objectName]);

    // Re-compute mappings when fields change and CSV is loaded
    useEffect(() => {
        if (!state.csv || fields.length === 0) return;

        // handleCsvLoaded already computed mappings — skip one cycle
        if (skipRemapRef.current) {
            skipRemapRef.current = false;
            return;
        }

        const eligible = getEligibleFields(
            fields,
            state.operation,
            state.externalIdField ?? undefined
        );
        const newMappings = autoMapColumns(state.csv.headers, eligible);
        setMappings(newMappings);
    }, [fields, state.csv, state.operation, state.externalIdField, setMappings]);

    const eligibleFields = useMemo(
        () => getEligibleFields(fields, state.operation, state.externalIdField ?? undefined),
        [fields, state.operation, state.externalIdField]
    );

    // isReadyToExecute derived inline — never stored in state
    const isReadyToExecute = useMemo(
        () =>
            state.objectName !== null &&
            state.csv !== null &&
            state.jobPhase !== 'running' &&
            validateMappings(state.mappings, state.operation, state.externalIdField ?? undefined)
                .valid,
        [
            state.objectName,
            state.csv,
            state.jobPhase,
            state.mappings,
            state.operation,
            state.externalIdField,
        ]
    );

    const handleCsvLoaded = useCallback(
        (meta: ImportCsvMeta, rawText: string) => {
            rawCsvRef.current = rawText;
            const eligible = getEligibleFields(
                fields,
                state.operation,
                state.externalIdField ?? undefined
            );

            const previous = mappingsRef.current;
            const mappings =
                previous.length > 0
                    ? remapColumns(meta.headers, eligible, previous)
                    : autoMapColumns(meta.headers, eligible);

            skipRemapRef.current = true;
            setCsv(meta, mappings);
        },
        [fields, state.operation, state.externalIdField, setCsv]
    );

    const handleExecute = useCallback(async () => {
        if (!rawCsvRef.current || !state.objectName) return;

        cancelledRef.current = false;
        activeJobIdRef.current = null;
        setJobPhase('running');

        const toastId = toast.show('Creating import job...', 'loading');

        try {
            const reconstructed = reconstructCsv(rawCsvRef.current, state.mappings);
            const chunks = splitCsvIntoChunks(reconstructed, state.batchSize);

            const result = await executeBulkIngest(
                {
                    object: state.objectName,
                    operation: state.operation,
                    externalIdFieldName: state.externalIdField ?? undefined,
                },
                chunks,
                (_stage, message) => toast.update(toastId, message, 'loading'),
                cancelledRef,
                activeJobIdRef
            );

            toast.update(
                toastId,
                `Import complete: ${result.successCount.toLocaleString()} succeeded, ${result.failureCount.toLocaleString()} failed`,
                result.failureCount > 0 || result.unprocessedCount > 0 ? 'error' : 'success'
            );
            setJobResult(result);
        } catch (err) {
            const message = (err as Error).message;
            toast.update(toastId, message, 'error');
            setError(message);
        }
    }, [
        state.objectName,
        state.operation,
        state.externalIdField,
        state.mappings,
        state.batchSize,
        toast,
        setJobPhase,
        setJobResult,
        setError,
    ]);

    const handleCancel = useCallback(() => {
        cancelledRef.current = true;
        if (activeJobIdRef.current) {
            abortBulkIngestJob(activeJobIdRef.current).catch(() => {
                /* ignore */
            });
        }
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={`card-header-icon ${styles.headerIcon}`}>
                    <span aria-hidden="true">↑</span>
                </div>
                <h2>Data Import</h2>
            </div>

            <OperationSection
                operation={state.operation}
                objectName={state.objectName}
                externalIdField={state.externalIdField}
                objects={objectsLoading ? [] : objects}
                fields={fields}
                disabled={state.jobPhase === 'running'}
                onOperationChange={setOperation}
                onObjectChange={setObject}
                onExternalIdFieldChange={setExternalIdField}
            />

            <CsvUploadSection
                csv={state.csv}
                disabled={state.jobPhase === 'running'}
                onCsvLoaded={handleCsvLoaded}
            />

            {state.csv && (
                <ColumnMappingSection
                    mappings={state.mappings}
                    eligibleFields={eligibleFields}
                    operation={state.operation}
                    disabled={state.jobPhase === 'running'}
                    onToggle={toggleMapping}
                    onChangeTarget={setMappingTarget}
                />
            )}

            <ImportSettingsSection
                batchSize={state.batchSize}
                disabled={state.jobPhase === 'running'}
                onChange={setBatchSize}
            />

            <ExecuteSection
                rowCount={state.csv?.rowCount ?? 0}
                isReadyToExecute={isReadyToExecute}
                jobPhase={state.jobPhase}
                jobResult={state.jobResult}
                error={state.error}
                objectName={state.objectName}
                onExecute={handleExecute}
                onCancel={handleCancel}
            />
        </div>
    );
}
