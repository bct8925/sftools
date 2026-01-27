import { useState, useCallback, type ReactNode } from 'react';
import { AppProviders } from './AppProviders';
import { MobileMenu } from './MobileMenu';
import { ConnectionSelector } from './ConnectionSelector';
import { AuthExpirationHandler } from './AuthExpirationHandler';
import { CorsErrorHandler } from './CorsErrorHandler';
import { type TabId } from './TabNavigation';

// Import React tab components
import { QueryTab } from '../components/query/QueryTab';
import { ApexTab } from '../components/apex/ApexTab';
import { DebugLogsTab } from '../components/debug-logs/DebugLogsTab';
import { RestApiTab } from '../components/rest-api/RestApiTab';
import { EventsTab } from '../components/events/EventsTab';
import { UtilsTab } from '../components/utils/UtilsTab';
import { SettingsTab } from '../components/settings/SettingsTab';

import styles from './App.module.css';

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

  // Tab configuration for rendering all tabs (memoized)
  const tabs: { id: TabId; component: ReactNode }[] = [
    { id: 'query', component: <QueryTab /> },
    { id: 'apex', component: <ApexTab /> },
    { id: 'logs', component: <DebugLogsTab /> },
    { id: 'rest-api', component: <RestApiTab /> },
    { id: 'events', component: <EventsTab /> },
    { id: 'utils', component: <UtilsTab /> },
    { id: 'settings', component: <SettingsTab /> },
  ];

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
        {tabs.map(({ id, component }) => (
          <div
            key={id}
            className={activeTab === id ? styles.tabPanelActive : styles.tabPanelHidden}
            data-testid={`tab-content-${id}`}
          >
            {component}
          </div>
        ))}
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
