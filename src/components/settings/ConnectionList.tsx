import { useState } from 'react';
import { useConnection } from '../../contexts/ConnectionContext.jsx';
import { setPendingAuth } from '../../lib/auth.js';
import { ConnectionCard } from './ConnectionCard.jsx';
import styles from './ConnectionList.module.css';

interface ConnectionListProps {
  onEditConnection: (connectionId: string) => void;
}

declare global {
  interface Window {
    startAuthorization?: (
      loginDomain: string | null,
      clientId: string | null,
      connectionId: string | null
    ) => void;
  }
}

export function ConnectionList({ onEditConnection }: ConnectionListProps) {
  const { connections, activeConnection, removeConnection, setActiveConnection } = useConnection();
  const [showAddForm, setShowAddForm] = useState(false);
  const [loginDomain, setLoginDomain] = useState('auto');
  const [customDomain, setCustomDomain] = useState('');
  const [newClientId, setNewClientId] = useState('');

  const handleAddConnection = async () => {
    let domain: string | null = loginDomain;

    if (domain === 'auto') {
      domain = null;
    } else if (domain === 'custom') {
      domain = customDomain.trim();
      if (!domain) {
        alert('Please enter a custom domain');
        return;
      }
      if (!domain.startsWith('https://')) {
        domain = `https://${domain}`;
      }
    }

    const clientId = newClientId.trim() || null;

    await setPendingAuth({
      loginDomain: domain,
      clientId,
      connectionId: null,
      state: '',
    } as any);

    if (window.startAuthorization) {
      window.startAuthorization(domain, clientId, null);
    }

    setShowAddForm(false);
    setLoginDomain('auto');
    setCustomDomain('');
    setNewClientId('');
  };

  const handleReauth = async (connectionId: string) => {
    const connection = connections.find((c) => c.id === connectionId);
    if (!connection) return;

    await setPendingAuth({
      loginDomain: connection.instanceUrl,
      clientId: connection.clientId,
      connectionId,
      state: '',
    } as any);

    if (window.startAuthorization) {
      window.startAuthorization(connection.instanceUrl, connection.clientId, connectionId);
    }
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('Remove this connection?')) return;

    const wasActive = activeConnection?.id === connectionId;
    if (wasActive) {
      setActiveConnection(null);
    }

    await removeConnection(connectionId);
  };

  return (
    <div>
      <div className={styles.connectionList}>
        {connections.length === 0 ? (
          <div className={styles.noConnections}>No connections saved</div>
        ) : (
          connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              isActive={conn.id === activeConnection?.id}
              onEdit={onEditConnection}
              onReauth={handleReauth}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {!showAddForm ? (
        <button className="button-brand" onClick={() => setShowAddForm(true)}>
          + Add Connection
        </button>
      ) : (
        <div className={styles.addForm}>
          <div className="form-element">
            <label>LOGIN DOMAIN</label>
            <select
              className="select"
              value={loginDomain}
              onChange={(e) => setLoginDomain(e.target.value)}
            >
              <option value="auto">Auto-detect (Current Tab)</option>
              <option value="https://login.salesforce.com">Production (login.salesforce.com)</option>
              <option value="https://test.salesforce.com">Sandbox (test.salesforce.com)</option>
              <option value="custom">Custom Domain...</option>
            </select>
          </div>
          {loginDomain === 'custom' && (
            <div className="form-element">
              <label>CUSTOM DOMAIN</label>
              <input
                type="text"
                className="input"
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="https://mycompany.my.salesforce.com"
              />
            </div>
          )}
          <div className="form-element">
            <label>CLIENT ID (OPTIONAL)</label>
            <input
              type="text"
              className="input"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              placeholder="Leave blank to use default"
            />
            <span className={styles.fieldHint}>
              External Client App or Connected App client ID for this org
            </span>
          </div>
          <div className={styles.buttonRow}>
            <button className="button-brand" onClick={handleAddConnection}>
              Authorize
            </button>
            <button className="button-neutral" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <details className={styles.instructions}>
        <summary>Connected App Configuration</summary>
        <ol>
          <li>In Salesforce Setup, create an External Client App or Connected App</li>
          <li>
            Callback URL: <code>https://sftools.dev/sftools-callback</code>
          </li>
          <li>
            OAuth Scopes: <code>api, web, refresh_token</code>
          </li>
          <li>
            Disable{' '}
            <code>PKCE, Require secret for Web Server, Require secret for Refresh Token</code>
          </li>
        </ol>
      </details>
    </div>
  );
}
