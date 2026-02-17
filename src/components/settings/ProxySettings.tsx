import { useEffect, useState } from 'react';
import { useProxy } from '../../contexts/ProxyContext';
import styles from './ProxySettings.module.css';

export function ProxySettings() {
  const { isConnected, isConnecting, httpPort, version, error, connect, disconnect } = useProxy();
  const [proxyEnabled, setProxyEnabled] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['proxyEnabled']).then((data) => {
      setProxyEnabled(Boolean(data.proxyEnabled));
    });
  }, []);

  const handleToggle = async (enabled: boolean) => {
    setProxyEnabled(enabled);
    await chrome.storage.local.set({ proxyEnabled: enabled });

    if (enabled) {
      await connect();
    } else {
      await disconnect();
    }
  };

  return (
    <div>
      <p className={styles.description}>
        The local proxy enables advanced features like Platform Event streaming via gRPC and
        automatic token refresh.
      </p>

      <label className={styles.toggleLabel}>
        <input
          type="checkbox"
          checked={proxyEnabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>Enable Local Proxy</span>
      </label>

      {proxyEnabled && (
        <div className={styles.proxyStatus}>
          <div className={styles.statusRow}>
            <span
              className={`${styles.indicator} ${
                isConnecting ? styles.connecting : isConnected ? styles.connected : styles.disconnected
              }`}
            />
            <div className={styles.statusText}>
              <div className={styles.label}>
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Not Connected'}
              </div>
              <div className={styles.detail}>
                {isConnecting && 'Establishing connection to local proxy'}
                {isConnected && `HTTP server on port ${httpPort}`}
                {!isConnecting && !isConnected && error}
              </div>
            </div>
          </div>

          {version && (
            <div className={styles.versionInfo}>Proxy version: {version}</div>
          )}
        </div>
      )}

      <details className={styles.instructions}>
        <summary>Installation Instructions</summary>
        <ol>
          <li>
            Install <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">Node.js 18</a> or later
          </li>
          <li>Open a terminal in the <code>sftools-proxy</code> folder</li>
          <li>Run: <code>npm run install-host</code></li>
          <li>Restart Chrome completely</li>
          <li>Enable the toggle above</li>
        </ol>
      </details>

      <details className={styles.instructions}>
        <summary>CORS Configuration (Salesforce)</summary>
        <p>
          To allow the Chrome extension to make requests to your Salesforce org, add a CORS entry:
        </p>
        <ol>
          <li>In Salesforce Setup, search for "CORS"</li>
          <li>Click "CORS" under Security</li>
          <li>Click "New" to add an allowed origin pattern</li>
          <li>Enter: <code>chrome-extension://lhkfhpookakmejcjfanegicfcdcmmoca</code></li>
          <li>Save the CORS entry</li>
        </ol>
        <p>
          <strong>Note:</strong> When the local proxy is enabled, CORS restrictions are bypassed
          automatically and this configuration is not required.
        </p>
      </details>
    </div>
  );
}
