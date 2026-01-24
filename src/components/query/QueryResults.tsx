// Query Results - Results container with loading/error/empty states
import { useMemo } from 'react';
import type { QueryTabState } from './useQueryState';
import { QueryResultsTable } from './QueryResultsTable';
import styles from './QueryTab.module.css';

interface QueryResultsProps {
  /** Current active tab data */
  activeTab: QueryTabState | null;
  /** Whether editing mode is enabled */
  editingEnabled: boolean;
  /** Called when a field value is modified */
  onFieldChange: (recordId: string, fieldName: string, value: unknown, originalValue: unknown) => void;
  /** Filter text for rows */
  filterText: string;
}

/**
 * Query results container that handles loading, error, and empty states.
 * Delegates actual table rendering to QueryResultsTable.
 */
export function QueryResults({
  activeTab,
  editingEnabled,
  onFieldChange,
  filterText,
}: QueryResultsProps) {
  // Determine what to render based on tab state
  const content = useMemo(() => {
    // No active tab
    if (!activeTab) {
      return (
        <div className={styles.resultsEmpty}>No query results to display</div>
      );
    }

    // Loading state
    if (activeTab.isLoading) {
      return (
        <div className={styles.resultsLoading}>
          <div className={styles.spinner} />
          <div>Loading query results...</div>
        </div>
      );
    }

    // Error state
    if (activeTab.error) {
      return (
        <div className={styles.resultsError}>{activeTab.error}</div>
      );
    }

    // Empty results
    if (activeTab.records.length === 0) {
      return (
        <div className={styles.resultsEmpty}>No records found</div>
      );
    }

    // Render results table
    const isEditMode = editingEnabled && activeTab.isEditable;

    return (
      <QueryResultsTable
        records={activeTab.records}
        columns={activeTab.columns}
        objectName={activeTab.objectName}
        fieldDescribe={activeTab.fieldDescribe}
        modifiedRecords={activeTab.modifiedRecords}
        isEditMode={isEditMode}
        onFieldChange={onFieldChange}
        filterText={filterText}
      />
    );
  }, [activeTab, editingEnabled, onFieldChange, filterText]);

  return (
    <div className={styles.results}>
      {content}
    </div>
  );
}
