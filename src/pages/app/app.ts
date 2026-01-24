// sftools - Main Application Entry Point
import { debugInfo } from '../../lib/debug.js';
import {
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    checkProxyStatus,
    isProxyConnected,
    onAuthExpired,
    // Multi-connection
    loadConnections,
    setActiveConnection,
    getActiveConnectionId,
    removeConnection,
    updateConnection,
    migrateFromSingleConnection,
    // OAuth
    getOAuthCredentials,
    setPendingAuth,
    generateOAuthState,
    migrateCustomConnectedApp,
    // Cache
    migrateDescribeCache,
} from '../../lib/utils.js';
import { initTheme } from '../../lib/theme.js';
import '../../components/sf-icon/sf-icon.js';
// Self-registering custom element tabs
import '../../components/query/query-tab.js';
import '../../components/apex/apex-tab.js';
import '../../components/rest-api/rest-api-tab.js';
import '../../components/events/events-tab.js';
import '../../components/settings/settings-tab.js';
import '../../components/utils/utils-tab.js';
import '../../components/modal/modal-popup.js';
import type { SalesforceConnection } from '../../types/salesforce';
import type { ModalPopupElement } from '../../types/components';

// OAuth constants
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// Cached login domain for authorization
let detectedLoginDomain = 'https://login.salesforce.com';

// Auth expiration modal state
let authExpiredModalOpen = false;

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize theme first to prevent flash
    await initTheme();

    initTabs();
    initMobileMenu();
    initAuthExpirationHandler();
    initCorsErrorModal();

    await checkProxyStatus();
    await initializeConnections();

    // Apply feature gating based on proxy status
    updateFeatureGating();

    // Listen for proxy status changes
    document.addEventListener('proxy-status-changed', async (_e: Event) => {
        await checkProxyStatus(); // Update PROXY_CONNECTED state
        updateFeatureGating(); // Re-apply feature gating
    });

    // Notify components that auth is ready
    document.dispatchEvent(new CustomEvent('auth-ready'));
});

// Listen for connection list changes (e.g., new auth from another tab)
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.connections) {
        await refreshConnectionList(false);

        // Close auth-expired modal if present and a valid connection now exists
        const overlay = document.querySelector('.auth-expired-overlay');
        if (overlay) {
            const connections = (changes.connections.newValue || []) as SalesforceConnection[];
            const validConn = connections.find(c => c.accessToken);
            if (validConn) {
                authExpiredModalOpen = false;
                overlay.remove();
            }
        }
    }
});

// --- Connection Management ---
async function initializeConnections(): Promise<void> {
    // Migrate from old single-connection format if needed
    await migrateFromSingleConnection();
    // Migrate from global customConnectedApp to per-connection clientId
    await migrateCustomConnectedApp();
    // Migrate describe cache from single-key to per-connection keys
    await migrateDescribeCache();

    // Use refreshConnectionList with auto-select enabled
    await refreshConnectionList(true);
}

/**
 * Refresh the connection list and update all UI state.
 * This is the single source of truth for connection list changes.
 * @param autoSelect - If true and no active connection exists, auto-select most recent
 */
async function refreshConnectionList(autoSelect = false): Promise<void> {
    const connections = await loadConnections();

    if (connections.length === 0) {
        showNoConnectionsState();
        return;
    }

    // Check if active connection still exists
    const activeId = getActiveConnectionId();
    const activeConnection = connections.find(c => c.id === activeId);

    if (!activeConnection) {
        // Active connection was removed
        setActiveConnection(null);
        updateHeaderConnectionDisplay(null);

        if (autoSelect) {
            // Auto-select most recently used connection
            const mostRecent = connections.reduce((a, b) => (a.lastUsedAt > b.lastUsedAt ? a : b));
            await selectConnection(mostRecent);
        }
    }

    updateMobileConnections(connections);
    updateConnectionGating();
}

/**
 * Update UI to reflect zero connections state.
 * Clears all connection displays and switches to Settings tab.
 * Called by refreshConnectionList() when connections.length === 0.
 */
function showNoConnectionsState(): void {
    setActiveConnection(null); // Ensure active connection is cleared
    updateMobileConnections([]);
    updateHeaderConnectionDisplay(null);
    updateConnectionGating();
    switchToSettingsTab();
}

function switchToSettingsTab(): void {
    const mobileNavItem = document.querySelector('.mobile-nav-item[data-tab="settings"]');
    if (mobileNavItem) {
        (mobileNavItem as HTMLElement).click();
    }
}

function escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function selectConnection(connection: SalesforceConnection): Promise<void> {
    setActiveConnection(connection);
    updateMobileConnections(await loadConnections());
    updateConnectionGating();

    // Update header connection display
    updateHeaderConnectionDisplay(connection);

    // Update lastUsedAt
    await updateConnection(connection.id, {});

    // Notify components that connection changed
    document.dispatchEvent(new CustomEvent('connection-changed', { detail: connection }));
}

function updateHeaderConnectionDisplay(connection: SalesforceConnection | null): void {
    const displayElement = document.querySelector('.current-connection-display');
    if (displayElement) {
        if (connection?.label) {
            displayElement.textContent = connection.label;
            displayElement.setAttribute('title', connection.label); // Show full text on hover
        } else {
            displayElement.textContent = '';
            displayElement.setAttribute('title', '');
        }
    }
}

async function detectLoginDomain(): Promise<void> {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            const urlObj = new URL(tab.url);
            if (urlObj.hostname.includes('.my.salesforce.com')) {
                detectedLoginDomain = urlObj.origin;
            } else if (urlObj.hostname.includes('.lightning.force.com')) {
                detectedLoginDomain = urlObj.origin.replace(
                    '.lightning.force.com',
                    '.my.salesforce.com'
                );
            } else if (urlObj.hostname.includes('.salesforce-setup.com')) {
                detectedLoginDomain = urlObj.origin.replace(
                    '.salesforce-setup.com',
                    '.salesforce.com'
                );
            }
        }
    } catch (e) {
        console.error('Error detecting domain:', e);
    }
}

/**
 * Start OAuth authorization flow
 * @param overrideLoginDomain - Login domain to use (or detect from current tab)
 * @param overrideClientId - Custom client ID to use (or use default)
 * @param connectionId - Connection ID if re-authorizing an existing connection
 */
async function startAuthorization(
    overrideLoginDomain: string | null = null,
    overrideClientId: string | null = null,
    connectionId: string | null = null
): Promise<void> {
    // Use provided domain or detect from current tab
    let loginDomain: string;
    if (overrideLoginDomain) {
        loginDomain = overrideLoginDomain;
    } else {
        await detectLoginDomain();
        loginDomain = detectedLoginDomain;
    }

    // Check proxy for code flow
    let useCodeFlow = false;
    try {
        const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
        useCodeFlow = proxyStatus.connected;
    } catch {
        debugInfo('Proxy not available, using implicit flow');
    }

    // Get client ID - use override, or fall back to default
    const clientId = overrideClientId ?? (await getOAuthCredentials()).clientId;

    // Generate state parameter for CSRF protection
    const state = generateOAuthState();

    // Store pending auth state for callback to use
    await setPendingAuth({
        loginDomain,
        clientId: overrideClientId, // Store only if custom (null means use default)
        connectionId, // Set if re-authorizing existing connection
        state, // For CSRF validation
    });

    const responseType = useCodeFlow ? 'code' : 'token';
    const authUrl =
        `${loginDomain}/services/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&response_type=${responseType}` +
        `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}` +
        `&state=${encodeURIComponent(state)}`;

    chrome.tabs.create({ url: authUrl });
}

// Make startAuthorization available globally for Settings tab
(window as any).startAuthorization = startAuthorization;

