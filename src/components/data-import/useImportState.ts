// Data Import state management with useReducer
import { useReducer, useCallback } from 'react';
import type { BulkIngestOperation, BulkIngestResults, ColumnMapping } from '../../types/salesforce';

// ============================================================
// State & Actions
// ============================================================

// rawText lives in a ref in DataImportTab — not in reducer state
// (avoids copying 50–150 MB strings through React's reconciliation on every dispatch)
export interface ImportCsvMeta {
    filename: string;
    headers: string[];
    rowCount: number;
    fileSize: number;
}

export interface ImportState {
    operation: BulkIngestOperation;
    objectName: string | null;
    externalIdField: string | null;
    csv: ImportCsvMeta | null;
    mappings: ColumnMapping[];
    batchSize: number;
    jobPhase: 'idle' | 'running' | 'complete' | 'failed';
    jobResult: BulkIngestResults | null;
    error: string | null;
}

export type ImportAction =
    | { type: 'SET_OPERATION'; operation: BulkIngestOperation }
    | { type: 'SET_OBJECT'; objectName: string | null }
    | { type: 'SET_EXTERNAL_ID_FIELD'; field: string | null }
    | { type: 'SET_CSV'; csv: ImportCsvMeta; mappings: ColumnMapping[] }
    | { type: 'CLEAR_CSV' }
    | { type: 'SET_MAPPINGS'; mappings: ColumnMapping[] }
    | { type: 'TOGGLE_MAPPING'; csvIndex: number }
    | { type: 'SET_MAPPING_TARGET'; csvIndex: number; fieldApiName: string | null }
    | { type: 'SET_BATCH_SIZE'; batchSize: number }
    | { type: 'SET_JOB_PHASE'; phase: ImportState['jobPhase'] }
    | { type: 'SET_JOB_RESULT'; result: BulkIngestResults }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'RESET' };

const DEFAULT_BATCH_SIZE = 10_000;

const initialState: ImportState = {
    operation: 'insert',
    objectName: null,
    externalIdField: null,
    csv: null,
    mappings: [],
    batchSize: DEFAULT_BATCH_SIZE,
    jobPhase: 'idle',
    jobResult: null,
    error: null,
};

// ============================================================
// Reducer
// ============================================================

function importReducer(state: ImportState, action: ImportAction): ImportState {
    switch (action.type) {
        case 'SET_OPERATION':
            // Clear mappings — eligible fields change with operation
            return {
                ...state,
                operation: action.operation,
                externalIdField: null,
                mappings: [],
            };

        case 'SET_OBJECT':
            // Clear mappings and CSV — field list will reload via useEffect
            return {
                ...state,
                objectName: action.objectName,
                externalIdField: null,
                mappings: [],
            };

        case 'SET_EXTERNAL_ID_FIELD':
            return { ...state, externalIdField: action.field };

        case 'SET_CSV':
            return {
                ...state,
                csv: action.csv,
                mappings: action.mappings,
                jobPhase: 'idle',
                jobResult: null,
                error: null,
            };

        case 'CLEAR_CSV':
            return { ...state, csv: null, mappings: [] };

        case 'SET_MAPPINGS':
            return { ...state, mappings: action.mappings };

        case 'TOGGLE_MAPPING':
            return {
                ...state,
                mappings: state.mappings.map(m =>
                    m.csvIndex === action.csvIndex ? { ...m, included: !m.included } : m
                ),
            };

        case 'SET_MAPPING_TARGET':
            return {
                ...state,
                mappings: state.mappings.map(m =>
                    m.csvIndex === action.csvIndex
                        ? {
                              ...m,
                              fieldApiName: action.fieldApiName,
                              included: action.fieldApiName !== null,
                              mappingSource: action.fieldApiName !== null ? 'manual' : 'none',
                          }
                        : m
                ),
            };

        case 'SET_BATCH_SIZE':
            return { ...state, batchSize: action.batchSize };

        case 'SET_JOB_PHASE':
            return { ...state, jobPhase: action.phase, error: null };

        case 'SET_JOB_RESULT':
            return { ...state, jobResult: action.result, jobPhase: 'complete' };

        case 'SET_ERROR':
            return { ...state, error: action.error, jobPhase: 'failed' };

        case 'RESET':
            return { ...initialState };
    }
}

// ============================================================
// Hook
// ============================================================

export function useImportState() {
    const [state, dispatch] = useReducer(importReducer, initialState);

    const setOperation = useCallback(
        (operation: BulkIngestOperation) => dispatch({ type: 'SET_OPERATION', operation }),
        []
    );

    const setObject = useCallback(
        (objectName: string | null) => dispatch({ type: 'SET_OBJECT', objectName }),
        []
    );

    const setExternalIdField = useCallback(
        (field: string | null) => dispatch({ type: 'SET_EXTERNAL_ID_FIELD', field }),
        []
    );

    const setCsv = useCallback(
        (csv: ImportCsvMeta, mappings: ColumnMapping[]) =>
            dispatch({ type: 'SET_CSV', csv, mappings }),
        []
    );

    const clearCsv = useCallback(() => dispatch({ type: 'CLEAR_CSV' }), []);

    const setMappings = useCallback(
        (mappings: ColumnMapping[]) => dispatch({ type: 'SET_MAPPINGS', mappings }),
        []
    );

    const toggleMapping = useCallback(
        (csvIndex: number) => dispatch({ type: 'TOGGLE_MAPPING', csvIndex }),
        []
    );

    const setMappingTarget = useCallback(
        (csvIndex: number, fieldApiName: string | null) =>
            dispatch({ type: 'SET_MAPPING_TARGET', csvIndex, fieldApiName }),
        []
    );

    const setBatchSize = useCallback(
        (batchSize: number) => dispatch({ type: 'SET_BATCH_SIZE', batchSize }),
        []
    );

    const setJobPhase = useCallback(
        (phase: ImportState['jobPhase']) => dispatch({ type: 'SET_JOB_PHASE', phase }),
        []
    );

    const setJobResult = useCallback(
        (result: BulkIngestResults) => dispatch({ type: 'SET_JOB_RESULT', result }),
        []
    );

    const setError = useCallback((error: string) => dispatch({ type: 'SET_ERROR', error }), []);

    const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

    return {
        state,
        dispatch,
        setOperation,
        setObject,
        setExternalIdField,
        setCsv,
        clearCsv,
        setMappings,
        toggleMapping,
        setMappingTarget,
        setBatchSize,
        setJobPhase,
        setJobResult,
        setError,
        reset,
    };
}
