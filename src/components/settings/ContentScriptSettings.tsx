import { useEffect, useState } from 'react';
import { useContentScript } from '../../contexts/ContentScriptContext';
import { requestPermission } from '../../lib/permissions';
import styles from './ProxySettings.module.css';

export function ContentScriptSettings() {
    const { isActive, isActivating, error, enable, disable } = useContentScript();
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        chrome.storage.local.get(['contentScriptEnabled']).then(data => {
            setEnabled(Boolean(data.contentScriptEnabled));
        });
    }, []);

    const handleToggle = async (checked: boolean) => {
        if (checked) {
            const granted = await requestPermission('scripting');
            if (!granted) return;

            setEnabled(true);
            await enable();
        } else {
            setEnabled(false);
            await disable();
        }
    };

    return (
        <div>
            <p className={styles.description}>
                Bypass CORS restrictions by injecting a content script into your Salesforce tab.
                This enables more API features, such as Bulk API v1 data imports.
            </p>

            <label className={styles.toggleLabel}>
                <input
                    type="checkbox"
                    checked={enabled}
                    onChange={e => handleToggle(e.target.checked)}
                />
                <span>Enable Content Script</span>
            </label>

            {enabled && (
                <div className={styles.proxyStatus}>
                    <div className={styles.statusRow}>
                        <span
                            className={`${styles.indicator} ${
                                isActivating
                                    ? styles.connecting
                                    : isActive
                                      ? styles.connected
                                      : styles.disconnected
                            }`}
                        />
                        <div className={styles.statusText}>
                            <div className={styles.label}>
                                {isActivating ? 'Activating...' : isActive ? 'Active' : 'Inactive'}
                            </div>
                            <div className={styles.detail}>
                                {isActivating &&
                                    'Click the extension icon on a Salesforce tab to inject'}
                                {isActive && 'API calls will bypass CORS via content script'}
                                {!isActivating &&
                                    !isActive &&
                                    (error || 'Content script not active')}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <details className={styles.instructions}>
                <summary>How It Works</summary>
                <p>
                    When enabled, a small script is injected into your active Salesforce tab. API
                    requests are made from the page&apos;s origin, which means they are same-origin
                    to Salesforce and don&apos;t require CORS configuration.
                </p>
                <p>
                    <strong>Note:</strong> This requires an active Salesforce tab. For streaming
                    features (Platform Events), the local proxy is still required.
                </p>
            </details>
        </div>
    );
}
