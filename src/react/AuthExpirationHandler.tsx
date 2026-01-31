import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { onAuthExpired, loadConnections } from '../auth/auth';
import { startAuthorization } from '../auth/start-authorization';
import { Modal } from '../components/modal/Modal';
import type { SalesforceConnection } from '../types/salesforce';
import styles from './AuthExpirationHandler.module.css';

/**
 * Handles auth expiration events by showing a modal with options to
 * re-authorize, delete the connection, or dismiss.
 */
export function AuthExpirationHandler() {
  const { setActiveConnection, removeConnection } = useConnection();
  const [isOpen, setIsOpen] = useState(false);
  const [expiredConnection, setExpiredConnection] = useState<SalesforceConnection | null>(null);
  const isOpenRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    // Register auth expiration callback once
    onAuthExpired(async (expiredConnectionId) => {
      // Prevent duplicate modals using ref (no dependency on isOpen)
      if (isOpenRef.current) return;

      const connections = await loadConnections();
      const connection = connections.find((c) => c.id === expiredConnectionId) || null;

      setExpiredConnection(connection);
      setIsOpen(true);
    });
  }, []);

  const handleReauthorize = useCallback(async () => {
    if (!expiredConnection) return;

    // Start OAuth flow
    await startAuthorization(
      expiredConnection.instanceUrl,
      expiredConnection.clientId,
      expiredConnection.id
    );

    setIsOpen(false);
  }, [expiredConnection]);

  const handleDelete = useCallback(async () => {
    if (!expiredConnection) return;

    // Clear active connection first
    await setActiveConnection(null);
    await removeConnection(expiredConnection.id);

    setIsOpen(false);
  }, [expiredConnection, setActiveConnection, removeConnection]);

  const handleDismiss = useCallback(() => {
    setIsOpen(false);
  }, []);

  const connectionLabel = expiredConnection?.label || 'Unknown';

  return (
    <Modal isOpen={isOpen} onClose={handleDismiss}>
      <div className={`modal-dialog ${styles.dialog}`}>
        <h2>Authorization Lost</h2>
        <p>
          The session for <strong>{connectionLabel}</strong> has expired.
        </p>
        <div className="modal-buttons">
          <button className="button-brand" onClick={handleReauthorize}>
            Re-authorize
          </button>
          <button className="button-neutral" onClick={handleDelete}>
            Delete
          </button>
          <button className="button-neutral" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </Modal>
  );
}
