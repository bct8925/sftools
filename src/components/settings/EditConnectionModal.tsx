import { useState, useEffect } from 'react';
import type { SalesforceConnection } from '../../types/salesforce';
import { useConnection } from '../../contexts/ConnectionContext';
import { startAuthorization } from '../../lib/start-authorization';
import styles from './EditConnectionModal.module.css';

interface EditConnectionModalProps {
  connectionId: string | null;
  onClose: () => void;
}

export function EditConnectionModal({ connectionId, onClose }: EditConnectionModalProps) {
  const { connections, updateConnection } = useConnection();
  const [label, setLabel] = useState('');
  const [clientId, setClientId] = useState('');
  const [connection, setConnection] = useState<SalesforceConnection | null>(null);

  useEffect(() => {
    if (connectionId) {
      const conn = connections.find((c) => c.id === connectionId);
      if (conn) {
        setConnection(conn);
        setLabel(conn.label);
        setClientId(conn.clientId || '');
      }
    }
  }, [connectionId, connections]);

  const handleSave = async () => {
    if (!label.trim()) {
      alert('Label is required');
      return;
    }

    if (!connectionId || !connection) return;

    const newClientId = clientId.trim() || null;
    const clientIdChanged = connection.clientId !== newClientId;

    await updateConnection(connectionId, {
      label: label.trim(),
      clientId: newClientId,
    });

    onClose();

    if (clientIdChanged) {
      const message = newClientId
        ? 'Client ID changed. Re-authorize now to use the new Connected App?'
        : 'Client ID removed. Re-authorize now to use the default Connected App?';

      if (confirm(message)) {
        await startAuthorization(connection.instanceUrl, newClientId, connectionId);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!connectionId) return null;

  return (
    <div className={styles.modalOverlay} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <h3>Edit Connection</h3>
        <div className="form-element">
          <label>LABEL</label>
          <input
            type="text"
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="form-element">
          <label>CLIENT ID</label>
          <input
            type="text"
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Leave blank for default"
          />
          <span className={styles.fieldHint}>Changing Client ID requires re-authorization</span>
        </div>
        <div className={styles.buttonRow}>
          <button className="button-brand" onClick={handleSave}>
            Save
          </button>
          <button className="button-neutral" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
