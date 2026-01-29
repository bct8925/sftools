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
import { SearchBox, type SearchBoxRenderData } from '../utils-tools/SearchBox';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import styles from './DebugLogsSettingsModal.module.css';

interface User extends SObject {
    Name: string;
    Username: string;
}

interface DebugLogsSettingsModalProps {
    onClose: () => void;
}

/**
 * Settings modal for Debug Logs tab
 * Contains trace flag management and cleanup operations
 */
export function DebugLogsSettingsModal({ onClose }: DebugLogsSettingsModalProps) {
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
            const result = await deleteAllTraceFlags();
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
        <div className={styles.settingsModal} data-testid="debug-logs-settings-modal">
            <div className={styles.header}>
                <h3>Debug Logs Settings</h3>
                <ButtonIcon
                    icon="close"
                    title="Close"
                    onClick={onClose}
                    data-testid="debug-logs-settings-close-btn"
                />
            </div>
            <div className={styles.content}>
                {/* Enable Trace Flag Section */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Enable Trace Flag</h4>
                    <button
                        className="button-brand"
                        onClick={handleEnableForMe}
                        disabled={enableForMeLoading}
                        data-testid="debug-logs-enable-for-me-btn"
                    >
                        Enable for Me
                    </button>
                    <div className={styles.divider}></div>
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
                        <div className={styles.status} data-testid="debug-logs-trace-status">
                            <span className={`status-indicator status-${traceStatusType}`}></span>
                            <span className={styles.statusText} data-testid="debug-logs-trace-status-text">{traceStatusText}</span>
                        </div>
                    )}
                </div>

                {/* Cleanup Section */}
                <div className={styles.section}>
                    <h4 className={styles.sectionTitle}>Cleanup</h4>
                    {deleteStatusText && (
                        <div className={styles.status} data-testid="debug-logs-delete-status">
                            <span className={`status-indicator status-${deleteStatusType}`}></span>
                            <span className={styles.statusText} data-testid="debug-logs-delete-status-text">{deleteStatusText}</span>
                        </div>
                    )}
                    <div className={styles.buttonGroup}>
                        <button
                            className="button-neutral"
                            onClick={handleDeleteLogs}
                            disabled={deleteLogsLoading}
                            data-testid="debug-logs-delete-logs-btn"
                        >
                            Delete All Logs
                        </button>
                        <button
                            className="button-neutral"
                            onClick={handleDeleteFlags}
                            disabled={deleteFlagsLoading}
                            data-testid="debug-logs-delete-flags-btn"
                        >
                            Delete All Trace Flags
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
