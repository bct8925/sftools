// Query Results - Results container with loading/error/empty states
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
  /** Called to load more results */
  onLoadMore?: () => void;
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
  onLoadMore,
}: QueryResultsProps) {
  // No active tab
  if (!activeTab) {
    return (
      <div className={styles.results}>
        <div className={styles.resultsEmpty}>No query results to display</div>
      </div>
    );
  }

  // Loading state
  if (activeTab.isLoading) {
    return (
      <div className={styles.results}>
        <div className={styles.resultsLoading}>
          <div className={styles.spinner} />
          <div>Loading query results...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (activeTab.error) {
    return (
      <div className={styles.results}>
        <div className={styles.resultsError} data-testid="query-results-error">{activeTab.error}</div>
      </div>
    );
  }

  // Empty results
  if (activeTab.records.length === 0) {
    return (
      <div className={styles.results}>
        <div className={styles.resultsEmpty}>No records found</div>
      </div>
    );
  }

  // Render results table with footer outside scrollable area
  const isEditMode = editingEnabled && activeTab.isEditable;
  const showingCount = activeTab.records.length;
  const totalCount = activeTab.totalSize;
  const hasMore = !activeTab.done && activeTab.nextRecordsUrl;

  return (
    <>
      <div className={styles.results}>
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
      </div>
      <div className={styles.resultsFooter} data-testid="query-results-footer">
        <span className={styles.recordCount} data-testid="query-record-count">
          Showing {showingCount.toLocaleString()} of {totalCount.toLocaleString()} records
        </span>
        {hasMore && onLoadMore && (
          activeTab.isLoadingMore ? (
            <div className={styles.loadMoreSpinner} data-testid="query-load-more-spinner">
              <div className={styles.spinnerSmall} />
              <span>Loading...</span>
            </div>
          ) : (
            <button
              className={`button-neutral ${styles.loadMoreBtn}`}
              onClick={onLoadMore}
              data-testid="query-load-more-btn"
            >
              Load More
            </button>
          )
        )}
      </div>
    </>
  );
}
