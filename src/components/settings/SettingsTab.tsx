import { useState, useCallback } from 'react';
import { ConnectionList } from './ConnectionList';
import { ThemeSettings } from './ThemeSettings';
import { ProxySettings } from './ProxySettings';
import { CacheSettings } from './CacheSettings';
import { DataManagement } from './DataManagement';
import { EditConnectionModal } from './EditConnectionModal';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import styles from './SettingsTab.module.css';

export function SettingsTab() {
    const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    const toggleCard = useCallback(
        (key: string) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] })),
        []
    );

    return (
        <div className={styles.settingsContent} data-testid="settings-tab">
            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconConnections}`}>C</div>
                    <h2 className="card-collapse-title" onClick={() => toggleCard('connections')}>
                        Connections
                    </h2>
                    <CollapseChevron
                        isOpen={!collapsed['connections']}
                        onClick={() => toggleCard('connections')}
                    />
                </div>
                {!collapsed['connections'] && (
                    <div className="card-body">
                        <p className={styles.description}>
                            Manage your Salesforce org connections. Each connection can use its own
                            Connected App.
                        </p>
                        <ConnectionList onEditConnection={setEditingConnectionId} />
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconAppearance}`}>A</div>
                    <h2 className="card-collapse-title" onClick={() => toggleCard('appearance')}>
                        Appearance
                    </h2>
                    <CollapseChevron
                        isOpen={!collapsed['appearance']}
                        onClick={() => toggleCard('appearance')}
                    />
                </div>
                {!collapsed['appearance'] && (
                    <div className="card-body">
                        <p className={styles.description}>
                            Customize the look and feel of sftools.
                        </p>
                        <ThemeSettings />
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconProxy}`}>P</div>
                    <h2 className="card-collapse-title" onClick={() => toggleCard('proxy')}>
                        Local Proxy
                    </h2>
                    <CollapseChevron
                        isOpen={!collapsed['proxy']}
                        onClick={() => toggleCard('proxy')}
                    />
                </div>
                {!collapsed['proxy'] && (
                    <div className="card-body">
                        <ProxySettings />
                    </div>
                )}
            </div>

            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconCache}`}>D</div>
                    <h2 className="card-collapse-title" onClick={() => toggleCard('data')}>
                        Data
                    </h2>
                    <CollapseChevron
                        isOpen={!collapsed['data']}
                        onClick={() => toggleCard('data')}
                    />
                </div>
                {!collapsed['data'] && (
                    <div className="card-body">
                        <CacheSettings />
                        <DataManagement />
                    </div>
                )}
            </div>

            <EditConnectionModal
                connectionId={editingConnectionId}
                onClose={() => setEditingConnectionId(null)}
            />
        </div>
    );
}
