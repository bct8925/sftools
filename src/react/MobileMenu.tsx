import { useState, useCallback } from 'react';
import { useConnection } from '../contexts/ConnectionContext';
import { useProxy } from '../contexts/ProxyContext';
import { TabNavigation, type TabId } from './TabNavigation';
import { SfIcon } from '../components/sf-icon/SfIcon';
import { getAccessToken, getInstanceUrl } from '../lib/auth';
import styles from './MobileMenu.module.css';

interface MobileMenuProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

/**
 * Mobile hamburger menu with tab navigation and connection management.
 * Includes Open Org, Open in Tab, and connection list sections.
 */
export function MobileMenu({ activeTab, onTabChange }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    connections,
    activeConnection,
    isAuthenticated,
    setActiveConnection,
    removeConnection,
  } = useConnection();

  const openMenu = useCallback(() => setIsOpen(true), []);
  const closeMenu = useCallback(() => setIsOpen(false), []);

  const handleTabChange = useCallback((tab: TabId) => {
    onTabChange(tab);
    closeMenu();
  }, [onTabChange, closeMenu]);

  const handleOpenOrg = useCallback(() => {
    if (!isAuthenticated) return;
    const instanceUrl = getInstanceUrl();
    const accessToken = getAccessToken();
    const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}`;
    window.open(frontdoorUrl, '_blank');
    closeMenu();
  }, [isAuthenticated, closeMenu]);

  const handleOpenInTab = useCallback(() => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dist/pages/app/app.html') });
    closeMenu();
  }, [closeMenu]);

  const handleAddConnection = useCallback(() => {
    onTabChange('settings');
    closeMenu();
  }, [onTabChange, closeMenu]);

  const handleSelectConnection = useCallback(async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      setActiveConnection(connection);
    }
    closeMenu();
  }, [connections, setActiveConnection, closeMenu]);

  const handleRemoveConnection = useCallback(async (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation();
    if (!confirm('Remove this connection?')) return;
    await removeConnection(connectionId);
    onTabChange('settings');
  }, [removeConnection, onTabChange]);

  return (
    <>
      {/* Hamburger Button */}
      <button
        className={styles.hamburgerBtn}
        onClick={openMenu}
        aria-label="Menu"
      >
        <SfIcon name="hamburger" />
      </button>

      {/* Mobile Menu Panel */}
      <div className={`${styles.mobileMenu} ${isOpen ? styles.open : ''}`}>
        <div className={styles.mobileMenuHeader}>
          <div className="nav-brand">
            <img src="../../icon.png" alt="" className="nav-brand-icon" />
            sftools
          </div>
          <button
            className={styles.mobileMenuClose}
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <SfIcon name="closeLarge" />
          </button>
        </div>

        <div className={styles.mobileMenuContent}>
          {/* Tab Navigation */}
          <TabNavigation
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />

          <hr className={styles.mobileMenuDivider} />

          {/* Open Org Button */}
          <button
            className={`${styles.mobileNavItem} ${!isAuthenticated ? styles.disabled : ''}`}
            onClick={handleOpenOrg}
            disabled={!isAuthenticated}
          >
            Open Org
          </button>

          {/* Open in Tab Button */}
          <button
            className={styles.mobileNavItem}
            onClick={handleOpenInTab}
          >
            Open in Tab
          </button>

          <hr className={styles.mobileMenuDivider} />

          {/* Connection Section */}
          <div className={styles.mobileConnectionSection}>
            <span className={styles.mobileSectionLabel}>Connections</span>
            <div className={styles.mobileConnectionList}>
              {connections.map(conn => (
                <div
                  key={conn.id}
                  className={`${styles.mobileConnectionItem} ${conn.id === activeConnection?.id ? styles.active : ''}`}
                  onClick={() => handleSelectConnection(conn.id)}
                >
                  <span className={styles.mobileConnectionName}>
                    {conn.label}
                  </span>
                  <button
                    className={styles.mobileConnectionRemove}
                    onClick={(e) => handleRemoveConnection(e, conn.id)}
                    title="Remove"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            {connections.length > 0 && (
              <button
                className={styles.mobileNavItem}
                onClick={handleAddConnection}
              >
                + Add Connection
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      <div
        className={`${styles.mobileMenuOverlay} ${isOpen ? styles.open : ''}`}
        onClick={closeMenu}
      />
    </>
  );
}
