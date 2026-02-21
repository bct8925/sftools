import { useCallback } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { useProxy } from '../contexts/ProxyContext';
import { SfIcon } from '../components/sf-icon/SfIcon';
import { FEATURES, type FeatureId, type Feature } from './TabNavigation';
import styles from './HomeScreen.module.css';

interface HomeScreenProps {
    onFeatureSelect: (featureId: FeatureId) => void;
    onSettingsClick: () => void;
}

export function HomeScreen({ onFeatureSelect, onSettingsClick }: HomeScreenProps) {
    const { isAuthenticated } = useConnection();
    const { isConnected: isProxyConnected } = useProxy();

    const isDisabled = useCallback(
        (feature: Feature): boolean => {
            if (feature.requiresAuth && !isAuthenticated) return true;
            if (feature.requiresProxy && !isProxyConnected) return true;
            return false;
        },
        [isAuthenticated, isProxyConnected]
    );

    const handleTileClick = useCallback(
        (feature: Feature) => {
            if (isDisabled(feature)) return;
            onFeatureSelect(feature.id);
        },
        [isDisabled, onFeatureSelect]
    );

    return (
        <div className={styles.homeScreen} data-testid="home-screen">
            <div className={styles.tileGrid}>
                {FEATURES.map(feature => {
                    const disabled = isDisabled(feature);
                    return (
                        <button
                            key={feature.id}
                            className={`${styles.tile} ${disabled ? styles.tileDisabled : ''}`}
                            onClick={() => handleTileClick(feature)}
                            disabled={disabled}
                            data-testid={`tile-${feature.id}`}
                        >
                            <div
                                className={styles.tileIconContainer}
                                style={{ backgroundColor: feature.tileColor }}
                            >
                                <SfIcon name={feature.tileIcon} />
                            </div>
                            <span className={styles.tileLabel}>{feature.label}</span>
                        </button>
                    );
                })}
            </div>

            <button
                className={styles.settingsBtn}
                onClick={onSettingsClick}
                aria-label="Settings"
                data-testid="home-settings-btn"
            >
                <SfIcon name="tileSettings" />
            </button>
        </div>
    );
}
