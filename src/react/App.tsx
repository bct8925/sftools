import { useState, useCallback, lazy, Suspense, type ComponentType } from 'react';
import { AppProviders } from './AppProviders';
import { MobileMenu } from './MobileMenu';
import { ConnectionSelector } from './ConnectionSelector';
import { AuthExpirationHandler } from './AuthExpirationHandler';
import { CorsErrorHandler } from './CorsErrorHandler';
import { type TabId } from './TabNavigation';

import styles from './App.module.css';

// Lazy load tab components
const QueryTab = lazy(() => import('../components/query/QueryTab').then(m => ({ default: m.QueryTab })));
const ApexTab = lazy(() => import('../components/apex/ApexTab').then(m => ({ default: m.ApexTab })));
const DebugLogsTab = lazy(() => import('../components/debug-logs/DebugLogsTab').then(m => ({ default: m.DebugLogsTab })));
const RestApiTab = lazy(() => import('../components/rest-api/RestApiTab').then(m => ({ default: m.RestApiTab })));
const EventsTab = lazy(() => import('../components/events/EventsTab').then(m => ({ default: m.EventsTab })));
const UtilsTab = lazy(() => import('../components/utils/UtilsTab').then(m => ({ default: m.UtilsTab })));
const SettingsTab = lazy(() => import('../components/settings/SettingsTab').then(m => ({ default: m.SettingsTab })));

// Tab component registry
const TAB_COMPONENTS: Record<TabId, ComponentType> = {
  'query': QueryTab,
  'apex': ApexTab,
  'logs': DebugLogsTab,
  'rest-api': RestApiTab,
  'events': EventsTab,
  'utils': UtilsTab,
  'settings': SettingsTab,
};

const TAB_IDS: TabId[] = ['query', 'apex', 'logs', 'rest-api', 'events', 'utils', 'settings'];

/**
 * Main App component that renders the navigation header and tab content.
 * Wrapped by AppProviders for context access.
 */
function AppContent() {
  const [activeTab, setActiveTab] = useState<TabId>('query');

  // Handle tab change and dispatch event for components that need it
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab);
    // Notify legacy components about tab change
    document.dispatchEvent(
      new CustomEvent('tab-changed', { detail: { tabId: tab } })
    );
  }, []);

  return (
    <div className={styles.appContainer} data-testid="app-root">
      {/* Modal handlers */}
      <AuthExpirationHandler />
      <CorsErrorHandler />

      {/* Navigation Header */}
      <nav className={styles.tabNav}>
        <MobileMenu
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
        <div className="nav-brand">
          <img src="../../icon.png" alt="" className="nav-brand-icon" />
          sftools
        </div>
        <ConnectionSelector />
      </nav>

      {/* Main Content Area - All tabs rendered, only active visible */}
      <main className={styles.contentArea}>
        {TAB_IDS.map((id) => {
          const TabComponent = TAB_COMPONENTS[id];
          return (
            <div
              key={id}
              className={activeTab === id ? styles.tabPanelActive : styles.tabPanelHidden}
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
