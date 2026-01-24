// Query Tab - SOQL Query Editor with tabbed results (React version)
import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { ButtonIcon, ButtonIconOption, ButtonIconCheckbox } from '../button-icon/ButtonIcon';
import { QueryEditor, clearQueryAutocompleteState, type QueryEditorRef } from './QueryEditor';
import { QueryTabs } from './QueryTabs';
import { QueryResults } from './QueryResults';
import { QueryHistory, useSaveToHistory } from './QueryHistory';
import { useQueryState, normalizeQuery, type QueryColumn } from './useQueryState';
import { flattenColumnMetadata } from './QueryResultsTable';
import {
  executeQueryWithColumns,
  executeBulkQueryExport,
  getObjectDescribe,
  updateRecord,
} from '../../lib/salesforce.js';
import { StatusBadge, type StatusType } from '../status-badge/StatusBadge';
import type { HistoryManager } from '../../lib/history-manager.js';
import type { FieldDescribe, SObject } from '../../types/salesforce';
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
    setError,
    setResults,
    setModified,
    clearModified,
    clearAllModified,
    updateRecordData,
  } = useQueryState();

  // UI state
  const [useToolingApi, setUseToolingApi] = useState(false);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [bulkExportInProgress, setBulkExportInProgress] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('');

  // Editor state
  const [editorValue, setEditorValue] = useState(DEFAULT_QUERY);
  const editorRef = useRef<QueryEditorRef>(null);

  // History manager ref
  const historyManagerRef = useRef<HistoryManager | null>(null);
  const saveToHistory = useSaveToHistory(historyManagerRef);

  // Filter debounce
  const filterTimeoutRef = useRef<number | null>(null);

  // Handle connection change - clear autocomplete state
  useEffect(() => {
    clearQueryAutocompleteState();
  }, [activeConnection?.id]);

  // Update status display
  const updateStatus = useCallback((text: string, type: StatusType = '') => {
    setStatusText(text);
    setStatusType(type);
  }, []);

  // Check if query results are editable
  const checkIfEditable = useCallback((columns: QueryColumn[], objectName: string | null): boolean => {
    const hasIdColumn = columns.some((col) => col.path === 'Id');
    if (!hasIdColumn) return false;

    const hasAggregate = columns.some((col) => col.aggregate);
    if (hasAggregate) return false;

    if (!objectName) return false;

    return true;
  }, []);

  // Extract columns from record when no metadata
  const extractColumnsFromRecord = useCallback((record: SObject): QueryColumn[] => {
    return Object.keys(record)
      .filter((key) => key !== 'attributes')
      .map((key) => ({
        title: key,
        path: key,
        aggregate: false,
        isSubquery: false,
      }));
  }, []);

  // Execute query and fetch data
  const fetchQueryData = useCallback(
    async (tabId: string, query: string) => {
      setLoading(tabId, true);
      updateStatus('Loading...', 'loading');

      try {
        const result = await executeQueryWithColumns(query, useToolingApi);

        // Process columns
        let columns: QueryColumn[];
        if (result.columnMetadata.length > 0) {
          columns = flattenColumnMetadata(result.columnMetadata);
        } else if (result.records.length > 0) {
          columns = extractColumnsFromRecord(result.records[0]);
        } else {
          columns = [];
        }

        const isEditable = checkIfEditable(columns, result.entityName);

        // Fetch field metadata if editable
        let fieldDescribe: Record<string, FieldDescribe> | null = null;
        if (isEditable && result.entityName) {
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

        setResults(tabId, {
          records: result.records,
          columns,
          totalSize: result.totalSize,
          objectName: result.entityName,
          isEditable: isEditable && fieldDescribe !== null,
          fieldDescribe,
        });

        updateStatus(
          `${result.totalSize} record${result.totalSize !== 1 ? 's' : ''}`,
          'success'
        );

        // Clear filter
        setFilterText('');
      } catch (error) {
        setError(tabId, (error as Error).message);
        updateStatus('Error', 'error');
      }
    },
    [useToolingApi, setLoading, setResults, setError, updateStatus, checkIfEditable, extractColumnsFromRecord]
  );

  // Execute query
  const executeQuery = useCallback(async () => {
    const query = editorRef.current?.getValue().trim() || editorValue.trim();

    if (!query) {
      alert('Please enter a SOQL query.');
      return;
    }

    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    const normalized = normalizeQuery(query);

    // Check if query already exists as a tab
    const existingTab = findTabByQuery(normalized);
    if (existingTab) {
      setActiveTab(existingTab.id);
      await fetchQueryData(existingTab.id, query);
      await saveToHistory(query);
      return;
    }

    // Create new tab
    const tabId = addTab(query);
    await fetchQueryData(tabId, query);
    await saveToHistory(query);
  }, [editorValue, isAuthenticated, findTabByQuery, setActiveTab, addTab, fetchQueryData, saveToHistory]);

  // Handle tab refresh
  const handleTabRefresh = useCallback(
    async (tabId: string) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab) {
        await fetchQueryData(tabId, tab.query);
      }
    },
    [state.tabs, fetchQueryData]
  );

  // Handle tab select
  const handleTabSelect = useCallback(
    (tabId: string) => {
      const tab = state.tabs.find((t) => t.id === tabId);
      if (tab) {
        setActiveTab(tabId);
        setEditorValue(tab.query);
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

  // Handle filter input with debounce
  const handleFilterChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (filterTimeoutRef.current !== null) {
      clearTimeout(filterTimeoutRef.current);
    }
    filterTimeoutRef.current = window.setTimeout(() => {
      setFilterText(value);
    }, 200);
  }, []);

  // Export current results as CSV
  const exportCurrentResults = useCallback(() => {
    if (!activeTab || activeTab.records.length === 0) return;

    const rows: string[] = [];

    // Headers
    const headers = activeTab.columns.map((col) => escapeCsvField(col.title));
    rows.push(headers.join(','));

    // Data rows
    for (const record of activeTab.records) {
      const row = activeTab.columns.map((col) => {
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
    const query = editorRef.current?.getValue().trim() || editorValue.trim();

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

    try {
      const csv = await executeBulkQueryExport(query, (jobState, recordCount) => {
        if (jobState === 'InProgress' || jobState === 'UploadComplete') {
          updateStatus(`Processing: ${recordCount || 0} records`, 'loading');
        } else if (jobState === 'Creating job...') {
          updateStatus('Creating bulk job...', 'loading');
        } else if (jobState === 'Downloading...') {
          updateStatus('Downloading results...', 'loading');
        }
      });

      const objectMatch = query.match(/FROM\s+(\w+)/i);
      const objectName = objectMatch ? objectMatch[1] : 'export';
      const filename = getExportFilename(objectName);

      downloadCsv(csv, filename);
      updateStatus('Export complete', 'success');
    } catch (error) {
      updateStatus('Export failed', 'error');
      alert(`Bulk export failed: ${(error as Error).message}`);
    } finally {
      setBulkExportInProgress(false);
    }
  }, [editorValue, isAuthenticated, useToolingApi, bulkExportInProgress, updateStatus]);

  // Save changes
  const handleSaveChanges = useCallback(async () => {
    if (!activeTab || activeTab.modifiedRecords.size === 0 || !activeTab.objectName) {
      return;
    }

    updateStatus('Saving...', 'loading');

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
      updateStatus('Saved', 'success');
    } else {
      updateStatus('Save Failed', 'error');
      const errorMsg = errors.map((e) => `Record ${e.recordId}: ${e.error}`).join('\n');
      alert(`Failed to save some records:\n\n${errorMsg}`);
    }
  }, [activeTab, updateStatus, updateRecordData, clearAllModified]);

  // Clear changes
  const handleClearChanges = useCallback(() => {
    if (activeTab) {
      clearAllModified(activeTab.id);
    }
  }, [activeTab, clearAllModified]);

  // Handle query selection from history
  const handleSelectQuery = useCallback((query: string) => {
    setEditorValue(query);
    editorRef.current?.setValue(query);
  }, []);

  // Derived state
  const hasResults = activeTab && activeTab.records.length > 0 && !activeTab.error;
  const hasModifications = activeTab && activeTab.modifiedRecords.size > 0;
  const isEditMode = editingEnabled && activeTab?.isEditable;

  return (
    <div data-testid="query-tab">
      {/* Query Editor Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-icon" style={{ backgroundColor: '#0070d2' }}>
            S
          </div>
          <h2>SOQL Query</h2>
          <QueryHistory
            onSelectQuery={handleSelectQuery}
            historyManagerRef={historyManagerRef}
          />
          <ButtonIcon icon="settings" title="Settings" className={styles.settingsBtn} data-testid="query-settings-btn">
            <ButtonIconCheckbox
              checked={useToolingApi}
              onChange={setUseToolingApi}
              data-testid="query-tooling-checkbox"
            >
              Tooling API
            </ButtonIconCheckbox>
          </ButtonIcon>
        </div>
        <div className="card-body">
          <div className="form-element">
            <QueryEditor
              ref={editorRef}
              value={editorValue}
              onChange={setEditorValue}
              onExecute={executeQuery}
              className={styles.editor}
            />
          </div>
          <div className={styles.footer}>
            <button className="button-brand" onClick={executeQuery} data-testid="query-execute-btn">
              Query
            </button>
            <StatusBadge type={statusType} data-testid="query-status">{statusText}</StatusBadge>
          </div>
        </div>
      </div>

      {/* Results Card */}
      <div className="card">
        <div className="card-header">
          <div className="card-header-icon" style={{ backgroundColor: '#4bca81' }}>
            Q
          </div>
          <h2>Results</h2>
          <div className={styles.resultsSearch}>
            <input
              type="text"
              className="search-input"
              placeholder="Filter..."
              onChange={handleFilterChange}
              data-testid="query-search-input"
            />
          </div>
          <ButtonIcon icon="verticalDots" title="Options" className={styles.resultsBtn} data-testid="query-results-btn">
            <ButtonIconOption disabled={!hasResults} onClick={exportCurrentResults} data-testid="query-export-btn">
              Export
            </ButtonIconOption>
            <ButtonIconOption
              disabled={!hasResults || bulkExportInProgress}
              onClick={handleBulkExport}
              data-testid="query-bulk-export-btn"
            >
              Bulk Export
            </ButtonIconOption>
            <ButtonIconCheckbox checked={editingEnabled} onChange={setEditingEnabled} data-testid="query-editing-checkbox">
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
        <div className={`card-body ${styles.cardBody}`} data-testid="query-results">
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
          />
        </div>
      </div>
    </div>
  );
}

// Helper functions
function getValueByPath(record: SObject, path: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let value: unknown = record;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}

function formatCellValue(value: unknown, col: QueryColumn): string {
  if (value === null || value === undefined) return '';
  if (col?.isSubquery && typeof value === 'object') {
    const subquery = value as { records?: unknown[]; totalSize?: number };
    if (subquery.records) {
      return `[${subquery.totalSize || subquery.records.length} records]`;
    }
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj.Name !== undefined) return String(obj.Name);
    if (obj.Id !== undefined) return String(obj.Id);
    return JSON.stringify(value);
  }
  return String(value);
}

function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getExportFilename(objectName: string | null): string {
  const name = objectName || 'query';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
  return `${name}_${timestamp}.csv`;
}

function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
