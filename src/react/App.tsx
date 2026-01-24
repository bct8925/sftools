import { useState, useEffect, useCallback } from 'react';
import { AppProviders } from './AppProviders';
import { MobileMenu } from './MobileMenu';
import { ConnectionSelector } from './ConnectionSelector';
import { type TabId } from './TabNavigation';

// Import React tab components
import { QueryTab } from '../components/query/QueryTab';
import { ApexTab } from '../components/apex/ApexTab';
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

  // Render tab content based on active tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'query':
        return <QueryTab />;
      case 'apex':
        return <ApexTab />;
      case 'rest-api':
        return <RestApiTab />;
      case 'events':
        return <EventsTab />;
      case 'utils':
        return <UtilsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <QueryTab />;
    }
  };

  return (
    <div className={styles.appContainer}>
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

      {/* Main Content Area */}
      <main className={styles.contentArea}>
        {renderTabContent()}
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
