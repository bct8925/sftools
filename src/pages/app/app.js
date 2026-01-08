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

// OAuth constants
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// Cached login domain for authorization
let detectedLoginDomain = 'https://login.salesforce.com';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initMobileMenu();
    initOpenOrgButton();
    initOpenInTabButton();
    initAuthExpirationHandler();
    initConnectionSelector();

    await checkProxyStatus();
    await initializeConnections();

    // Apply feature gating based on proxy status
    updateFeatureGating();

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

// --- Connection Selector ---
function initConnectionSelector() {
    const authorizeBtn = document.getElementById('authorize-btn');
    const dropdown = document.querySelector('.connection-dropdown');
    const trigger = dropdown.querySelector('.connection-dropdown-trigger');
    const addBtn = dropdown.querySelector('.connection-add-btn');
    const connectionList = dropdown.querySelector('.connection-list');

    // Authorize button (shown when no connections)
    authorizeBtn.addEventListener('click', () => startAuthorization());

    // Add connection button in dropdown
    addBtn.addEventListener('click', () => {
        dropdown.classList.remove('open');
        startAuthorization();
    });

    // Dropdown toggle
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => dropdown.classList.remove('open'));

    // Delegate clicks on connection list
    connectionList.addEventListener('click', async (e) => {
        const item = e.target.closest('.connection-item');
        if (!item) return;

        if (e.target.closest('.connection-remove')) {
            e.stopPropagation();
            await handleRemoveConnection(item.dataset.id);
        } else {
            await handleSelectConnection(item.dataset.id);
            dropdown.classList.remove('open');
        }
    });
}

async function initializeConnections() {
    // Migrate from old single-connection format if needed
    await migrateFromSingleConnection();
    // Migrate from global customConnectedApp to per-connection clientId
    await migrateCustomConnectedApp();

    const connections = await loadConnections();

    if (connections.length === 0) {
        showAuthorizeButton();
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
        showAuthorizeButton();
        setActiveConnection(null);
    } else {
        showConnectionDropdown(connections);

        // If active connection was removed, select the most recent
        const activeId = getActiveConnectionId();
        const activeConnection = connections.find(c => c.id === activeId);
        if (!activeConnection) {
            const mostRecent = connections.reduce((a, b) =>
                a.lastUsedAt > b.lastUsedAt ? a : b
            );
            await selectConnection(mostRecent);
        } else {
            // Update the UI and refresh the header label (in case label was edited)
            renderConnectionList(connections);
            updateConnectionLabel(activeConnection.label);
        }
    }
}

function showAuthorizeButton() {
    const authorizeBtn = document.getElementById('authorize-btn');
    const dropdown = document.querySelector('.connection-dropdown');
    authorizeBtn.classList.remove('hidden');
    dropdown.classList.add('hidden');

    // Sync mobile menu state
    updateMobileConnections([]);
}

function showConnectionDropdown(connections) {
    const authorizeBtn = document.getElementById('authorize-btn');
    const dropdown = document.querySelector('.connection-dropdown');
    authorizeBtn.classList.add('hidden');
    dropdown.classList.remove('hidden');
    renderConnectionList(connections);
}

function renderConnectionList(connections) {
    const list = document.querySelector('.connection-list');
    const activeId = getActiveConnectionId();

    list.innerHTML = connections.map(conn => `
        <div class="connection-item ${conn.id === activeId ? 'active' : ''}" data-id="${conn.id}">
            <span class="connection-name">${escapeHtml(conn.label)}</span>
            <button class="connection-remove" title="Remove">&times;</button>
        </div>
    `).join('');

    // Also update mobile menu connections
    updateMobileConnections(connections);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function selectConnection(connection) {
    setActiveConnection(connection);
    updateConnectionLabel(connection.label);
    renderConnectionList(await loadConnections());

    // Update lastUsedAt
    await updateConnection(connection.id, {});

    // Notify components that connection changed
    document.dispatchEvent(new CustomEvent('connection-changed', { detail: connection }));
}

function updateConnectionLabel(label) {
    const labelEl = document.querySelector('.connection-label');
    labelEl.textContent = label;
}

async function handleSelectConnection(connectionId) {
    const connections = await loadConnections();
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
        await selectConnection(connection);
    }
}

