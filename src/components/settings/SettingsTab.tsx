import { useState } from 'react';
import { ConnectionList } from './ConnectionList.jsx';
import { ThemeSettings } from './ThemeSettings.jsx';
import { ProxySettings } from './ProxySettings.jsx';
import { CacheSettings } from './CacheSettings.jsx';
import { EditConnectionModal } from './EditConnectionModal.jsx';
import styles from './SettingsTab.module.css';

export function SettingsTab() {
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);

  return (
    <div className={styles.settingsContent} data-testid="settings-tab">
      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconConnections}`}>
            C
          </div>
          <h2>Connections</h2>
        </div>
        <div className="card-body">
          <p className={styles.description}>
            Manage your Salesforce org connections. Each connection can use its own Connected App.
          </p>
          <ConnectionList onEditConnection={setEditingConnectionId} />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconAppearance}`}>
            A
          </div>
          <h2>Appearance</h2>
        </div>
        <div className="card-body">
          <p className={styles.description}>Customize the look and feel of sftools.</p>
          <ThemeSettings />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconProxy}`}>
            P
          </div>
          <h2>Local Proxy</h2>
        </div>
        <div className="card-body">
          <ProxySettings />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconCache}`}>
            D
          </div>
          <h2>Data</h2>
        </div>
        <div className="card-body">
          <CacheSettings />
        </div>
      </div>

      <EditConnectionModal
        connectionId={editingConnectionId}
        onClose={() => setEditingConnectionId(null)}
      />
    </div>
  );
}
