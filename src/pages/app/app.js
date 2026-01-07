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
    migrateFromSingleConnection
} from '../../lib/utils.js';
// Self-registering custom element tabs
import '../../components/query/query-tab.js';
import '../../components/apex/apex-tab.js';
import '../../components/rest-api/rest-api-tab.js';
import '../../components/events/events-tab.js';
import '../../components/settings/settings-tab.js';

// OAuth constants
const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;
const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// Cached login domain for authorization
let detectedLoginDomain = 'https://login.salesforce.com';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    initTabs();
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
    authorizeBtn.addEventListener('click', startAuthorization);

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
        const activeExists = connections.some(c => c.id === activeId);
        if (!activeExists) {
            const mostRecent = connections.reduce((a, b) =>
                a.lastUsedAt > b.lastUsedAt ? a : b
            );
            await selectConnection(mostRecent);
        } else {
            // Just update the UI
            renderConnectionList(connections);
        }
    }
}

function showAuthorizeButton() {
    const authorizeBtn = document.getElementById('authorize-btn');
    const dropdown = document.querySelector('.connection-dropdown');
    authorizeBtn.classList.remove('hidden');
    dropdown.classList.add('hidden');
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

    await removeConnection(connectionId);
    const connections = await loadConnections();

    if (connections.length === 0) {
        setActiveConnection(null);
        showAuthorizeButton();
    } else {
        renderConnectionList(connections);
        // If removed the active one, switch to another
        if (getActiveConnectionId() === connectionId) {
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

async function startAuthorization() {
    // Detect login domain from current tab at click time
    await detectLoginDomain();
    const loginDomain = detectedLoginDomain;

    // Check proxy for code flow
    let useCodeFlow = false;
    try {
        const proxyStatus = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
        useCodeFlow = proxyStatus.connected;
    } catch (e) {
        console.log('Proxy not available, using implicit flow');
    }

    // Store loginDomain before opening auth URL (needed by callback for token exchange)
    await chrome.storage.local.set({ loginDomain });

    const responseType = useCodeFlow ? 'code' : 'token';
    const authUrl = `${loginDomain}/services/oauth2/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=${responseType}` +
        `&redirect_uri=${encodeURIComponent(CALLBACK_URL)}`;

    chrome.tabs.create({ url: authUrl });
}

// --- Auth Expiration Handler ---
function initAuthExpirationHandler() {
    onAuthExpired(() => {
        // Show re-auth overlay
        const overlay = document.createElement('div');
        overlay.className = 'auth-expired-overlay';
        overlay.innerHTML = `
            <div class="auth-expired-modal">
                <h2>Session Expired</h2>
                <p>Your Salesforce session has expired and could not be refreshed.</p>
                <p>Please re-authorize to continue.</p>
                <button id="reauth-btn" class="button-brand">Close and Re-authorize</button>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('reauth-btn').addEventListener('click', () => {
            window.close();
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
