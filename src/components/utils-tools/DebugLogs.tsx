import { useState, useCallback, useRef, useEffect } from 'react';
import { useConnection } from '../../contexts/ConnectionContext.js';
import {
  getCurrentUserId,
  searchUsers,
  enableTraceFlagForUser,
  deleteAllDebugLogs,
  deleteAllTraceFlags,
} from '../../lib/salesforce.js';
import { escapeHtml } from '../../lib/text-utils.js';
import type { SObject } from '../../types/salesforce';
import styles from './DebugLogs.module.css';

interface User extends SObject {
  Name: string;
  Username: string;
}

interface DeleteResult {
  deletedCount: number;
}

type StatusType = 'loading' | 'success' | 'error';

/**
 * Debug Logs Tool - Trace flags and log management.
 * Enables trace flags for users and cleans up logs/flags.
 */
export function DebugLogs() {
  const { activeConnection, isAuthenticated } = useConnection();

  // Trace flag state
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [showUserResults, setShowUserResults] = useState(false);
  const [traceStatus, setTraceStatus] = useState<{
    type: StatusType;
    message: string;
  } | null>(null);

  // Cleanup state
  const [deleteStatus, setDeleteStatus] = useState<{
    type: StatusType;
    message: string;
  } | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userResultsRef = useRef<HTMLDivElement>(null);

  // Close user results on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userResultsRef.current && !userResultsRef.current.contains(e.target as Node)) {
        setShowUserResults(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Clear state on connection change
  useEffect(() => {
    setUserSearchTerm('');
    setUserResults([]);
    setShowUserResults(false);
    setTraceStatus(null);
    setDeleteStatus(null);
  }, [activeConnection?.id]);

  const handleEnableForMe = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    setTraceStatus({ type: 'loading', message: 'Enabling trace flag...' });

    try {
      const userId = await getCurrentUserId();
      await enableTraceFlagForUser(userId);
      setTraceStatus({ type: 'success', message: 'Trace flag enabled for 30 minutes' });
    } catch (error) {
      setTraceStatus({ type: 'error', message: (error as Error).message });
    }
  }, [isAuthenticated]);

  const handleUserSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const term = e.target.value;
      setUserSearchTerm(term);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (term.trim().length < 2) {
        setShowUserResults(false);
        return;
      }

      searchTimeoutRef.current = setTimeout(async () => {
        if (!isAuthenticated) return;

        try {
          const users = await searchUsers(term.trim());
          setUserResults(users as User[]);
          setShowUserResults(true);
        } catch (error) {
          console.error('User search error:', error);
          setUserResults([]);
          setShowUserResults(false);
        }
      }, 300);
    },
    [isAuthenticated]
  );

  const handleUserSelect = useCallback(async (user: User) => {
    setShowUserResults(false);
    setUserSearchTerm(user.Name);

    setTraceStatus({ type: 'loading', message: 'Enabling trace flag...' });

    try {
      await enableTraceFlagForUser(user.Id);
      setTraceStatus({ type: 'success', message: 'Trace flag enabled for 30 minutes' });
    } catch (error) {
      setTraceStatus({ type: 'error', message: (error as Error).message });
    }
  }, []);

  const handleDeleteFlags = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    if (!confirm('Delete ALL trace flags? This cannot be undone.')) {
      return;
    }

    setDeleteStatus({ type: 'loading', message: 'Deleting trace flags...' });

    try {
      const result = (await deleteAllTraceFlags()) as DeleteResult;
      const count = result.deletedCount;
      setDeleteStatus({
        type: 'success',
        message: `Deleted ${count} trace flag${count !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      setDeleteStatus({ type: 'error', message: (error as Error).message });
    }
  }, [isAuthenticated]);

  const handleDeleteLogs = useCallback(async () => {
    if (!isAuthenticated) {
      alert('Not authenticated. Please authorize via the connection selector.');
      return;
    }

    if (!confirm('Delete ALL debug logs? This cannot be undone.')) {
      return;
    }

    setDeleteStatus({ type: 'loading', message: 'Deleting logs...' });

    try {
      const result = (await deleteAllDebugLogs()) as DeleteResult;
      const count = result.deletedCount;
      setDeleteStatus({
        type: 'success',
        message: `Deleted ${count} log${count !== 1 ? 's' : ''}`,
      });
    } catch (error) {
      setDeleteStatus({ type: 'error', message: (error as Error).message });
    }
  }, [isAuthenticated]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-icon" style={{ backgroundColor: '#4bca81' }}>
          D
        </div>
        <h2>Debug Logs</h2>
      </div>
      <div className="card-body">
        <p className="tool-description">Manage debug logging and trace flags.</p>

        <div className={styles.section}>
          <h3 className="tool-section-title">Enable Trace Flag</h3>
          <button className="button-brand" onClick={handleEnableForMe}>
            Enable for Me
          </button>
          <div className="tool-divider"></div>
          <div className="form-element">
            <label>USER LOOKUP</label>
            <input
              type="text"
              className="input"
              placeholder="Search by name or username..."
              value={userSearchTerm}
              onChange={handleUserSearchInput}
            />
          </div>
          {showUserResults && (
            <div ref={userResultsRef} className={styles.userResults}>
              {userResults.length === 0 ? (
                <div className="tool-no-results">No users found</div>
              ) : (
                userResults.map((user) => (
                  <div
                    key={user.Id}
                    className="tool-result-item"
                    onClick={() => handleUserSelect(user)}
                  >
                    <div>
                      <span className="tool-result-name">{user.Name}</span>
                      <br />
                      <span className="tool-result-detail">{user.Username}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
          {traceStatus && (
            <div className="tool-status">
              <span className={`status-indicator status-${traceStatus.type}`}></span>
              <span className="tool-status-text">{traceStatus.message}</span>
            </div>
          )}
        </div>

        <div className="tool-divider"></div>

        <div className={styles.section}>
          <h3 className="tool-section-title">Cleanup</h3>
          {deleteStatus && (
            <div className="tool-status">
              <span className={`status-indicator status-${deleteStatus.type}`}></span>
              <span className="tool-status-text">{deleteStatus.message}</span>
            </div>
          )}
          <div className={styles.buttons}>
            <button className="button-neutral" onClick={handleDeleteLogs}>
              Delete All Logs
            </button>
            <button className="button-neutral" onClick={handleDeleteFlags}>
              Delete All Trace Flags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