// --- Auth Expiration Handler ---
function initAuthExpirationHandler(): void {
    onAuthExpired(async (expiredConnectionId: string | null) => {
        // Prevent duplicate modals (synchronous check to avoid race condition)
        if (authExpiredModalOpen) return;
        authExpiredModalOpen = true;

        const connections = await loadConnections();
        const expiredConnection = expiredConnectionId
            ? connections.find(c => c.id === expiredConnectionId)
            : null;

        const connectionLabel = expiredConnection?.label || 'Unknown';

        const overlay = document.createElement('div');
        overlay.className = 'auth-expired-overlay';
        overlay.innerHTML = `
            <div class="auth-expired-modal">
                <h2>Authorization Lost</h2>
                <p>The session for <strong>${escapeHtml(connectionLabel)}</strong> has expired.</p>
                <div class="auth-expired-buttons">
                    <button id="reauth-btn" class="button-brand">Re-authorize</button>
                    <button id="delete-conn-btn" class="button-neutral">Delete</button>
                    <button id="dismiss-btn" class="button-neutral">Dismiss</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#reauth-btn')!.addEventListener('click', async () => {
            if (!expiredConnection) {
                console.error('Re-auth failed: expiredConnection is null');
                return;
            }
            // Use connection's instanceUrl, clientId, and pass connectionId for re-auth
            await startAuthorization(
                expiredConnection.instanceUrl,
                expiredConnection.clientId,
                expiredConnection.id
            );
        });

        overlay.querySelector('#delete-conn-btn')!.addEventListener('click', async () => {
            if (expiredConnectionId) {
                // Clear active connection first to prevent auth expiration trigger
                setActiveConnection(null);
                await removeConnection(expiredConnectionId);
                await refreshConnectionList();
                switchToSettingsTab();
            }
            authExpiredModalOpen = false;
            overlay.remove();
        });

        overlay.querySelector('#dismiss-btn')!.addEventListener('click', () => {
            authExpiredModalOpen = false;
            overlay.remove();
        });
    });
}

// --- Feature Gating ---
function updateFeatureGating(): void {
    const eventsNavItem = document.querySelector('.mobile-nav-item[data-tab="events"]');
    const eventsContent = document.getElementById('events');

    if (!eventsNavItem || !eventsContent) return;

    if (!isProxyConnected()) {
        // Disable the events tab
        eventsNavItem.classList.add('tab-disabled');
        eventsContent.classList.add('feature-disabled');

        // Add overlay with message if not already present
        if (!eventsContent.querySelector('.feature-gate-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'feature-gate-overlay';
            overlay.innerHTML = `
                <div class="feature-gate-message">
                    <h3>Local Proxy Required</h3>
                    <p>Platform Events streaming requires the local proxy to be installed and connected.</p>
                    <button id="feature-gate-settings-btn">Open Settings</button>
                </div>
            `;
            eventsContent.appendChild(overlay);

            // Settings button handler - switch to settings tab
            overlay.querySelector('#feature-gate-settings-btn')!.addEventListener('click', () => {
                switchToSettingsTab();
            });
        }
    } else {
        // Enable the events tab
        eventsNavItem.classList.remove('tab-disabled');
        eventsContent.classList.remove('feature-disabled');

        // Remove overlay if present
        const overlay = eventsContent.querySelector('.feature-gate-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    // Update connection-gated features
    updateConnectionGating();
}

// --- Connection Gating ---
function updateConnectionGating(): void {
    const hasConnections = isAuthenticated();

    // List of menu items that require a connection
    const connectionRequiredTabs = ['query', 'apex', 'rest-api', 'events', 'utils'];

    connectionRequiredTabs.forEach(tabId => {
        const navItem = document.querySelector(`.mobile-nav-item[data-tab="${tabId}"]`);
        if (navItem) {
            if (hasConnections) {
                navItem.classList.remove('tab-disabled');
            } else {
                navItem.classList.add('tab-disabled');
            }
        }
    });

    // Disable "Open Org" button without connection
    const mobileOpenOrg = document.getElementById('mobile-open-org');
    if (mobileOpenOrg) {
        if (hasConnections) {
            mobileOpenOrg.classList.remove('tab-disabled');
        } else {
            mobileOpenOrg.classList.add('tab-disabled');
        }
    }
}

// --- Tab Navigation ---
// Tab switching is handled by the mobile menu
function initTabs(): void {
    // No-op: hamburger menu is now the primary navigation
}

// --- Mobile Menu ---
function initMobileMenu(): void {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileOverlay = document.querySelector('.mobile-menu-overlay');
    const closeBtn = mobileMenu?.querySelector('.mobile-menu-close');
    const mobileNavItems = mobileMenu?.querySelectorAll<HTMLElement>('.mobile-nav-item[data-tab]');
    const mobileOpenOrg = document.getElementById('mobile-open-org');
    const mobileOpenTab = document.getElementById('mobile-open-tab');
    const mobileAddConnection = mobileMenu?.querySelector('.mobile-add-connection');
    const mobileConnectionList = mobileMenu?.querySelector('.mobile-connection-list');

    if (
        !hamburgerBtn ||
        !mobileMenu ||
        !mobileOverlay ||
        !closeBtn ||
        !mobileNavItems ||
        !mobileOpenOrg ||
        !mobileOpenTab ||
        !mobileAddConnection ||
        !mobileConnectionList
    ) {
        console.error('Mobile menu elements not found');
        return;
    }

    function openMenu(): void {
        mobileMenu!.classList.add('open');
        mobileOverlay!.classList.add('open');
    }

    function closeMenu(): void {
        mobileMenu!.classList.remove('open');
        mobileOverlay!.classList.remove('open');
    }

    // Hamburger button opens menu
    hamburgerBtn.addEventListener('click', openMenu);

    // Close button and overlay close menu
    closeBtn.addEventListener('click', closeMenu);
    mobileOverlay.addEventListener('click', closeMenu);

    // Tab navigation items
    mobileNavItems.forEach(item => {
        item.addEventListener('click', () => {
            // Prevent navigation if tab is disabled
            if (item.classList.contains('tab-disabled')) {
                return;
            }

            const targetId = item.getAttribute('data-tab');
            const contents = document.querySelectorAll('.tab-content');

            // Update nav active state
            mobileNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Switch content
            contents.forEach(c => c.classList.remove('active'));
            const targetContent = document.getElementById(targetId!);
            if (targetContent) {
                targetContent.classList.add('active');
                // Notify components that tab changed (for lazy loading)
                document.dispatchEvent(
                    new CustomEvent('tab-changed', { detail: { tabId: targetId } })
                );
            }

            closeMenu();
        });
    });

    // Open Org button
    mobileOpenOrg.addEventListener('click', () => {
        // Prevent action if button is disabled
        if (mobileOpenOrg.classList.contains('tab-disabled')) {
            return;
        }

        if (!isAuthenticated()) {
            startAuthorization();
        } else {
            const instanceUrl = getInstanceUrl();
            const accessToken = getAccessToken();
            const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}`;
            window.open(frontdoorUrl, '_blank');
        }
        closeMenu();
    });

    // Open in Tab button
    mobileOpenTab.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dist/pages/app/app.html') });
        closeMenu();
    });

    // Add Connection button - switch to Settings tab
    mobileAddConnection.addEventListener('click', () => {
        switchToSettingsTab();
        closeMenu();
    });

    // Delegate clicks on mobile connection list
    mobileConnectionList.addEventListener('click', async (e: Event) => {
        const item = (e.target as HTMLElement).closest('.mobile-connection-item') as HTMLElement;
        if (!item) return;

        const connectionId = item.dataset.id;
        if (!connectionId) return;

        // Handle remove button click
        if ((e.target as HTMLElement).closest('.mobile-connection-remove')) {
            e.stopPropagation();
            if (!confirm('Remove this connection?')) return;

            await removeConnection(connectionId);
            await refreshConnectionList();

            // Always switch to Settings tab after removing a connection
            switchToSettingsTab();
            return;
        }

        // Handle connection select
        const connections = await loadConnections();
        const connection = connections.find(c => c.id === connectionId);
        if (connection) {
            await selectConnection(connection);
        }
        closeMenu();
    });
}

