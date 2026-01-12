// sftools - Main Application Entry Point
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
    migrateCustomConnectedApp
} from '../../lib/utils.js';
// Self-registering custom element tabs
import '../../components/query/query-tab.js';
import '../../components/apex/apex-tab.js';
import '../../components/rest-api/rest-api-tab.js';
import '../../components/events/events-tab.js';
import '../../components/settings/settings-tab.js';
import '../../components/utils/utils-tab.js';

// OAuth constants
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// Cached login domain for authorization
let detectedLoginDomain = 'https://login.salesforce.com';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initMobileMenu();
    initAuthExpirationHandler();

    await checkProxyStatus();
    await initializeConnections();

    // Apply feature gating based on proxy status
    updateFeatureGating();

    // Listen for proxy status changes
    document.addEventListener('proxy-status-changed', async (e) => {
        await checkProxyStatus(); // Update PROXY_CONNECTED state
        updateFeatureGating();     // Re-apply feature gating
    });

    // Notify components that auth is ready
    document.dispatchEvent(new CustomEvent('auth-ready'));
});

// Listen for connection list changes (e.g., new auth from another tab)
chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.connections) {
        await refreshConnectionList();

        // Close auth-expired modal if open and we have a valid connection
        const overlays = document.querySelectorAll('.auth-expired-overlay');
        if (overlays.length > 0) {
            const connections = changes.connections.newValue || [];
            const validConn = connections.find(c => c.accessToken);
            if (validConn) {
                overlays.forEach(o => o.remove());
                await selectConnection(validConn);
            }
        }
    }
});

// --- Connection Management ---
async function initializeConnections() {
    // Migrate from old single-connection format if needed
    await migrateFromSingleConnection();
    // Migrate from global customConnectedApp to per-connection clientId
    await migrateCustomConnectedApp();

    const connections = await loadConnections();

    if (connections.length === 0) {
        showNoConnectionsState();
    } else {
        showConnectionDropdown(connections);
        // Auto-select most recently used
        const mostRecent = connections.reduce((a, b) =>
            a.lastUsedAt > b.lastUsedAt ? a : b
        );
        await selectConnection(mostRecent);
    }
}

async function refreshConnectionList() {
    const connections = await loadConnections();

    if (connections.length === 0) {
        showNoConnectionsState();
        setActiveConnection(null);
    } else {
        // If active connection was removed, select the most recent
        const activeId = getActiveConnectionId();
        const activeConnection = connections.find(c => c.id === activeId);
        if (!activeConnection) {
            const mostRecent = connections.reduce((a, b) =>
                a.lastUsedAt > b.lastUsedAt ? a : b
            );
            await selectConnection(mostRecent);
        } else {
            updateMobileConnections(connections);
            updateConnectionGating();
        }
    }
}

function showNoConnectionsState() {
    updateMobileConnections([]);
    updateConnectionGating();
    switchToSettingsTab();
}

function switchToSettingsTab() {
    const mobileNavItem = document.querySelector('.mobile-nav-item[data-tab="settings"]');
    if (mobileNavItem) {
        mobileNavItem.click();
    }
}

function showConnectionDropdown(connections) {
    updateMobileConnections(connections);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function selectConnection(connection) {
    setActiveConnection(connection);
    updateMobileConnections(await loadConnections());
    updateConnectionGating();

    // Update lastUsedAt
    await updateConnection(connection.id, {});

    // Notify components that connection changed
    document.dispatchEvent(new CustomEvent('connection-changed', { detail: connection }));
}

async function detectLoginDomain() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
            const urlObj = new URL(tab.url);
            if (urlObj.hostname.includes('.my.salesforce.com')) {
                detectedLoginDomain = urlObj.origin;
            } else if (urlObj.hostname.includes('.lightning.force.com')) {
                detectedLoginDomain = urlObj.origin.replace('.lightning.force.com', '.my.salesforce.com');
            } else if (urlObj.hostname.includes('.salesforce-setup.com')) {
                detectedLoginDomain = urlObj.origin.replace('.salesforce-setup.com', '.salesforce.com');
            }
        }
    } catch (e) {
        console.error('Error detecting domain:', e);
    }
}

/**
 * Start OAuth authorization flow
 * @param {string|null} overrideLoginDomain - Login domain to use (or detect from current tab)
 * @param {string|null} overrideClientId - Custom client ID to use (or use default)
 * @param {string|null} connectionId - Connection ID if re-authorizing an existing connection
 */
