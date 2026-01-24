// Query Tab State Management with useReducer
import { useReducer, useCallback, useMemo } from 'react';
import type { ColumnMetadata, FieldDescribe, SObject } from '../../types/salesforce';

// Column definition for display
export interface QueryColumn {
    title: string;
    path: string;
    aggregate: boolean;
    isSubquery: boolean;
    subqueryColumns?: ColumnMetadata[];
}

// Individual query tab state
export interface QueryTabState {
    id: string;
    query: string;
    normalizedQuery: string;
    objectName: string | null;
    records: SObject[];
    columns: QueryColumn[];
    totalSize: number;
    fieldDescribe: Record<string, FieldDescribe> | null;
    modifiedRecords: Map<string, Record<string, unknown>>;
    isEditable: boolean;
    isLoading: boolean;
    error: string | null;
}

// Overall query state
export interface QueryState {
    tabs: QueryTabState[];
    activeTabId: string | null;
    tabCounter: number;
}

// Action types
export type QueryAction =
    | { type: 'ADD_TAB'; query: string; normalizedQuery: string }
    | { type: 'REMOVE_TAB'; id: string }
    | { type: 'SET_ACTIVE_TAB'; id: string }
    | { type: 'UPDATE_QUERY'; id: string; query: string }
    | { type: 'SET_LOADING'; id: string; isLoading: boolean }
    | { type: 'SET_ERROR'; id: string; error: string }
    | {
          type: 'SET_RESULTS';
          id: string;
          records: SObject[];
          columns: QueryColumn[];
          totalSize: number;
          objectName: string | null;
          isEditable: boolean;
          fieldDescribe: Record<string, FieldDescribe> | null;
      }
    | { type: 'SET_MODIFIED'; id: string; recordId: string; fieldName: string; value: unknown }
    | { type: 'CLEAR_MODIFIED'; id: string; recordId: string; fieldName: string }
    | { type: 'CLEAR_ALL_MODIFIED'; id: string }
    | { type: 'UPDATE_RECORD_DATA'; id: string; recordId: string; fields: Record<string, unknown> };

// Initial state
const initialState: QueryState = {
    tabs: [],
    activeTabId: null,
    tabCounter: 0,
};

// Normalize query for deduplication
export function normalizeQuery(query: string): string {
    return query.toLowerCase().replace(/\s+/g, ' ').trim();
}

// Reducer function
function queryReducer(state: QueryState, action: QueryAction): QueryState {
    switch (action.type) {
        case 'ADD_TAB': {
            const newId = `query-tab-${state.tabCounter + 1}`;
            const newTab: QueryTabState = {
                id: newId,
                query: action.query,
                normalizedQuery: action.normalizedQuery,
                objectName: null,
                records: [],
                columns: [],
                totalSize: 0,
                fieldDescribe: null,
                modifiedRecords: new Map(),
                isEditable: false,
                isLoading: false,
                error: null,
            };
            return {
                ...state,
                tabs: [...state.tabs, newTab],
                activeTabId: newId,
                tabCounter: state.tabCounter + 1,
            };
        }

        case 'REMOVE_TAB': {
            const tabIndex = state.tabs.findIndex(t => t.id === action.id);
            if (tabIndex === -1) return state;

            const newTabs = state.tabs.filter(t => t.id !== action.id);
            let newActiveId = state.activeTabId;

            if (state.activeTabId === action.id) {
                // Set to the last tab if available
                newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
            }

            return {
                ...state,
                tabs: newTabs,
                activeTabId: newActiveId,
            };
        }

        case 'SET_ACTIVE_TAB': {
            return {
                ...state,
                activeTabId: action.id,
            };
        }

        case 'UPDATE_QUERY': {
            return {
                ...state,
                tabs: state.tabs.map(tab =>
                    tab.id === action.id ? { ...tab, query: action.query } : tab
                ),
            };
        }

        case 'SET_LOADING': {
            return {
                ...state,
                tabs: state.tabs.map(tab =>
                    tab.id === action.id
                        ? {
                              ...tab,
                              isLoading: action.isLoading,
                              error: action.isLoading ? null : tab.error,
                          }
                        : tab
                ),
            };
        }

        case 'SET_ERROR': {
            return {
                ...state,
                tabs: state.tabs.map(tab =>
                    tab.id === action.id
                        ? {
                              ...tab,
                              error: action.error,
                              isLoading: false,
                              records: [],
                              columns: [],
                          }
                        : tab
                ),
            };
        }

        case 'SET_RESULTS': {
            return {
                ...state,
                tabs: state.tabs.map(tab =>
                    tab.id === action.id
                        ? {
                              ...tab,
                              records: action.records,
                              columns: action.columns,
                              totalSize: action.totalSize,
                              objectName: action.objectName,
                              isEditable: action.isEditable,
                              fieldDescribe: action.fieldDescribe,
                              isLoading: false,
                              error: null,
                              modifiedRecords: new Map(), // Clear modifications on new results
                          }
                        : tab
                ),
            };
        }

        case 'SET_MODIFIED': {
            return {
                ...state,
                tabs: state.tabs.map(tab => {
                    if (tab.id !== action.id) return tab;

                    const newModified = new Map(tab.modifiedRecords);
                    const recordMods = newModified.get(action.recordId) || {};
                    newModified.set(action.recordId, {
                        ...recordMods,
                        [action.fieldName]: action.value,
                    });

                    return { ...tab, modifiedRecords: newModified };
                }),
            };
        }

        case 'CLEAR_MODIFIED': {
            return {
                ...state,
                tabs: state.tabs.map(tab => {
                    if (tab.id !== action.id) return tab;

                    const newModified = new Map(tab.modifiedRecords);
                    const recordMods = newModified.get(action.recordId);
                    if (recordMods) {
                        const { [action.fieldName]: _, ...rest } = recordMods;
                        if (Object.keys(rest).length === 0) {
                            newModified.delete(action.recordId);
                        } else {
                            newModified.set(action.recordId, rest);
                        }
                    }

                    return { ...tab, modifiedRecords: newModified };
                }),
            };
        }

        case 'CLEAR_ALL_MODIFIED': {
            return {
                ...state,
                tabs: state.tabs.map(tab =>
                    tab.id === action.id ? { ...tab, modifiedRecords: new Map() } : tab
                ),
            };
        }

        case 'UPDATE_RECORD_DATA': {
            return {
                ...state,
                tabs: state.tabs.map(tab => {
                    if (tab.id !== action.id) return tab;

                    const updatedRecords = tab.records.map(record => {
                        if (record.Id === action.recordId) {
                            return { ...record, ...action.fields };
                        }
                        return record;
                    });

                    return { ...tab, records: updatedRecords };
                }),
            };
        }

        default:
            return state;
    }
}