async function handleRemoveConnection(connectionId) {
    if (!confirm('Remove this connection?')) return;

    // Clear active connection first to prevent auth expiration trigger
    const wasActive = getActiveConnectionId() === connectionId;
    if (wasActive) {
        setActiveConnection(null);
    }

    await removeConnection(connectionId);
    const connections = await loadConnections();

    if (connections.length === 0) {
        showAuthorizeButton();
    } else {
        renderConnectionList(connections);
        // If removed the active one, switch to another
        if (wasActive) {
            const mostRecent = connections.reduce((a, b) =>
                a.lastUsedAt > b.lastUsedAt ? a : b
            );
            await selectConnection(mostRecent);
        }
    }
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
    const eventsTab = document.querySelector('.tab-link[data-tab="events"]');
    const eventsContent = document.getElementById('events');

    if (!isProxyConnected()) {
        // Disable the events tab
        eventsTab.classList.add('tab-disabled');
        eventsContent.classList.add('feature-disabled');

        // Add overlay with message
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
            const settingsTab = document.querySelector('.tab-link[data-tab="settings"]');
            if (settingsTab) {
                settingsTab.click();
            }
        });

        // Prevent tab switching to disabled tab
        eventsTab.addEventListener('click', (e) => {
            if (eventsTab.classList.contains('tab-disabled')) {
                e.stopPropagation();
                e.preventDefault();
            }
        }, true);
    }
}

// --- Open Org Button ---
function initOpenOrgButton() {
    const btn = document.getElementById('open-org-btn');
    btn.addEventListener('click', () => {
        if (!isAuthenticated()) {
            // If not authenticated, start authorization instead
            startAuthorization();
            return;
        }
        const instanceUrl = getInstanceUrl();
        const accessToken = getAccessToken();
        const frontdoorUrl = `${instanceUrl}/secur/frontdoor.jsp?sid=${encodeURIComponent(accessToken)}`;
        window.open(frontdoorUrl, '_blank');
    });
}

// --- Open in Tab Button ---
function initOpenInTabButton() {
    const btn = document.getElementById('open-in-tab-btn');
    btn.addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('dist/pages/app/app.html') });
    });
}

