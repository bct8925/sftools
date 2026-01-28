import { useCallback } from 'react';
import { useConnection } from '../../contexts';
import { flattenColumnMetadata, type QueryColumn } from '../../lib/column-utils';
import { executeQueryWithColumns, fetchQueryMore, getObjectDescribe } from '../../lib/salesforce';
import type { FieldDescribe, SObject } from '../../types/salesforce';
import type { StatusType } from '../../hooks/useStatusBadge';

interface UseQueryExecutionOptions {
    editorRef: React.RefObject<{ getValue(): string } | null>;
    editorValue: string;
    useToolingApi: boolean;
    setLoading: (tabId: string, loading: boolean) => void;
    setResults: (
        tabId: string,
        results: {
            records: SObject[];
            columns: QueryColumn[];
            totalSize: number;
            done: boolean;
            nextRecordsUrl: string | null;
            objectName: string | null;
            isEditable: boolean;
            fieldDescribe: Record<string, FieldDescribe> | null;
        }
    ) => void;
    appendResults: (
        tabId: string,
        results: {
            records: SObject[];
            done: boolean;
            nextRecordsUrl: string | null;
        }
    ) => void;
    setLoadingMore: (tabId: string, isLoadingMore: boolean) => void;
    setError: (tabId: string, error: string) => void;
    findTabByQuery: (query: string) => { id: string; query: string } | undefined;
    setActiveTab: (tabId: string) => void;
    addTab: (query: string) => string;
    normalizeQuery: (query: string) => string;
    updateStatus: (text: string, type?: StatusType) => void;
    setFilterText: (text: string) => void;
    saveToHistory: (query: string) => Promise<void>;
}

/**
 * Hook that provides query execution functionality.
 * Extracted from QueryTab to reduce complexity.
 */
export function useQueryExecution(options: UseQueryExecutionOptions) {
    const { isAuthenticated } = useConnection();

    // Check if query results are editable
    const isEditable = useCallback((columns: QueryColumn[], objectName: string | null): boolean => {
        const hasIdColumn = columns.some(col => col.path === 'Id');
        if (!hasIdColumn) return false;

        const hasAggregate = columns.some(col => col.aggregate);
        if (hasAggregate) return false;

        if (!objectName) return false;

        return true;
    }, []);

    // Extract columns from record when no metadata
    const extractColumnsFromRecord = useCallback((record: SObject): QueryColumn[] => {
        return Object.keys(record)
            .filter(key => key !== 'attributes')
            .map(key => ({
                title: key,
                path: key,
                aggregate: false,
                isSubquery: false,
            }));
    }, []);

    // Execute query and fetch data
    // Returns true if successful, false if there was an error
    const fetchQueryData = useCallback(
        async (tabId: string, query: string): Promise<boolean> => {
            options.setLoading(tabId, true);
            options.updateStatus('Loading...', 'loading');

            try {
                const result = await executeQueryWithColumns(query, options.useToolingApi);

                // Process columns
                let columns: QueryColumn[];
                if (result.columnMetadata.length > 0) {
                    columns = flattenColumnMetadata(result.columnMetadata);
                } else if (result.records.length > 0) {
                    columns = extractColumnsFromRecord(result.records[0]);
                } else {
                    columns = [];
                }

                const canEdit = isEditable(columns, result.entityName);

                // Fetch field metadata if editable
                let fieldDescribe: Record<string, FieldDescribe> | null = null;
                if (canEdit && result.entityName) {
                    try {
                        const describe = await getObjectDescribe(result.entityName);
                        fieldDescribe = {};
                        for (const field of describe.fields) {
                            fieldDescribe[field.name] = field;
                        }
                    } catch {
                        // Failed to get metadata, disable editing
                    }
                }

                options.setResults(tabId, {
                    records: result.records,
                    columns,
                    totalSize: result.totalSize,
                    done: result.done,
                    nextRecordsUrl: result.nextRecordsUrl,
                    objectName: result.entityName,
                    isEditable: canEdit && fieldDescribe !== null,
                    fieldDescribe,
                });

                options.updateStatus(
                    `${result.totalSize} record${result.totalSize !== 1 ? 's' : ''}`,
                    'success'
                );

                // Clear filter
                options.setFilterText('');
                return true;
            } catch (error) {
                options.setError(tabId, (error as Error).message);
                options.updateStatus('Error', 'error');
                return false;
            }
        },
        [
            options.useToolingApi,
            options.setLoading,
            options.setResults,
            options.setError,
            options.updateStatus,
            options.setFilterText,
            isEditable,
            extractColumnsFromRecord,
        ]
    );

    // Execute query
    const executeQuery = useCallback(async () => {
        const query = options.editorRef.current?.getValue().trim() || options.editorValue.trim();

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        const normalized = options.normalizeQuery(query);

        // Check if query already exists as a tab
        const existingTab = options.findTabByQuery(normalized);
        if (existingTab) {
            options.setActiveTab(existingTab.id);
            const success = await fetchQueryData(existingTab.id, query);
            if (success) {
                await options.saveToHistory(query);
            }
            return;
        }

        // Create new tab
        const tabId = options.addTab(query);
        const success = await fetchQueryData(tabId, query);
        if (success) {
            await options.saveToHistory(query);
        }
    }, [
        options.editorValue,
        options.editorRef,
        options.normalizeQuery,
        options.findTabByQuery,
        options.setActiveTab,
        options.addTab,
        options.saveToHistory,
        isAuthenticated,
        fetchQueryData,
    ]);

    // Load more results for paginated query
    const loadMore = useCallback(
        async (tabId: string, nextRecordsUrl: string) => {
            options.setLoadingMore(tabId, true);
            options.updateStatus('Loading more...', 'loading');

            try {
                const result = await fetchQueryMore(nextRecordsUrl);

                options.appendResults(tabId, {
                    records: result.records,
                    done: result.done,
                    nextRecordsUrl: result.nextRecordsUrl,
                });

                options.updateStatus(`Loaded ${result.records.length} more records`, 'success');
            } catch (error) {
                options.setLoadingMore(tabId, false);
                options.updateStatus('Error loading more', 'error');
            }
        },
        [options.setLoadingMore, options.appendResults, options.updateStatus]
    );

    return { fetchQueryData, executeQuery, loadMore };
}
