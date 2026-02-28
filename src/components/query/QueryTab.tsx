// Query Tab - SOQL Query Editor with tabbed results (React version)
import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { useToast } from '../../contexts/ToastContext';
import { useFilteredResults } from '../../hooks/useFilteredResults';
import { ButtonIcon, ButtonIconOption, ButtonIconCheckbox } from '../button-icon/ButtonIcon';
import { QueryEditor, clearQueryAutocompleteState, type QueryEditorRef } from './QueryEditor';
import { QueryTabs } from './QueryTabs';
import { QueryResults } from './QueryResults';
import { QueryHistory, useSaveToHistory } from './QueryHistory';
import { useQueryState, normalizeQuery } from './useQueryState';
import { useQueryExecution } from './useQueryExecution';
import { executeBulkQueryExport, updateRecord } from '../../api/salesforce';
import {
    getValueByPath,
    formatCellValue,
    escapeCsvField,
    getExportFilename,
    downloadCsv,
} from '../../lib/csv-utils';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import type { HistoryManager } from '../../lib/history-manager';
import styles from './QueryTab.module.css';

const DEFAULT_QUERY = `SELECT
    Id,
    Name
FROM Account
LIMIT 10`;

/**
 * Query Tab - Main SOQL query editor with multi-tab results support.
 * Migrated from Web Component to React.
 */