function updateMobileConnections(connections: SalesforceConnection[]): void {
    const mobileConnectionList = document.querySelector('.mobile-connection-list');
    const mobileAddConnection = document.querySelector('.mobile-add-connection');
    const activeId = getActiveConnectionId();

    if (!mobileConnectionList || !mobileAddConnection) return;

    if (connections.length === 0) {
        mobileConnectionList.innerHTML = '';
        mobileAddConnection.classList.add('hidden');
    } else {
        mobileConnectionList.innerHTML = connections
            .map(
                conn => `
            <div class="mobile-connection-item ${conn.id === activeId ? 'active' : ''}" data-id="${conn.id}">
                <span class="mobile-connection-name">${escapeHtml(conn.label)}</span>
                <button class="mobile-connection-remove" title="Remove">&times;</button>
            </div>
        `
            )
            .join('');
        mobileAddConnection.classList.remove('hidden');
    }

    // Also update mobile nav active state to match current tab
    const activeContent = document.querySelector('.tab-content.active');
    if (activeContent) {
        const activeTabId = activeContent.id;
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item[data-tab]');
        mobileNavItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-tab') === activeTabId);
        });
    }
}

// ============================================================================
// CORS Error Modal
// ============================================================================

function initCorsErrorModal(): void {
    const modal = document.getElementById('cors-error-modal') as ModalPopupElement | null;
    const closeBtn = document.getElementById('cors-modal-close');

    if (!modal || !closeBtn) return;

    // Listen for CORS error events from anywhere in the app
    document.addEventListener('show-cors-error', () => {
        modal.open();
    });

    // Close button handler
    closeBtn.addEventListener('click', () => {
        modal.close();
    });
}