// --- Tab Navigation ---
function initTabs() {
    const container = document.querySelector('.tab-scroll-container');
    const tabs = container.querySelectorAll('.tab-link[data-tab]');
    const contents = document.querySelectorAll('.tab-content');
    const dropdown = container.querySelector('.nav-overflow-dropdown');
    const trigger = dropdown.querySelector('.nav-overflow-trigger');
    const menu = dropdown.querySelector('.nav-overflow-menu');

    // Tab click handler (works for both nav and dropdown items)
    function handleTabClick(tab) {
        const targetId = tab.getAttribute('data-tab');

        // Update all tabs (nav + dropdown clones)
        container.querySelectorAll('.tab-link[data-tab]').forEach(t => t.classList.remove('active'));
        menu.querySelectorAll('.tab-link[data-tab]').forEach(t => t.classList.remove('active'));

        // Activate clicked tab and its clone if exists
        container.querySelectorAll(`.tab-link[data-tab="${targetId}"]`).forEach(t => t.classList.add('active'));

        contents.forEach(c => c.classList.remove('active'));
        const targetContent = document.getElementById(targetId);
        if (targetContent) {
            targetContent.classList.add('active');
        }

        // Close dropdown
        dropdown.classList.remove('open');
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => handleTabClick(tab));
    });

    // Dropdown toggle
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('open');

        // Position menu below trigger
        if (dropdown.classList.contains('open')) {
            const rect = trigger.getBoundingClientRect();
            menu.style.left = rect.left + 'px';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        dropdown.classList.remove('open');
    });

    // Overflow detection
    function updateOverflow() {
        // Reset all tabs to visible first to measure true widths
        tabs.forEach(tab => tab.classList.remove('nav-hidden'));
        dropdown.classList.add('hidden');
        menu.innerHTML = '';

        // Use container's actual width
        const containerWidth = container.offsetWidth;
        const dropdownWidth = 85; // Width of "More" button

        // Measure tab widths
        let totalWidth = 0;
        const tabWidths = [];
        tabs.forEach(tab => {
            const width = tab.offsetWidth + 5; // include margin
            tabWidths.push(width);
            totalWidth += width;
        });

        // Check if all tabs fit
        if (totalWidth <= containerWidth) {
            return; // All tabs fit, no overflow needed
        }

        // Find how many tabs fit (leaving room for dropdown)
        let usedWidth = 0;
        let fitCount = 0;
        for (let i = 0; i < tabs.length; i++) {
            if (usedWidth + tabWidths[i] + dropdownWidth <= containerWidth) {
                usedWidth += tabWidths[i];
                fitCount++;
            } else {
                break;
            }
        }

        // At least show the dropdown if nothing fits
        if (fitCount === tabs.length) {
            return; // All fit after all
        }

        // Hide overflowing tabs and show dropdown
        dropdown.classList.remove('hidden');

        for (let i = fitCount; i < tabs.length; i++) {
            const tab = tabs[i];
            tab.classList.add('nav-hidden');

            // Create dropdown item
            const clone = document.createElement('button');
            clone.className = 'tab-link';
            clone.setAttribute('data-tab', tab.getAttribute('data-tab'));
            clone.textContent = tab.textContent;
            if (tab.classList.contains('active')) {
                clone.classList.add('active');
            }
            clone.addEventListener('click', () => handleTabClick(clone));
            menu.appendChild(clone);
        }
    }

    // Run on load and resize (with debounce for resize)
    let resizeTimeout;
    function handleResize() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateOverflow, 50);
    }

    // Initial run after layout settles
    requestAnimationFrame(() => {
        requestAnimationFrame(updateOverflow);
    });
    window.addEventListener('resize', handleResize);
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
    const mobileAuthorize = mobileMenu.querySelector('.mobile-authorize');
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
            const targetId = item.getAttribute('data-tab');
            const contents = document.querySelectorAll('.tab-content');
            const navTabs = document.querySelectorAll('.tab-scroll-container .tab-link[data-tab]');

            // Update mobile nav active state
            mobileNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update desktop nav active state
            navTabs.forEach(tab => tab.classList.remove('active'));
            const matchingTab = document.querySelector(`.tab-scroll-container .tab-link[data-tab="${targetId}"]`);
            if (matchingTab) matchingTab.classList.add('active');

            // Switch content
            contents.forEach(c => c.classList.remove('active'));
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

            closeMenu();
        });
    });

    // Open Org button
    mobileOpenOrg.addEventListener('click', () => {
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

    // Add Connection button
    mobileAddConnection.addEventListener('click', () => {
        startAuthorization();
        closeMenu();
    });

    // Authorize button (shown when no connections)
    mobileAuthorize.addEventListener('click', () => {
        startAuthorization();
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
                showAuthorizeButton();
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
    const mobileAuthorize = document.querySelector('.mobile-authorize');
    const activeId = getActiveConnectionId();

    if (connections.length === 0) {
        mobileConnectionList.innerHTML = '';
        mobileAddConnection.classList.add('hidden');
        mobileAuthorize.classList.remove('hidden');
    } else {
        mobileConnectionList.innerHTML = connections.map(conn => `
            <div class="mobile-connection-item ${conn.id === activeId ? 'active' : ''}" data-id="${conn.id}">
                <span class="mobile-connection-name">${escapeHtml(conn.label)}</span>
                <button class="mobile-connection-remove" title="Remove">&times;</button>
            </div>
        `).join('');
        mobileAddConnection.classList.remove('hidden');
        mobileAuthorize.classList.add('hidden');
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
