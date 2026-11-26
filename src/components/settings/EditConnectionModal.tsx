import { useState, useEffect } from 'react';
import type { SalesforceConnection, TokenType } from '../../types/salesforce';
import { useConnection } from '../../contexts/ConnectionContext';
import { startAuthorization } from '../../auth/start-authorization';
import { getSessionType } from '../../auth/auth';
import { getPlatform } from '../../platform';
import styles from './EditConnectionModal.module.css';

interface EditConnectionModalProps {
    connectionId: string | null;
    onClose: () => void;
}

export function EditConnectionModal({ connectionId, onClose }: EditConnectionModalProps) {
    const { connections, updateConnection } = useConnection();
    const [label, setLabel] = useState('');
    const [clientId, setClientId] = useState('');
    const [sessionType, setSessionType] = useState<TokenType>('DPoP');
    const [connection, setConnection] = useState<SalesforceConnection | null>(null);
    // Session type only applies to sftools' own OAuth (not sf CLI orgs in VS Code)
    const canChooseSessionType = getPlatform().capabilities.oauth;

    useEffect(() => {
        if (connectionId) {
            const conn = connections.find(c => c.id === connectionId);
            if (conn) {
                setConnection(conn);
                setLabel(conn.label);
                setClientId(conn.clientId || '');
                setSessionType(getSessionType(conn));
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
        const sessionTypeChanged =
            canChooseSessionType && getSessionType(connection) !== sessionType;

        await updateConnection(connectionId, {
            label: label.trim(),
            clientId: newClientId,
            ...(canChooseSessionType && { sessionType }),
        });

        onClose();

        if (clientIdChanged || sessionTypeChanged) {
            const changes: string[] = [];
            if (clientIdChanged) {
                changes.push(newClientId ? 'Client ID changed' : 'Client ID removed');
            }
            if (sessionTypeChanged) {
                changes.push(`Session type changed to ${sessionType}`);
            }
            const target = clientIdChanged
                ? newClientId
                    ? 'use the new Connected App'
                    : 'use the default Connected App'
                : `switch to a ${sessionType} session`;

            if (confirm(`${changes.join(' and ')}. Re-authorize now to ${target}?`)) {
                await startAuthorization(
                    connection.instanceUrl,
                    newClientId,
                    connectionId,
                    sessionType
                );
            }
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!connectionId) return null;

    const currentSession = connection?.tokenType ?? 'Bearer';

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
                        onChange={e => setLabel(e.target.value)}
                    />
                </div>
                <div className="form-element">
                    <label>CLIENT ID</label>
                    <input
                        type="text"
                        className="input"
                        value={clientId}
                        onChange={e => setClientId(e.target.value)}
                        placeholder="Leave blank for default"
                    />
                    <span className={styles.fieldHint}>
                        Changing Client ID requires re-authorization
                    </span>
                </div>
                {canChooseSessionType && (
                    <div className="form-element">
                        <label>SESSION TYPE</label>
                        <select
                            className="select"
                            value={sessionType}
                            onChange={e => setSessionType(e.target.value as TokenType)}
                            data-testid="edit-connection-session-type"
                        >
                            <option value="DPoP">DPoP (recommended)</option>
                            <option value="Bearer">Bearer (allows streaming)</option>
                        </select>
                        <span className={styles.fieldHint}>
                            Current session: {currentSession}. DPoP binds the session to this
                            browser; Bearer is needed for streaming, if the app allows it. Changing
                            it requires re-authorization.
                        </span>
                    </div>
                )}
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
