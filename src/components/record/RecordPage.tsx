import { useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import type { FieldDescribe, SObject, SalesforceConnection } from '../../types/salesforce';
import { getObjectDescribe, getRecordWithRelationships, updateRecord } from '../../api/salesforce';
import { setActiveConnection } from '../../auth/auth';
import { sortFields, filterFields, getChangedFields } from '../../lib/record-utils';
import { FieldRow } from './FieldRow';
import { RichTextModal } from './RichTextModal';
import { useToast } from '../../contexts/ToastContext';
import styles from './RecordPage.module.css';

// State interface
interface RecordPageState {
    // URL params
    objectType: string | null;
    recordId: string | null;
    connectionId: string | null;
    instanceUrl: string | null;

    // Data
    fieldDescribe: Record<string, FieldDescribe>;
    nameFieldMap: Record<string, string>;
    originalValues: Record<string, unknown>;
    currentValues: Record<string, unknown>;
    objectLabel: string;
    sortedFields: FieldDescribe[];

    // UI
    isLoading: boolean;
    error: string | null;
    isSaving: boolean;

    // Modal
    previewField: FieldDescribe | null;
    previewValue: unknown;
    isModalOpen: boolean;
}

// Action types
type RecordPageAction =
    | { type: 'SET_URL_PARAMS'; objectType: string; recordId: string; connectionId: string }
    | { type: 'SET_ERROR'; error: string }
    | { type: 'SET_INSTANCE_URL'; instanceUrl: string }
    | { type: 'SET_LOADING'; isLoading: boolean }
    | {
          type: 'SET_RECORD_DATA';
          fieldDescribe: Record<string, FieldDescribe>;
          nameFieldMap: Record<string, string>;
          sortedFields: FieldDescribe[];
          objectLabel: string;
          recordData: Record<string, unknown>;
      }
    | { type: 'UPDATE_FIELD'; fieldName: string; value: unknown }
    | { type: 'SET_SAVING'; isSaving: boolean }
    | { type: 'COMMIT_CHANGES'; changedFields: Record<string, unknown> }
    | { type: 'OPEN_PREVIEW'; field: FieldDescribe; value: unknown }
    | { type: 'CLOSE_PREVIEW' };

// Initial state
const initialState: RecordPageState = {
    objectType: null,
    recordId: null,
    connectionId: null,
    instanceUrl: null,
    fieldDescribe: {},
    nameFieldMap: {},
    originalValues: {},
    currentValues: {},
    objectLabel: 'Loading...',
    sortedFields: [],
    isLoading: true,
    error: null,
    isSaving: false,
    previewField: null,
    previewValue: null,
    isModalOpen: false,
};

// Reducer
function recordPageReducer(state: RecordPageState, action: RecordPageAction): RecordPageState {
    switch (action.type) {
        case 'SET_URL_PARAMS':
            return {
                ...state,
                objectType: action.objectType,
                recordId: action.recordId,
                connectionId: action.connectionId,
            };

        case 'SET_ERROR':
            return {
                ...state,
                error: action.error,
                isLoading: false,
            };

        case 'SET_INSTANCE_URL':
            return { ...state, instanceUrl: action.instanceUrl };

        case 'SET_LOADING':
            return {
                ...state,
                isLoading: action.isLoading,
                error: action.isLoading ? null : state.error,
            };

        case 'SET_RECORD_DATA':
            return {
                ...state,
                fieldDescribe: action.fieldDescribe,
                nameFieldMap: action.nameFieldMap,
                sortedFields: action.sortedFields,
                objectLabel: action.objectLabel,
                originalValues: action.recordData,
                currentValues: action.recordData,
                isLoading: false,
            };

        case 'UPDATE_FIELD':
            return {
                ...state,
                currentValues: {
                    ...state.currentValues,
                    [action.fieldName]: action.value,
                },
            };

        case 'SET_SAVING':
            return { ...state, isSaving: action.isSaving };

        case 'COMMIT_CHANGES':
            return {
                ...state,
                originalValues: {
                    ...state.originalValues,
                    ...action.changedFields,
                },
            };

        case 'OPEN_PREVIEW':
            return {
                ...state,
                previewField: action.field,
                previewValue: action.value,
                isModalOpen: true,
            };

        case 'CLOSE_PREVIEW':
            return {
                ...state,
                previewField: null,
                previewValue: null,
                isModalOpen: false,
            };

        default:
            return state;
    }
}

/**
 * Record Viewer page - displays and edits a single Salesforce record.
 * Parses URL params for recordId, objectType, and connectionId.
 */
export function RecordPage() {
    const [state, dispatch] = useReducer(recordPageReducer, initialState);
    const toast = useToast();
    const activeToastRef = useRef<string | null>(null);

    // Computed values
    const changedFields = useMemo(
        () => getChangedFields(state.originalValues, state.currentValues, state.fieldDescribe),
        [state.originalValues, state.currentValues, state.fieldDescribe]
    );
    const changeCount = Object.keys(changedFields).length;
    const hasChanges = changeCount > 0;

    // Initialize from URL params and load connection
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const objType = params.get('objectType');
        const recId = params.get('recordId');
        const connId = params.get('connectionId');

        if (!objType || !recId || !connId) {
            dispatch({ type: 'SET_ERROR', error: 'Missing required parameters' });
            return;
        }

        dispatch({
            type: 'SET_URL_PARAMS',
            objectType: objType,
            recordId: recId,
            connectionId: connId,
        });

        // Load connection and set as active
        const loadConnection = async () => {
            const { connections } = await chrome.storage.local.get(['connections']);
            const connection = (connections as SalesforceConnection[] | undefined)?.find(
                c => c.id === connId
            );

            if (!connection) {
                dispatch({
                    type: 'SET_ERROR',
                    error: 'Connection not found. Please re-authorize.',
                });
                return;
            }

            dispatch({ type: 'SET_INSTANCE_URL', instanceUrl: connection.instanceUrl });
            setActiveConnection(connection);
        };

        loadConnection();
    }, []);

    // Load record when connection is set
    useEffect(() => {
        if (!state.instanceUrl || !state.objectType || !state.recordId) return;

        const loadRecord = async () => {
            dispatch({ type: 'SET_LOADING', isLoading: true });
            const id = toast.show('Loading record...', 'loading');
            activeToastRef.current = id;

            try {
                const describe = await getObjectDescribe(state.objectType!);
                const { record, nameFieldMap: nfMap } = await getRecordWithRelationships(
                    state.objectType!,
                    state.recordId!,
                    describe.fields
                );

                // Build field describe map
                const fieldMap: Record<string, FieldDescribe> = {};
                for (const field of describe.fields) {
                    fieldMap[field.name] = field;
                }

                // Sort and filter fields for display
                const sorted = sortFields(describe.fields);
                const filtered = filterFields(sorted);

                document.title = `${state.recordId} - Record Viewer - sftools`;

                dispatch({
                    type: 'SET_RECORD_DATA',
                    fieldDescribe: fieldMap,
                    nameFieldMap: nfMap,
                    sortedFields: filtered,
                    objectLabel: describe.label,
                    recordData: { ...record },
                });
                toast.update(activeToastRef.current!, 'Loaded', 'success');
                activeToastRef.current = null;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                dispatch({ type: 'SET_ERROR', error: message });
                toast.update(activeToastRef.current!, message, 'error');
                activeToastRef.current = null;
            }
        };

        loadRecord();
    }, [state.instanceUrl, state.objectType, state.recordId]);

    const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
        dispatch({ type: 'UPDATE_FIELD', fieldName, value });
    }, []);

    const handlePreviewClick = useCallback((field: FieldDescribe, value: unknown) => {
        dispatch({ type: 'OPEN_PREVIEW', field, value });
    }, []);

    const handleCloseModal = useCallback(() => {
        dispatch({ type: 'CLOSE_PREVIEW' });
    }, []);

    const handleSave = useCallback(async () => {
        if (!hasChanges || !state.objectType || !state.recordId) return;

        dispatch({ type: 'SET_SAVING', isSaving: true });
        const id = toast.show('Saving...', 'loading');
        activeToastRef.current = id;

        try {
            await updateRecord(state.objectType, state.recordId, changedFields);

            dispatch({ type: 'COMMIT_CHANGES', changedFields });
            toast.update(activeToastRef.current!, 'Saved', 'success');
            activeToastRef.current = null;
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            toast.update(activeToastRef.current!, 'Save Failed', 'error');
            activeToastRef.current = null;
            alert(`Error saving record: ${message}`);
        } finally {
            dispatch({ type: 'SET_SAVING', isSaving: false });
        }
    }, [hasChanges, state.objectType, state.recordId, changedFields]);

    const handleRefresh = useCallback(() => {
        if (!state.instanceUrl || !state.objectType || !state.recordId) return;

        const loadRecord = async () => {
            dispatch({ type: 'SET_LOADING', isLoading: true });
            const id = toast.show('Loading record...', 'loading');
            activeToastRef.current = id;

            try {
                const describe = await getObjectDescribe(state.objectType!);
                const { record, nameFieldMap: nfMap } = await getRecordWithRelationships(
                    state.objectType!,
                    state.recordId!,
                    describe.fields
                );

                const fieldMap: Record<string, FieldDescribe> = {};
                for (const field of describe.fields) {
                    fieldMap[field.name] = field;
                }

                const sorted = sortFields(describe.fields);
                const filtered = filterFields(sorted);

                document.title = `${state.recordId} - Record Viewer - sftools`;

                dispatch({
                    type: 'SET_RECORD_DATA',
                    fieldDescribe: fieldMap,
                    nameFieldMap: nfMap,
                    sortedFields: filtered,
                    objectLabel: describe.label,
                    recordData: { ...record },
                });
                toast.update(activeToastRef.current!, 'Loaded', 'success');
                activeToastRef.current = null;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Unknown error';
                dispatch({ type: 'SET_ERROR', error: message });
                toast.update(activeToastRef.current!, message, 'error');
                activeToastRef.current = null;
            }
        };

        loadRecord();
    }, [state.instanceUrl, state.objectType, state.recordId]);

    const handleOpenInOrg = useCallback(() => {
        if (state.instanceUrl && state.objectType && state.recordId) {
            const url = `${state.instanceUrl}/lightning/r/${state.objectType}/${state.recordId}/view`;
            window.open(url, '_blank');
        }
    }, [state.instanceUrl, state.objectType, state.recordId]);

    // Render error state
    if (state.error && !state.isLoading) {
        return (
            <div data-testid="record-page">
                <header className="standalone-header">
                    <div className="nav-brand">
                        <img src="../../icon.png" alt="" />
                        sftools
                    </div>
                    <span className="tool-name">Record Viewer</span>
                </header>
                <main className="content-area">
                    <div className="card">
                        <div className="card-header">
                            <div className={`card-header-icon ${styles.headerIcon}`}>R</div>
                            <h2>Record Details</h2>
                        </div>
                        <div className="card-body">
                            <div className={styles.errorContainer}>
                                <p className={styles.errorMessage}>{state.error}</p>
                                <p className={styles.errorHint}>
                                    Please check the connection and try again.
                                </p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div data-testid="record-page">
            <header className="standalone-header">
                <div className="nav-brand">
                    <img src="../../icon.png" alt="" />
                    sftools
                </div>
                <span className="tool-name">Record Viewer</span>
            </header>

            <main className="content-area">
                <div className="card">
                    <div className="card-header">
                        <div className={`card-header-icon ${styles.headerIcon}`}>R</div>
                        <h2>Record Details</h2>
                    </div>
                    <div className="card-body">
                        <div className={styles.recordInfo}>
                            <span className={styles.objectName} id="objectName">
                                {state.objectLabel}
                            </span>
                            <span className={styles.recordId} id="recordId">
                                {state.recordId}
                            </span>
                            <button
                                className={`button-neutral ${styles.openInOrgBtn}`}
                                onClick={handleOpenInOrg}
                                id="openInOrgBtn"
                            >
                                Open in Org
                            </button>
                        </div>

                        <div className={styles.fieldHeader}>
                            <div>Field Label</div>
                            <div>API Name</div>
                            <div>Type</div>
                            <div>Value</div>
                            <div>Preview</div>
                        </div>

                        <div className={styles.fieldsContainer} id="fieldsContainer">
                            {state.isLoading ? (
                                <div className={styles.loadingContainer}>
                                    Loading record data...
                                </div>
                            ) : (
                                state.sortedFields.map(field => (
                                    <FieldRow
                                        key={field.name}
                                        field={field}
                                        value={state.currentValues[field.name]}
                                        originalValue={state.originalValues[field.name]}
                                        record={state.currentValues as SObject}
                                        nameFieldMap={state.nameFieldMap}
                                        connectionId={state.connectionId || ''}
                                        onChange={handleFieldChange}
                                        onPreviewClick={handlePreviewClick}
                                    />
                                ))
                            )}
                        </div>

                        <div className={styles.actionsBar}>
                            <button
                                className={`button-brand ${styles.saveBtn}`}
                                onClick={handleSave}
                                disabled={!hasChanges || state.isSaving}
                                id="saveBtn"
                            >
                                Save Changes
                            </button>
                            <button
                                className="button-neutral"
                                onClick={handleRefresh}
                                disabled={state.isLoading}
                                id="refreshBtn"
                            >
                                Refresh
                            </button>
                            <span className={styles.changeCount} id="changeCount">
                                {changeCount > 0
                                    ? `${changeCount} field${changeCount > 1 ? 's' : ''} modified`
                                    : ''}
                            </span>
                        </div>
                    </div>
                </div>
            </main>

            <RichTextModal
                isOpen={state.isModalOpen}
                onClose={handleCloseModal}
                field={state.previewField}
                value={state.previewValue}
            />
        </div>
    );
}
