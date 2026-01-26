// Query Tabs - Tab bar for multiple query result tabs
import { useCallback } from 'react';
import { icons } from '../../lib/icons.js';
import type { QueryTabState } from './useQueryState';
import styles from './QueryTab.module.css';

interface QueryTabsProps {
  /** List of all query tabs */
  tabs: QueryTabState[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Called when a tab is clicked to switch */
  onTabSelect: (tabId: string) => void;
  /** Called to refresh a tab's query */
  onTabRefresh: (tabId: string) => void;
  /** Called to close a tab */
  onTabClose: (tabId: string) => void;
}

/**
 * Tab bar component for managing multiple query result tabs.
 * Displays tabs for each executed query with refresh/close buttons.
 */
export function QueryTabs({
  tabs,
  activeTabId,
  onTabSelect,
  onTabRefresh,
  onTabClose,
}: QueryTabsProps) {
  // Get display label for a tab
  const getTabLabel = useCallback((tab: QueryTabState): string => {
    if (tab.objectName) {
      return tab.objectName;
    }
    const maxLength = 30;
    if (tab.query.length <= maxLength) return tab.query;
    return `${tab.query.substring(0, maxLength)}...`;
  }, []);

  // Handle tab click
  const handleTabClick = useCallback(
    (tabId: string) => {
      onTabSelect(tabId);
    },
    [onTabSelect]
  );

  // Handle refresh click
  const handleRefreshClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      onTabRefresh(tabId);
    },
    [onTabRefresh]
  );

  // Handle close click
  const handleCloseClick = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      onTabClose(tabId);
    },
    [onTabClose]
  );

  if (tabs.length === 0) {
    return (
      <div className={styles.tabs} data-testid="query-tabs">
        <div className={styles.tabsEmpty}>Run a query to see results</div>
      </div>
    );
  }

  return (
    <div className={styles.tabs} data-testid="query-tabs">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`${styles.tab}${tab.id === activeTabId ? ` ${styles.tabActive}` : ''}`}
          onClick={() => handleTabClick(tab.id)}
          data-testid="query-tab"
          data-active={tab.id === activeTabId ? 'true' : 'false'}
        >
          <span className={styles.tabLabel} title={tab.query} data-testid="query-tab-label">
            {getTabLabel(tab)}
          </span>
          <button
            className={styles.tabRefresh}
            title="Refresh"
            onClick={(e) => handleRefreshClick(e, tab.id)}
            dangerouslySetInnerHTML={{ __html: icons.refreshTab }}
            data-testid="query-tab-refresh"
          />
          <button
            className={styles.tabClose}
            title="Close"
            onClick={(e) => handleCloseClick(e, tab.id)}
            dangerouslySetInnerHTML={{ __html: icons.closeTab }}
            data-testid="query-tab-close"
          />
        </div>
      ))}
    </div>
  );
}
