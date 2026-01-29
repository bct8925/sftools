import { useState, useCallback, useEffect } from 'react';
import { useConnection } from '../../contexts';
import { useStatusBadge } from '../../hooks';
import {
  getCurrentUserId,
  searchUsers,
  enableTraceFlagForUser,
  getDebugLogStats,
  deleteDebugLogs,
  deleteAllTraceFlags,
} from '../../api/salesforce';
import type { SObject } from '../../types/salesforce';
import { SearchBox, type SearchBoxRenderData } from './SearchBox';
import sharedStyles from './utils-tools.module.css';
import styles from './DebugLogs.module.css';

interface User extends SObject {
  Name: string;
  Username: string;
}

interface DeleteResult {
  deletedCount: number;
}

/**
 * Debug Logs Tool - Trace flags and log management.
 * Enables trace flags for users and cleans up logs/flags.
 */
export function DebugLogs() {
  const { activeConnection, isAuthenticated } = useConnection();

  // Trace flag state
  const [enableForMeLoading, setEnableForMeLoading] = useState(false);
  const { statusText: traceStatusText, statusType: traceStatusType, updateStatus: updateTraceStatus, clearStatus: clearTraceStatus } = useStatusBadge();

  // Cleanup state
  const [deleteLogsLoading, setDeleteLogsLoading] = useState(false);
  const [deleteFlagsLoading, setDeleteFlagsLoading] = useState(false);
  const { statusText: deleteStatusText, statusType: deleteStatusType, updateStatus: updateDeleteStatus, clearStatus: clearDeleteStatus } = useStatusBadge();

  // Clear state on connection change
  useEffect(() => {
    setEnableForMeLoading(false);
    clearTraceStatus();
    setDeleteLogsLoading(false);
    setDeleteFlagsLoading(false);
    clearDeleteStatus();
  }, [activeConnection?.id, clearTraceStatus, clearDeleteStatus]);

  const handleEnableForMe = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    updateTraceStatus('Enabling trace flag...', 'loading');
    setEnableForMeLoading(true);

    try {
      const userId = await getCurrentUserId();
      await enableTraceFlagForUser(userId);
      updateTraceStatus('Trace flag enabled for 30 minutes', 'success');
    } catch (error) {
      updateTraceStatus((error as Error).message, 'error');
    } finally {
      setEnableForMeLoading(false);
    }
  }, [isAuthenticated, updateTraceStatus]);

  const handleUserSelect = useCallback(async (user: unknown) => {
    const userObj = user as User;
    updateTraceStatus('Enabling trace flag...', 'loading');

    try {
      await enableTraceFlagForUser(userObj.Id);
      updateTraceStatus('Trace flag enabled for 30 minutes', 'success');
    } catch (error) {
      updateTraceStatus((error as Error).message, 'error');
    }
  }, [updateTraceStatus]);

  const renderUserSearch = useCallback((user: unknown): SearchBoxRenderData => {
    const userObj = user as User;
    return {
      id: userObj.Id,
      name: userObj.Name,
      detail: userObj.Username,
    };
  }, []);

  const handleDeleteFlags = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    if (!confirm('Delete ALL trace flags? This cannot be undone.')) {
      return;
    }

    updateDeleteStatus('Deleting trace flags...', 'loading');
    setDeleteFlagsLoading(true);

    try {
      const result = (await deleteAllTraceFlags()) as DeleteResult;
      const count = result.deletedCount;
      updateDeleteStatus(`Deleted ${count} trace flag${count !== 1 ? 's' : ''}`, 'success');
    } catch (error) {
      updateDeleteStatus((error as Error).message, 'error');
    } finally {
      setDeleteFlagsLoading(false);
    }
  }, [isAuthenticated, updateDeleteStatus]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const handleDeleteLogs = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    updateDeleteStatus('Checking logs...', 'loading');
    setDeleteLogsLoading(true);

    try {
      // First get stats
      const stats = await getDebugLogStats();

      if (stats.count === 0) {
        updateDeleteStatus('No logs to delete', 'success');
        return;
      }

      const sizeStr = formatBytes(stats.totalSize);
      if (!confirm(`Delete ${stats.count} debug log${stats.count !== 1 ? 's' : ''} (${sizeStr})? This cannot be undone.`)) {
        clearDeleteStatus();
        return;
      }

      updateDeleteStatus('Deleting logs...', 'loading');

      // Delete the specific logs we queried
      const result = await deleteDebugLogs(stats.logIds);
      const count = result.deletedCount;
      updateDeleteStatus(`Deleted ${count} log${count !== 1 ? 's' : ''} (${sizeStr})`, 'success');
    } catch (error) {
      updateDeleteStatus((error as Error).message, 'error');
    } finally {
      setDeleteLogsLoading(false);
    }
  }, [isAuthenticated, updateDeleteStatus, clearDeleteStatus]);

  return (
    <div className="card" data-testid="debug-logs">
      <div className="card-header">
        <div className={`card-header-icon ${styles.headerIcon}`}>
          D
        </div>
        <h2>Debug Logs</h2>
      </div>
      <div className="card-body">
        <p className={sharedStyles.toolDescription}>Manage debug logging and trace flags.</p>

        <div className={styles.section}>
          <h3 className={sharedStyles.toolSectionTitle}>Enable Trace Flag</h3>
          <button className="button-brand" onClick={handleEnableForMe} disabled={enableForMeLoading} data-testid="debug-logs-enable-for-me-btn">
            Enable for Me
          </button>
          <div className={sharedStyles.toolDivider}></div>
          <SearchBox
            searchFn={searchUsers}
            renderFn={renderUserSearch}
            label="USER LOOKUP"
            placeholder="Search by name or username..."
            onSelect={handleUserSelect}
            inputTestId="debug-logs-user-search"
            dropdownTestId="debug-logs-user-results"
          />
          {traceStatusText && (
            <div className={sharedStyles.toolStatus} data-testid="debug-logs-trace-status">
              <span className={`status-indicator status-${traceStatusType}`}></span>
              <span className={sharedStyles.toolStatusText} data-testid="debug-logs-trace-status-text">{traceStatusText}</span>
            </div>
          )}
        </div>

        <div className={sharedStyles.toolDivider}></div>

        <div className={styles.section}>
          <h3 className={sharedStyles.toolSectionTitle}>Cleanup</h3>
          {deleteStatusText && (
            <div className={sharedStyles.toolStatus} data-testid="debug-logs-delete-status">
              <span className={`status-indicator status-${deleteStatusType}`}></span>
              <span className={sharedStyles.toolStatusText} data-testid="debug-logs-delete-status-text">{deleteStatusText}</span>
            </div>
          )}
          <div className={sharedStyles.debugLogsButtons}>
            <button className="button-neutral" onClick={handleDeleteLogs} disabled={deleteLogsLoading} data-testid="debug-logs-delete-logs-btn">
              Delete All Logs
            </button>
            <button className="button-neutral" onClick={handleDeleteFlags} disabled={deleteFlagsLoading} data-testid="debug-logs-delete-flags-btn">
              Delete All Trace Flags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
