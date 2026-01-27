import { useProxy } from '../contexts/ProxyContext';
import { useConnection } from '../contexts/ConnectionContext';
import styles from './TabNavigation.module.css';

export type TabId = 'query' | 'apex' | 'logs' | 'rest-api' | 'events' | 'utils' | 'settings';

interface Tab {
  id: TabId;
  label: string;
  requiresAuth: boolean;
  requiresProxy: boolean;
}

const TABS: Tab[] = [
  { id: 'query', label: 'Query', requiresAuth: true, requiresProxy: false },
  { id: 'apex', label: 'Apex', requiresAuth: true, requiresProxy: false },
  { id: 'logs', label: 'Debug Logs', requiresAuth: true, requiresProxy: false },
  { id: 'rest-api', label: 'REST API', requiresAuth: true, requiresProxy: false },
  { id: 'events', label: 'Platform Events', requiresAuth: true, requiresProxy: true },
  { id: 'utils', label: 'Utils', requiresAuth: true, requiresProxy: false },
  { id: 'settings', label: 'Settings', requiresAuth: false, requiresProxy: false },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Tab navigation for mobile menu - renders the list of tabs
 * with proper disabled states based on auth and proxy status.
 */
export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const { isConnected: isProxyConnected } = useProxy();
  const { isAuthenticated } = useConnection();

  const isTabDisabled = (tab: Tab): boolean => {
    if (tab.requiresAuth && !isAuthenticated) return true;
    if (tab.requiresProxy && !isProxyConnected) return true;
    return false;
  };

  const handleTabClick = (tab: Tab) => {
    if (isTabDisabled(tab)) return;
    onTabChange(tab.id);
  };

  return (
    <nav className={styles.mobileNav}>
      {TABS.map((tab) => {
        const disabled = isTabDisabled(tab);
        return (
          <button
            key={tab.id}
            className={`${styles.mobileNavItem} ${activeTab === tab.id ? styles.active : ''} ${disabled ? styles.disabled : ''}`}
            onClick={() => handleTabClick(tab)}
            disabled={disabled}
            data-tab={tab.id}
            data-testid={`mobile-nav-${tab.id}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export { TABS };