export function QueryTab() {
    const { isAuthenticated, activeConnection } = useConnection();

    // Query state management
    const {
        state,
        activeTab,
        findTabByQuery,
        addTab,
        removeTab,
        setActiveTab,
        setLoading,
        setLoadingMore,
        setError,
        setResults,
        appendResults,
        setModified,
        clearModified,
        clearAllModified,
        updateRecordData,
    } = useQueryState();

    // UI state
    const [useToolingApi, setUseToolingApi] = useState(false);
    const [includeDeleted, setIncludeDeleted] = useState(false);
    const [editingEnabled, setEditingEnabled] = useState(false);
    const [bulkExportInProgress, setBulkExportInProgress] = useState(false);
    const [isQueryCollapsed, setIsQueryCollapsed] = useState(false);
    const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
    const handleToggleQuery = useCallback(() => setIsQueryCollapsed(prev => !prev), []);
    const handleToggleResults = useCallback(() => setIsResultsCollapsed(prev => !prev), []);
    const toast = useToast();
    const toastIdRef = useRef<string | null>(null);

    // Filter hook
    const { filterText, setFilterText, handleFilterChange } = useFilteredResults();

    // Editor ref and initial query state
    const editorRef = useRef<QueryEditorRef>(null);
    const [initialQuery, setInitialQuery] = useState<string | null>(null);

    // Load last query from history or favorites on mount (whichever is more recent)
    useEffect(() => {
        chrome.storage.local.get(['queryHistory', 'queryFavorites']).then(data => {
            const history = data.queryHistory as
                | Array<{ query: string; timestamp: number }>
                | undefined;
            const favorites = data.queryFavorites as
                | Array<{ query: string; timestamp: number }>
                | undefined;

            // Find most recent from both arrays
            const lastHistory = history?.[0];
            const lastFavorite = favorites?.reduce(
                (latest, fav) => (!latest || fav.timestamp > latest.timestamp ? fav : latest),
                undefined as (typeof favorites)[0] | undefined
            );

            let lastQuery: string | undefined;
            if (lastHistory && lastFavorite) {
                lastQuery =
                    lastHistory.timestamp > lastFavorite.timestamp
                        ? lastHistory.query
                        : lastFavorite.query;
            } else if (lastHistory) {
                lastQuery = lastHistory.query;
            } else if (lastFavorite) {
                lastQuery = lastFavorite.query;
            }

            // Set resolved initial query (use DEFAULT_QUERY if no history)
            setInitialQuery(lastQuery ?? DEFAULT_QUERY);
        });
    }, []);

    // History manager ref
    const historyManagerRef = useRef<HistoryManager | null>(null);
    const saveToHistory = useSaveToHistory(historyManagerRef);

    // Query execution hook
    const { fetchQueryData, executeQuery, loadMore } = useQueryExecution({
        editorRef,
        useToolingApi,
        includeDeleted,
        setLoading,
        setResults,
        appendResults,
        setLoadingMore,
        setError,
        findTabByQuery,
        setActiveTab,
        addTab,
        normalizeQuery,
        setFilterText,
        saveToHistory,
    });

    // Handle connection change - clear autocomplete state
    useEffect(() => {
        clearQueryAutocompleteState();
    }, [activeConnection?.id]);

    // Handle tab refresh
    const handleTabRefresh = useCallback(
        async (tabId: string) => {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                await fetchQueryData(tabId, tab.query);
            }
        },
        [state.tabs, fetchQueryData]
    );

    // Handle tab select
    const handleTabSelect = useCallback(
        (tabId: string) => {
            const tab = state.tabs.find(t => t.id === tabId);
            if (tab) {
                setActiveTab(tabId);
                editorRef.current?.setValue(tab.query);
                setFilterText('');
            }
        },
        [state.tabs, setActiveTab]
    );

    // Handle tab close
    const handleTabClose = useCallback(
        (tabId: string) => {
            removeTab(tabId);
        },
        [removeTab]
    );

    // Handle field change in table
    const handleFieldChange = useCallback(
        (recordId: string, fieldName: string, newValue: unknown, originalValue: unknown) => {
            if (!activeTab) return;

            const isChanged =
                originalValue === null || originalValue === undefined
                    ? newValue !== null && newValue !== undefined && newValue !== ''
                    : String(originalValue) !== String(newValue ?? '');

            if (isChanged) {
                setModified(activeTab.id, recordId, fieldName, newValue);
            } else {
                clearModified(activeTab.id, recordId, fieldName);
            }
        },
        [activeTab, setModified, clearModified]
    );

    // Export current results as CSV
    const exportCurrentResults = useCallback(() => {
        if (!activeTab || activeTab.records.length === 0) return;

        const rows: string[] = [];

        // Headers
        const headers = activeTab.columns.map(col => escapeCsvField(col.title));
        rows.push(headers.join(','));

        // Data rows
        for (const record of activeTab.records) {
            const row = activeTab.columns.map(col => {
                const value = getValueByPath(record, col.path);
                const formatted = formatCellValue(value, col);
                return escapeCsvField(formatted);
            });
            rows.push(row.join(','));
        }

        const csv = rows.join('\n');
        const filename = getExportFilename(activeTab.objectName);
        downloadCsv(csv, filename);
    }, [activeTab]);

    // Bulk export
    const handleBulkExport = useCallback(async () => {
        const query = editorRef.current?.getValue().trim() ?? '';

        if (!query) {
            alert('Please enter a SOQL query.');
            return;
        }

        if (!isAuthenticated) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        if (useToolingApi) {
            alert('Bulk export is not supported with Tooling API.');
            return;
        }

        if (bulkExportInProgress) return;

        setBulkExportInProgress(true);

        let id = toast.show('Creating bulk job...', 'loading');
        toastIdRef.current = id;

        try {
            const csv = await executeBulkQueryExport(
                query,
                (jobState, recordCount) => {
                    if (jobState === 'InProgress' || jobState === 'UploadComplete') {
                        toast.update(id, `Processing: ${recordCount || 0} records`, 'loading');
                    } else if (jobState === 'Creating job...') {
                        toast.update(id, 'Creating bulk job...', 'loading');
                    }
                },
                includeDeleted
            );

            const objectMatch = query.match(/FROM\s+(\w+)/i);
            const objectName = objectMatch ? objectMatch[1] : 'export';
            const filename = getExportFilename(objectName);

            downloadCsv(csv, filename);
            toast.dismiss(id);
        } catch (error) {
            toast.update(id, 'Export failed', 'error');
            alert(`Bulk export failed: ${(error as Error).message}`);
        } finally {
            setBulkExportInProgress(false);
            toastIdRef.current = null;
        }
    }, [isAuthenticated, useToolingApi, includeDeleted, bulkExportInProgress, toast]);

    // Save changes
    const handleSaveChanges = useCallback(async () => {
        if (!activeTab || activeTab.modifiedRecords.size === 0 || !activeTab.objectName) {
            return;
        }

        const id = toast.show('Saving...', 'loading');

        const errors: Array<{ recordId: string; error: string }> = [];

        const updatePromises = Array.from(activeTab.modifiedRecords.entries()).map(
            async ([recordId, fields]) => {
                try {
                    await updateRecord(activeTab.objectName!, recordId, fields);
                    // Update record data in state
                    updateRecordData(activeTab.id, recordId, fields);
                } catch (error) {
                    errors.push({ recordId, error: (error as Error).message });
                }
            }
        );

        await Promise.all(updatePromises);

        if (errors.length === 0) {
            clearAllModified(activeTab.id);
            toast.update(id, 'Saved', 'success');
        } else {
            toast.update(id, 'Save Failed', 'error');
            const errorMsg = errors.map(e => `Record ${e.recordId}: ${e.error}`).join('\n');
            alert(`Failed to save some records:\n\n${errorMsg}`);
        }
    }, [activeTab, toast, updateRecordData, clearAllModified]);

    // Clear changes
    const handleClearChanges = useCallback(() => {
        if (activeTab) {
            clearAllModified(activeTab.id);
        }
    }, [activeTab, clearAllModified]);

    // Handle query selection from history
    const handleSelectQuery = useCallback((query: string) => {
        editorRef.current?.setValue(query);
    }, []);

    // Handle load more results
    const handleLoadMore = useCallback(() => {
        if (activeTab && activeTab.nextRecordsUrl) {
            loadMore(activeTab.id, activeTab.nextRecordsUrl);
        }
    }, [activeTab, loadMore]);

    // Derived state
    const hasResults = activeTab && activeTab.records.length > 0 && !activeTab.error;
    const hasModifications = activeTab && activeTab.modifiedRecords.size > 0;
    const isEditMode = editingEnabled && activeTab?.isEditable;

    // Wait for initial query to be resolved before rendering editor
    if (initialQuery === null) {
        return (
            <div className={styles.queryTab} data-testid="query-tab">
                <div className="card">
                    <div className="card-header">
                        <div className={`card-header-icon ${styles.headerIconQuery}`}>S</div>
                        <h2>SOQL Query</h2>
                    </div>
                    <div className="card-body">
                        <div className={styles.editorPlaceholder} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.queryTab} data-testid="query-tab">
            {/* Query Editor Card */}
            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconQuery}`}>S</div>
                    <h2 className="card-collapse-title" onClick={handleToggleQuery}>
                        SOQL Query
                    </h2>
                    <CollapseChevron isOpen={!isQueryCollapsed} onClick={handleToggleQuery} />
                    <QueryHistory
                        onSelectQuery={handleSelectQuery}
                        historyManagerRef={historyManagerRef}
                    />
                    <ButtonIcon
                        icon="settings"
                        title="Settings"
                        className={styles.settingsBtn}
                        data-testid="query-settings-btn"
                    >
                        <ButtonIconCheckbox
                            checked={useToolingApi}
                            onChange={setUseToolingApi}
                            data-testid="query-tooling-checkbox"
                        >
                            Tooling API
                        </ButtonIconCheckbox>
                        <ButtonIconCheckbox
                            checked={includeDeleted}
                            onChange={setIncludeDeleted}
                            disabled={useToolingApi}
                            data-testid="query-deleted-checkbox"
                        >
                            Include Deleted
                        </ButtonIconCheckbox>
                    </ButtonIcon>
                </div>
                <div className="card-body" hidden={isQueryCollapsed}>
                    <div className="form-element">
                        <QueryEditor
                            ref={editorRef}
                            value={initialQuery}
                            onExecute={executeQuery}
                            className={styles.editor}
                        />
                    </div>
                    <div className={styles.footer}>
                        <button
                            className="button-brand"
                            onClick={executeQuery}
                            data-testid="query-execute-btn"
                        >
                            Query
                        </button>
                    </div>
                </div>
            </div>

            {/* Results Card */}
            <div
                className={`card ${styles.resultsCard} ${isResultsCollapsed ? styles.resultsCardCollapsed : ''}`}
            >
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconSuccess}`}>Q</div>
                    <h2 className="card-collapse-title" onClick={handleToggleResults}>
                        Results
                    </h2>
                    <CollapseChevron isOpen={!isResultsCollapsed} onClick={handleToggleResults} />
                    <div className={styles.resultsSearch}>
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Filter..."
                            onChange={handleFilterChange}
                            data-testid="query-search-input"
                        />
                    </div>
                    <ButtonIcon
                        icon="verticalDots"
                        title="Options"
                        className={styles.resultsBtn}
                        data-testid="query-results-btn"
                    >
                        <ButtonIconOption
                            disabled={!hasResults}
                            onClick={exportCurrentResults}
                            data-testid="query-export-btn"
                        >
                            Export
                        </ButtonIconOption>
                        <ButtonIconOption
                            disabled={!hasResults || bulkExportInProgress}
                            onClick={handleBulkExport}
                            data-testid="query-bulk-export-btn"
                        >
                            Bulk Export
                        </ButtonIconOption>
                        <ButtonIconCheckbox
                            checked={editingEnabled}
                            onChange={setEditingEnabled}
                            data-testid="query-editing-checkbox"
                        >
                            Enable Editing
                        </ButtonIconCheckbox>
                        <ButtonIconOption
                            disabled={!isEditMode || !hasModifications}
                            onClick={handleSaveChanges}
                            data-testid="query-save-btn"
                        >
                            Save Changes
                        </ButtonIconOption>
                        <ButtonIconOption
                            disabled={!isEditMode || !hasModifications}
                            onClick={handleClearChanges}
                            data-testid="query-clear-btn"
                        >
                            Clear Changes
                        </ButtonIconOption>
                    </ButtonIcon>
                </div>
                <div
                    className={`card-body ${styles.cardBody}`}
                    hidden={isResultsCollapsed}
                    data-testid="query-results"
                >
                    <QueryTabs
                        tabs={state.tabs}
                        activeTabId={state.activeTabId}
                        onTabSelect={handleTabSelect}
                        onTabRefresh={handleTabRefresh}
                        onTabClose={handleTabClose}
                    />
                    <QueryResults
                        activeTab={activeTab}
                        editingEnabled={editingEnabled}
                        onFieldChange={handleFieldChange}
                        filterText={filterText}
                        onLoadMore={handleLoadMore}
                        instanceUrl={activeConnection?.instanceUrl}
                    />
                </div>
            </div>
        </div>
    );
}
