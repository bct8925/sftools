import { useState, useCallback } from 'react';
import { useConnection } from '../../contexts/ConnectionContext';
import { getPlatform } from '../../platform';
import { LOGIN_ORG, REFRESH_ORGS } from '../../platform/protocol';
import { useToast } from '../../contexts/ToastContext';
import styles from './ConnectionList.module.css';
import cardStyles from './ConnectionCard.module.css';

const PRODUCTION_LOGIN = 'https://login.salesforce.com';
const SANDBOX_LOGIN = 'https://test.salesforce.com';

/**
 * Settings > Connections in VS Code.
 * Orgs come from the Salesforce CLI, so this lists them read-only and offers
 * "Refresh" and "Log in" (which runs `sf org login web` in the extension host).
 */
export function SfCliOrgList() {
    const { connections, activeConnection, setActiveConnection } = useConnection();
    const toast = useToast();
    const [showLoginForm, setShowLoginForm] = useState(false);
    const [loginUrl, setLoginUrl] = useState(PRODUCTION_LOGIN);
    const [customUrl, setCustomUrl] = useState('');
    const [alias, setAlias] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await getPlatform().sendMessage({ type: REFRESH_ORGS });
        } catch (error) {
            toast.show(error instanceof Error ? error.message : 'Refresh failed', 'error');
        } finally {
            setIsRefreshing(false);
        }
    }, [toast]);

    const handleLogin = useCallback(async () => {
        let url = loginUrl;
        if (url === 'custom') {
            url = customUrl.trim();
            if (!url) {
                toast.show('Enter a My Domain URL', 'error');
                return;
            }
            if (!url.startsWith('https://')) url = `https://${url}`;
        }
        setShowLoginForm(false);
        try {
            await getPlatform().sendMessage({
                type: LOGIN_ORG,
                loginUrl: url,
                alias: alias.trim() || undefined,
            });
        } catch (error) {
            toast.show(error instanceof Error ? error.message : 'Login failed', 'error');
        }
        setAlias('');
        setCustomUrl('');
    }, [loginUrl, customUrl, alias, toast]);

    return (
        <div data-testid="sf-cli-org-list">
            <div className={styles.connectionList}>
                {connections.length === 0 ? (
                    <div className={styles.noConnections}>
                        No orgs found. Log in with the Salesforce CLI, then refresh.
                    </div>
                ) : (
                    connections.map(conn => {
                        const isActive = conn.id === activeConnection?.id;
                        return (
                            <div
                                key={conn.id}
                                className={`${cardStyles.connectionItem} ${isActive ? cardStyles.active : ''}`}
                            >
                                <div className={cardStyles.connectionInfo}>
                                    <div className={cardStyles.connectionLabel}>{conn.label}</div>
                                    <div className={cardStyles.connectionDetail}>
                                        {conn.username && conn.username !== conn.label && (
                                            <span className={cardStyles.badge}>
                                                {conn.username}
                                            </span>
                                        )}
                                        {conn.isDefault && (
                                            <span className={cardStyles.badge}>Default org</span>
                                        )}
                                    </div>
                                </div>
                                {!isActive && (
                                    <div className={cardStyles.connectionActions}>
                                        <button
                                            className="button-neutral"
                                            onClick={() => setActiveConnection(conn)}
                                        >
                                            Use
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {!showLoginForm ? (
                <div className={styles.buttonRow}>
                    <button className="button-brand" onClick={() => setShowLoginForm(true)}>
                        + Log In to an Org
                    </button>
                    <button
                        className="button-neutral"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                    >
                        {isRefreshing ? 'Refreshing...' : 'Refresh Orgs'}
                    </button>
                </div>
            ) : (
                <div className={styles.addForm}>
                    <div className="form-element">
                        <label>LOGIN URL</label>
                        <select
                            className="select"
                            value={loginUrl}
                            onChange={e => setLoginUrl(e.target.value)}
                        >
                            <option value={PRODUCTION_LOGIN}>
                                Production (login.salesforce.com)
                            </option>
                            <option value={SANDBOX_LOGIN}>Sandbox (test.salesforce.com)</option>
                            <option value="custom">My Domain...</option>
                        </select>
                    </div>
                    {loginUrl === 'custom' && (
                        <div className="form-element">
                            <label>MY DOMAIN URL</label>
                            <input
                                type="text"
                                className="input"
                                value={customUrl}
                                onChange={e => setCustomUrl(e.target.value)}
                                placeholder="https://mycompany.my.salesforce.com"
                            />
                        </div>
                    )}
                    <div className="form-element">
                        <label>ALIAS (OPTIONAL)</label>
                        <input
                            type="text"
                            className="input"
                            value={alias}
                            onChange={e => setAlias(e.target.value)}
                            placeholder="my-org"
                        />
                    </div>
                    <div className={styles.buttonRow}>
                        <button className="button-brand" onClick={handleLogin}>
                            Log In
                        </button>
                        <button className="button-neutral" onClick={() => setShowLoginForm(false)}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
