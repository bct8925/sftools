import { useState, useEffect, useCallback } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { onAuthExpired, loadConnections } from '../lib/auth';
import { startAuthorization } from '../lib/start-authorization';
import { Modal } from '../components/modal/Modal';
import type { SalesforceConnection } from '../types/salesforce';

/**
 * Handles auth expiration events by showing a modal with options to
 * re-authorize, delete the connection, or dismiss.
 */
export function AuthExpirationHandler() {
  const { setActiveConnection, removeConnection } = useConnection();
  const [isOpen, setIsOpen] = useState(false);
  const [expiredConnection, setExpiredConnection] = useState<SalesforceConnection | null>(null);

  useEffect(() => {
    // Register auth expiration callback
    onAuthExpired(async (expiredConnectionId) => {
      // Prevent duplicate modals
      if (isOpen) return;

      const connections = await loadConnections();
      const connection = connections.find((c) => c.id === expiredConnectionId) || null;

      setExpiredConnection(connection);
      setIsOpen(true);
    });
  }, [isOpen]);

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
      <div className="modal-dialog" style={{ maxWidth: '400px' }}>
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
