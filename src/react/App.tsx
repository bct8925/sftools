import { useState, useCallback, lazy, Suspense, type ComponentType } from 'react';
import { AppProviders } from './AppProviders';
import { HomeScreen } from './HomeScreen';
import { ConnectionSelector } from './ConnectionSelector';
import { AuthExpirationHandler } from './AuthExpirationHandler';
import { CorsErrorHandler } from './CorsErrorHandler';
import { SfIcon } from '../components/sf-icon/SfIcon';
import { type TabId, type FeatureId } from './TabNavigation';

import styles from './App.module.css';

// Lazy load tab components
const QueryTab = lazy(() =>
    import('../components/query/QueryTab').then(m => ({ default: m.QueryTab }))
);
const ApexTab = lazy(() =>
    import('../components/apex/ApexTab').then(m => ({ default: m.ApexTab }))
);
const DebugLogsTab = lazy(() =>
    import('../components/debug-logs/DebugLogsTab').then(m => ({ default: m.DebugLogsTab }))
);
const RestApiTab = lazy(() =>
    import('../components/rest-api/RestApiTab').then(m => ({ default: m.RestApiTab }))
);
const EventsTab = lazy(() =>
    import('../components/events/EventsTab').then(m => ({ default: m.EventsTab }))
);
const SchemaTab = lazy(() =>
    import('../components/schema/SchemaTab').then(m => ({ default: m.SchemaTab }))
);
const UtilsTab = lazy(() =>
    import('../components/utils/UtilsTab').then(m => ({ default: m.UtilsTab }))
);
const SettingsTab = lazy(() =>
    import('../components/settings/SettingsTab').then(m => ({ default: m.SettingsTab }))
);

// Tab component registry
const TAB_COMPONENTS: Record<TabId, ComponentType> = {
    query: QueryTab,
    apex: ApexTab,
    logs: DebugLogsTab,
    'rest-api': RestApiTab,
    events: EventsTab,
    schema: SchemaTab,
    utils: UtilsTab,
    settings: SettingsTab,
};

const TAB_IDS: TabId[] = [
    'query',
    'apex',
    'logs',
    'rest-api',
    'events',
    'schema',
    'utils',
    'settings',
];

type ViewState = { view: 'home' } | { view: 'feature'; featureId: TabId };

function getInitialViewState(): ViewState {
    const param = new URLSearchParams(window.location.search).get('feature');
    if (param && TAB_IDS.includes(param as TabId)) {
        return { view: 'feature', featureId: param as TabId };
    }
    return { view: 'home' };
}

/**
 * Main App component with home screen tile navigation.
 * Home view shows tile grid, feature view shows the selected tab content.
 */
function AppContent() {
    const [viewState, setViewState] = useState<ViewState>(getInitialViewState);

    const activeTab = viewState.view === 'feature' ? viewState.featureId : null;

    const navigateToFeature = useCallback((featureId: FeatureId | 'settings') => {
        setViewState({ view: 'feature', featureId });
    }, []);

    const navigateHome = useCallback(() => {
        setViewState({ view: 'home' });
    }, []);

    const handleSettingsClick = useCallback(() => {
        navigateToFeature('settings');
    }, [navigateToFeature]);

    const isHome = viewState.view === 'home';

    return (
        <div
            className={`${styles.appContainer} ${isHome ? styles.appContainerHome : ''}`}
            data-testid="app-root"
        >
            {/* Modal handlers */}
            <AuthExpirationHandler />
            <CorsErrorHandler />

            {/* Navigation Header */}
            <nav className={styles.tabNav}>
                <button
                    className={styles.waffleBtn}
                    onClick={!isHome ? navigateHome : undefined}
                    aria-label="Home"
                    data-testid="waffle-btn"
                >
                    <SfIcon name="apps" />
                </button>
                <div
                    className={`nav-brand ${!isHome ? styles.navBrandClickable : ''}`}
                    onClick={!isHome ? navigateHome : undefined}
                >
                    <img src="../../icon.png" alt="" className="nav-brand-icon" />
                    sftools
                </div>
                <ConnectionSelector />
            </nav>

            {/* Home Screen */}
            {isHome && (
                <HomeScreen
                    onFeatureSelect={navigateToFeature}
                    onSettingsClick={handleSettingsClick}
                />
            )}

            {/* Main Content Area - All tabs rendered, only active visible */}
            <main className={`${styles.contentArea} ${isHome ? styles.contentHidden : ''}`}>
                {TAB_IDS.map(id => {
                    const TabComponent = TAB_COMPONENTS[id];
                    return (
                        <div
                            key={id}
                            className={
                                activeTab === id ? styles.tabPanelActive : styles.tabPanelHidden
                            }
                            data-testid={`tab-content-${id}`}
                        >
                            <Suspense fallback={<div />}>
                                <TabComponent />
                            </Suspense>
                        </div>
                    );
                })}
            </main>
        </div>
    );
}

/**
 * App component with all providers wrapped.
 */
export function App() {
    return (
        <AppProviders>
            <AppContent />
        </AppProviders>
    );
}