async function startAuthorization(overrideLoginDomain = null, overrideClientId = null, connectionId = null) {
    // Use provided domain or detect from current tab
    let loginDomain;
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
    } catch (e) {
        console.log('Proxy not available, using implicit flow');
    }

    // Get client ID - use override, or fall back to default
    let clientId;
    if (overrideClientId) {
        clientId = overrideClientId;
    } else {
        const credentials = await getOAuthCredentials();
        clientId = credentials.clientId;
    }

    // Store pending auth state for callback to use
    await setPendingAuth({
        loginDomain,
        clientId: overrideClientId, // Store only if custom (null means use default)
        connectionId // Set if re-authorizing existing connection
    });

    const responseType = useCodeFlow ? 'code' : 'token';
    const authUrl = `${loginDomain}/services/oauth2/authorize` +
        `?client_id=${clientId}` +
        `&response_type=${responseType}` +
        `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;

    chrome.tabs.create({ url: authUrl });
}

// Make startAuthorization available globally for Settings tab
window.startAuthorization = startAuthorization;

// --- Auth Expiration Handler ---
function initAuthExpirationHandler() {
    onAuthExpired(async (expiredConnectionId) => {
        // Prevent duplicate modals
        if (document.querySelector('.auth-expired-overlay')) return;

        const connections = await loadConnections();
        const expiredConnection = connections.find(c => c.id === expiredConnectionId);

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
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#reauth-btn').addEventListener('click', async () => {
            if (!expiredConnection) {
                console.error('Re-auth failed: expiredConnection is null');
                return;
            }
            // Use connection's loginDomain, clientId, and pass connectionId for re-auth
            await startAuthorization(
                expiredConnection.loginDomain || expiredConnection.instanceUrl,
                expiredConnection.clientId,
                expiredConnection.id
            );
        });

        overlay.querySelector('#delete-conn-btn').addEventListener('click', async () => {
            if (expiredConnectionId) {
                // Clear active connection first to prevent auth expiration trigger
                setActiveConnection(null);
                await removeConnection(expiredConnectionId);
            }
            overlay.remove();
        });
    });
}

// --- Feature Gating ---
function updateFeatureGating() {
    const eventsNavItem = document.querySelector('.mobile-nav-item[data-tab="events"]');
    const eventsContent = document.getElementById('events');

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
            overlay.querySelector('#feature-gate-settings-btn').addEventListener('click', () => {
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
function updateConnectionGating() {
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
function initTabs() {
    // No-op: hamburger menu is now the primary navigation
}

// --- Mobile Menu ---
function initMobileMenu() {
    const hamburgerBtn = document.querySelector('.hamburger-btn');
    const mobileMenu = document.querySelector('.mobile-menu');
    const mobileOverlay = document.querySelector('.mobile-menu-overlay');
    const closeBtn = mobileMenu.querySelector('.mobile-menu-close');
    const mobileNavItems = mobileMenu.querySelectorAll('.mobile-nav-item[data-tab]');
    const mobileOpenOrg = document.getElementById('mobile-open-org');
    const mobileOpenTab = document.getElementById('mobile-open-tab');
    const mobileAddConnection = mobileMenu.querySelector('.mobile-add-connection');
    const mobileConnectionList = mobileMenu.querySelector('.mobile-connection-list');

    function openMenu() {
        mobileMenu.classList.add('open');
        mobileOverlay.classList.add('open');
    }

    function closeMenu() {
        mobileMenu.classList.remove('open');
        mobileOverlay.classList.remove('open');
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
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

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
    mobileConnectionList.addEventListener('click', async (e) => {
        const item = e.target.closest('.mobile-connection-item');
        if (!item) return;

        const connectionId = item.dataset.id;

        // Handle remove button click
        if (e.target.closest('.mobile-connection-remove')) {
            e.stopPropagation();
            if (!confirm('Remove this connection?')) return;

            const wasActive = getActiveConnectionId() === connectionId;
            if (wasActive) {
                setActiveConnection(null);
            }

            await removeConnection(connectionId);
            const connections = await loadConnections();

            if (connections.length === 0) {
                showNoConnectionsState();
            } else {
                renderConnectionList(connections);
                if (wasActive) {
                    const mostRecent = connections.reduce((a, b) =>
                        a.lastUsedAt > b.lastUsedAt ? a : b
                    );
                    await selectConnection(mostRecent);
                }
            }
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

function updateMobileConnections(connections) {
    const mobileConnectionList = document.querySelector('.mobile-connection-list');
    const mobileAddConnection = document.querySelector('.mobile-add-connection');
    const activeId = getActiveConnectionId();

    if (connections.length === 0) {
        mobileConnectionList.innerHTML = '';
        mobileAddConnection.classList.add('hidden');
    } else {
        mobileConnectionList.innerHTML = connections.map(conn => `
            <div class="mobile-connection-item ${conn.id === activeId ? 'active' : ''}" data-id="${conn.id}">
                <span class="mobile-connection-name">${escapeHtml(conn.label)}</span>
                <button class="mobile-connection-remove" title="Remove">&times;</button>
            </div>
        `).join('');
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
