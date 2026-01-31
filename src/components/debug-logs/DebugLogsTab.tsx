import { useState, useCallback, useEffect, useRef } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { useProxy } from '../../contexts/ProxyContext';
import { useStatusBadge } from '../../hooks/useStatusBadge';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { Modal } from '../modal/Modal';
import { StatusBadge } from '../status-badge/StatusBadge';
import { ButtonIcon } from '../button-icon/ButtonIcon';
import { DebugLogsSettingsModal } from './DebugLogsSettingsModal';
import { getDebugLogsSince, getLogBody, type DebugLogEntry } from '../../api/debug-logs';
import { getInstanceUrl, getAccessToken } from '../../auth/auth';
import { filterLines } from '../../lib/apex-utils';
import { getNowISO } from '../../lib/date-utils';
import styles from './DebugLogsTab.module.css';

const LOGGING_CHANNEL = '/systemTopic/Logging';

// Format date for display
const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
};

// Format bytes for display
const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Debug Logs Tab - Live log viewer with Monaco editor and log table
 */
export function DebugLogsTab() {
    const { activeConnection, isAuthenticated } = useConnection();
    const { isConnected: isProxyConnected } = useProxy();

    // Viewer state
    const [watchingSince, setWatchingSince] = useState<string | null>(null);
    const [logs, setLogs] = useState<DebugLogEntry[]>([]);
    const [selectedLogBody, setSelectedLogBody] = useState<string>('');
    const [filterText, setFilterText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [openedLogIds, setOpenedLogIds] = useState<Set<string>>(new Set());

    // CometD subscription state
    const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
    const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);

    // Settings modal state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Status
    const { statusText, statusType, updateStatus, clearStatus } = useStatusBadge();

    // Editor ref
    const editorRef = useRef<MonacoEditorRef>(null);
    const filterTimeoutRef = useRef<number | null>(null);

    // Track watching state in ref for message handler
    const watchingRef = useRef<string | null>(null);
    useEffect(() => {
        watchingRef.current = watchingSince;
    }, [watchingSince]);

    // Clear state on connection change
    useEffect(() => {
        setWatchingSince(null);
        setLogs([]);
        setSelectedLogBody('');
        setFilterText('');
        setSubscriptionId(null);
        setIsAutoRefreshEnabled(false);
        setOpenedLogIds(new Set());
        clearStatus();
    }, [activeConnection?.id, clearStatus]);

    // Apply filter to log content with debouncing
    const applyFilter = useCallback(() => {
        if (!editorRef.current || !selectedLogBody) return;

        const filter = filterText.trim();
        if (!filter) {
            editorRef.current.setValue(selectedLogBody);
            return;
        }

        const lines = selectedLogBody.split('\n');
        const filtered = filterLines(lines, filter);
        const result = filtered.length > 0
            ? filtered.join('\n')
            : `// No lines match "${filterText}"`;

        editorRef.current.setValue(result);
    }, [selectedLogBody, filterText]);

    // Debounce filter application
    useEffect(() => {
        if (filterTimeoutRef.current !== null) {
            clearTimeout(filterTimeoutRef.current);
        }

        filterTimeoutRef.current = window.setTimeout(() => {
            applyFilter();
        }, 200);

        return () => {
            if (filterTimeoutRef.current !== null) {
                clearTimeout(filterTimeoutRef.current);
            }
        };
    }, [applyFilter]);

    // Handle Watch button
    const handleWatch = useCallback(() => {
        const now = getNowISO();
        setWatchingSince(now);
        setLogs([]);
        setSelectedLogBody('');
        editorRef.current?.setValue('// Watching for new debug logs...\n// Click Refresh to fetch logs or wait for auto-refresh (if proxy connected)');
        updateStatus('Watching started', 'success');
    }, [updateStatus]);

    // Handle Stop button
    const handleStop = useCallback(async () => {
        // Unsubscribe from CometD if subscribed
        if (subscriptionId) {
            try {
                await chrome.runtime.sendMessage({
                    type: 'unsubscribe',
                    subscriptionId,
                });
            } catch {
                // Ignore errors during cleanup
            }
            setSubscriptionId(null);
            setIsAutoRefreshEnabled(false);
        }
        setWatchingSince(null);
        clearStatus();
    }, [subscriptionId, clearStatus]);

    // Handle Refresh button
    const handleRefresh = useCallback(async () => {
        if (!watchingSince || !isAuthenticated) return;

        setIsLoading(true);
        updateStatus('Fetching logs...', 'loading');

        try {
            const newLogs = await getDebugLogsSince(watchingSince);
            setLogs(newLogs);
            const autoLabel = isAutoRefreshEnabled ? ' (auto)' : '';
            updateStatus(`Found ${newLogs.length} log${newLogs.length !== 1 ? 's' : ''}${autoLabel}`, 'success');
        } catch (error) {
            updateStatus((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [watchingSince, isAuthenticated, isAutoRefreshEnabled, updateStatus]);

    // Handle Open Log button
    const handleOpenLog = useCallback(async (logId: string) => {
        setIsLoading(true);
        updateStatus('Loading log...', 'loading');

        try {
            const body = await getLogBody(logId);
            setSelectedLogBody(body);
            editorRef.current?.setValue(body);
            setOpenedLogIds(prev => new Set(prev).add(logId));
            clearStatus();
        } catch (error) {
            updateStatus((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    }, [updateStatus, clearStatus]);

    // CometD subscription for auto-refresh
    useEffect(() => {
        if (!watchingSince || !isProxyConnected || !isAuthenticated) {
            return;
        }

        let currentSubId: string | null = null;

        const subscribe = async () => {
            try {
                const response = await chrome.runtime.sendMessage({
                    type: 'subscribe',
                    instanceUrl: getInstanceUrl(),
                    accessToken: getAccessToken(),
                    channel: LOGGING_CHANNEL,
                    replayPreset: 'LATEST',
                });

                if (response.success) {
                    currentSubId = response.subscriptionId;
                    setSubscriptionId(response.subscriptionId);
                    setIsAutoRefreshEnabled(true);
                }
            } catch {
                // Proxy subscription failed, manual refresh still works
            }
        };

        subscribe();

        return () => {
            if (currentSubId) {
                chrome.runtime.sendMessage({
                    type: 'unsubscribe',
                    subscriptionId: currentSubId,
                }).catch(() => { });
            }
        };
    }, [watchingSince, isProxyConnected, isAuthenticated]);

    // Listen for stream events to trigger refresh
    useEffect(() => {
        if (!subscriptionId) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handler = (message: any) => {
            if (message.type === 'streamEvent' && message.subscriptionId === subscriptionId) {
                // New log event received, trigger refresh
                if (watchingRef.current) {
                    handleRefresh();
                }
            }
        };

        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    }, [subscriptionId, handleRefresh]);

    return (
        <div className={styles.debugLogsTab} data-testid="debug-logs-tab">
            {/* Log Viewer Card */}
            <div className="card">
                <div className={`card-header ${styles.header}`}>
                    <div className={styles.headerRow}>
                        <div className={`card-header-icon ${styles.headerIcon}`}>
                            L
                        </div>
                        <h2>Debug Logs</h2>
                        <div className={styles.headerControls}>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Filter..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                data-testid="debug-logs-filter-input"
                            />
                        </div>
                    </div>
                    <div className={styles.headerRow}>
                        {statusText && (
                            <StatusBadge type={statusType} data-testid="debug-logs-status">
                                {statusText}
                            </StatusBadge>
                        )}
                        <div className={styles.headerControls}>
                            <ButtonIcon
                                icon={watchingSince ? 'stop' : 'play'}
                                title={watchingSince ? 'Stop watching' : 'Start watching'}
                                onClick={watchingSince ? handleStop : handleWatch}
                                disabled={!isAuthenticated}
                                data-testid="debug-logs-watch-btn"
                            />
                            <ButtonIcon
                                icon="refresh"
                                title="Refresh logs"
                                onClick={handleRefresh}
                                disabled={isLoading || !watchingSince}
                                data-testid="debug-logs-refresh-btn"
                            />
                            <ButtonIcon
                                icon="settings"
                                title="Settings"
                                onClick={() => setIsSettingsOpen(true)}
                                data-testid="debug-logs-settings-btn"
                            />
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {/* Viewer Layout */}
                    <div className={styles.viewer}>
                        {/* Monaco Editor (2/3) */}
                        <div className={styles.viewerEditor}>
                            <MonacoEditor
                                ref={editorRef}
                                language="apex"
                                value="// Click ▶ to start monitoring debug logs"
                                readonly
                                className="monaco-container monaco-container-lg"
                                data-testid="debug-logs-editor"
                            />
                        </div>

                        {/* Log Table (1/3) */}
                        <div className={styles.viewerTable}>
                            {logs.length === 0 ? (
                                <div className={styles.emptyState}>
                                    <div className={styles.emptyStateIcon}>📋</div>
                                    <p>{watchingSince ? 'No logs yet. Click Refresh to check.' : 'Click ▶ to start monitoring.'}</p>
                                </div>
                            ) : (
                                <table className={styles.logTable} data-testid="debug-logs-table">
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>User</th>
                                            <th>Operation</th>
                                            <th>Status</th>
                                            <th>Size</th>
                                            <th></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr
                                                key={log.Id}
                                                className={openedLogIds.has(log.Id) ? styles.rowOpened : ''}
                                                data-testid={`debug-log-row-${log.Id}`}
                                            >
                                                <td className={styles.time}>{formatTime(log.StartTime)}</td>
                                                <td>{log.LogUser?.Name ?? 'Unknown'}</td>
                                                <td>{log.Operation}</td>
                                                <td className={styles.status}>
                                                    <span className={log.Status === 'Success' ? styles.statusSuccess : styles.statusError}>
                                                        {log.Status}
                                                    </span>
                                                </td>
                                                <td className={styles.size}>{formatBytes(log.LogLength)}</td>
                                                <td>
                                                    <button
                                                        className="button-neutral button-sm"
                                                        onClick={() => handleOpenLog(log.Id)}
                                                        disabled={isLoading}
                                                        data-testid={`debug-log-open-${log.Id}`}
                                                    >
                                                        Open
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}>
                <DebugLogsSettingsModal onClose={() => setIsSettingsOpen(false)} />
            </Modal>
        </div>
    );
}
