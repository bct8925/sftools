import { useState } from 'react';
import { ConnectionList } from './ConnectionList';
import { ThemeSettings } from './ThemeSettings';
import { ProxySettings } from './ProxySettings';
import { CacheSettings } from './CacheSettings';
import { EditConnectionModal } from './EditConnectionModal';
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

      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconDeveloper}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12.75 8a4.5 4.5 0 0 1-8.61 1.834l-1.391.565A6.001 6.001 0 0 0 14.25 8 6 6 0 0 0 3.5 4.334V2.5H2v4h4V5H4.5A4.5 4.5 0 0 1 12.75 8z" />
            </svg>
          </div>
          <h2>Developer</h2>
        </div>
        <div className="card-body">
          <p className={styles.description}>
            Developer tools for sftools extension development.
          </p>
          <button
            className={styles['button-neutral']}
            onClick={() => {
              try {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.reload) {
                  chrome.runtime.reload();
                } else {
                  // Fallback for mocked mode or standard web
                  window.location.reload();
                }
              } catch (e) {
                console.error('Reload failed:', e);
                window.location.reload();
              }
            }}
          >
            Reload Extension
          </button>
        </div>
      </div>

      <EditConnectionModal
        connectionId={editingConnectionId}
        onClose={() => setEditingConnectionId(null)}
      />
    </div>
  );
}
