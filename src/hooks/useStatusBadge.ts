// useStatusBadge - Shared hook for status badge state management
import { useState, useCallback } from 'react';
import type { StatusType } from '../components/status-badge/StatusBadge';

export type { StatusType };

/**
 * Return type for the useStatusBadge hook.
 */
export interface UseStatusBadgeReturn {
  /** Current status text to display */
  statusText: string;
  /** Current status type (loading, success, error, or empty) */
  statusType: StatusType;
  /** Update the status text and type */
  updateStatus: (text: string, type?: StatusType) => void;
  /** Clear the status (set to empty) */
  clearStatus: () => void;
}

/**
 * Hook for managing status badge state.
 * Provides consistent status display pattern across components.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { statusText, statusType, updateStatus, clearStatus } = useStatusBadge();
 *
 *   const handleAction = async () => {
 *     updateStatus('Loading...', 'loading');
 *     try {
 *       await doSomething();
 *       updateStatus('Done!', 'success');
 *     } catch (error) {
 *       updateStatus(error.message, 'error');
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <StatusBadge type={statusType}>{statusText}</StatusBadge>
 *       <button onClick={handleAction}>Execute</button>
 *     </>
 *   );
 * }
 * ```
 */
export function useStatusBadge(): UseStatusBadgeReturn {
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<StatusType>('');

  const updateStatus = useCallback((text: string, type: StatusType = '') => {
    setStatusText(text);
    setStatusType(type);
  }, []);

  const clearStatus = useCallback(() => {
    setStatusText('');
    setStatusType('');
  }, []);

  return {
    statusText,
    statusType,
    updateStatus,
    clearStatus,
  };
}