// Custom hook for query state management
export function useQueryState() {
    const [state, dispatch] = useReducer(queryReducer, initialState);

    // Derived state
    const activeTab = useMemo(() => {
        return state.tabs.find(t => t.id === state.activeTabId) || null;
    }, [state.tabs, state.activeTabId]);

    // Find tab by normalized query
    const findTabByQuery = useCallback(
        (normalizedQuery: string) => {
            return state.tabs.find(t => t.normalizedQuery === normalizedQuery);
        },
        [state.tabs]
    );

    // Actions
    const addTab = useCallback(
        (query: string) => {
            const normalized = normalizeQuery(query);
            dispatch({ type: 'ADD_TAB', query, normalizedQuery: normalized });
            return `query-tab-${state.tabCounter + 1}`;
        },
        [state.tabCounter]
    );

    const removeTab = useCallback((id: string) => {
        dispatch({ type: 'REMOVE_TAB', id });
    }, []);

    const setActiveTab = useCallback((id: string) => {
        dispatch({ type: 'SET_ACTIVE_TAB', id });
    }, []);

    const updateQuery = useCallback((id: string, query: string) => {
        dispatch({ type: 'UPDATE_QUERY', id, query });
    }, []);

    const setLoading = useCallback((id: string, isLoading: boolean) => {
        dispatch({ type: 'SET_LOADING', id, isLoading });
    }, []);

    const setError = useCallback((id: string, error: string) => {
        dispatch({ type: 'SET_ERROR', id, error });
    }, []);

    const setResults = useCallback(
        (
            id: string,
            data: {
                records: SObject[];
                columns: QueryColumn[];
                totalSize: number;
                objectName: string | null;
                isEditable: boolean;
                fieldDescribe: Record<string, FieldDescribe> | null;
            }
        ) => {
            dispatch({ type: 'SET_RESULTS', id, ...data });
        },
        []
    );

    const setModified = useCallback(
        (id: string, recordId: string, fieldName: string, value: unknown) => {
            dispatch({ type: 'SET_MODIFIED', id, recordId, fieldName, value });
        },
        []
    );

    const clearModified = useCallback((id: string, recordId: string, fieldName: string) => {
        dispatch({ type: 'CLEAR_MODIFIED', id, recordId, fieldName });
    }, []);

    const clearAllModified = useCallback((id: string) => {
        dispatch({ type: 'CLEAR_ALL_MODIFIED', id });
    }, []);

    const updateRecordData = useCallback(
        (id: string, recordId: string, fields: Record<string, unknown>) => {
            dispatch({ type: 'UPDATE_RECORD_DATA', id, recordId, fields });
        },
        []
    );

    return {
        state,
        activeTab,
        findTabByQuery,
        addTab,
        removeTab,
        setActiveTab,
        updateQuery,
        setLoading,
        setError,
        setResults,
        setModified,
        clearModified,
        clearAllModified,
        updateRecordData,
    };
}
