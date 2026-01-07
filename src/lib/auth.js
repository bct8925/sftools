// Frontend Auth Module for sftools
// Used by content scripts (app.js, etc.) - NOT the service worker

// --- Constants ---
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    INSTANCE_URL: 'instanceUrl',
    LOGIN_DOMAIN: 'loginDomain'
};

export const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// --- Frontend Auth State ---
// These are used by content scripts to access tokens without async calls
// Each sftools instance (browser tab/sidepanel) has its own isolated module state

let ACCESS_TOKEN = '';
let INSTANCE_URL = '';
let ACTIVE_CONNECTION_ID = null;
let authExpiredCallback = null;

export function getAccessToken() {
    return ACCESS_TOKEN;
}

export function getInstanceUrl() {
    return INSTANCE_URL;
}

export function isAuthenticated() {
    return ACCESS_TOKEN && INSTANCE_URL;
}

/**
 * Register a callback to be called when auth expires
 * @param {Function} callback - Function to call when auth expires
 */
export function onAuthExpired(callback) {
    authExpiredCallback = callback;
}

/**
 * Trigger auth expiration callback and clear local state
 * Called when authExpired message is received or extensionFetch returns authExpired
 */
export function triggerAuthExpired() {
    ACCESS_TOKEN = '';
    INSTANCE_URL = '';
    if (authExpiredCallback) {
        authExpiredCallback();
    }
}

/**
 * Load auth tokens from storage into module state (legacy - for backward compatibility)
 * @returns {Promise<boolean>} - Whether tokens were loaded successfully
 * @deprecated Use loadConnections() and setActiveConnection() instead
 */
export function loadAuthTokens() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.INSTANCE_URL], function(data) {
                if (data[STORAGE_KEYS.ACCESS_TOKEN] && data[STORAGE_KEYS.INSTANCE_URL]) {
                    ACCESS_TOKEN = data[STORAGE_KEYS.ACCESS_TOKEN];
                    INSTANCE_URL = data[STORAGE_KEYS.INSTANCE_URL];
                    console.log('Loaded auth for instance:', INSTANCE_URL);
                    resolve(true);
                } else {
                    console.log('No auth tokens found. Please authorize via connection selector.');
                    resolve(false);
                }
            });
        } else {
            resolve(false);
        }
    });
}

// --- Multi-Connection Storage Functions ---

/**
 * Get the active connection ID for this sftools instance
 */
export function getActiveConnectionId() {
    return ACTIVE_CONNECTION_ID;
}

/**
 * Set the active connection for this sftools instance
 * Updates module-level ACCESS_TOKEN and INSTANCE_URL
 */
export function setActiveConnection(connection) {
    if (connection) {
        ACCESS_TOKEN = connection.accessToken;
        INSTANCE_URL = connection.instanceUrl;
        ACTIVE_CONNECTION_ID = connection.id;
    } else {
        ACCESS_TOKEN = '';
        INSTANCE_URL = '';
        ACTIVE_CONNECTION_ID = null;
    }
}

/**
 * Load all saved connections from storage
 * @returns {Promise<Array>} - Array of connection objects
 */
export async function loadConnections() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['connections'], (data) => {
                resolve(data.connections || []);
            });
        } else {
            resolve([]);
        }
    });
}

/**
 * Save connections array to storage
 */
export async function saveConnections(connections) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ connections });
    }
}

/**
 * Add a new connection to storage
 * @returns {Promise<object>} - The new connection object with generated ID
 */
export async function addConnection(connectionData) {
    const connections = await loadConnections();
    const newConnection = {
        id: crypto.randomUUID(),
        label: new URL(connectionData.instanceUrl).hostname,
        instanceUrl: connectionData.instanceUrl,
        loginDomain: connectionData.loginDomain || 'https://login.salesforce.com',
        accessToken: connectionData.accessToken,
        refreshToken: connectionData.refreshToken || null,
        createdAt: Date.now(),
        lastUsedAt: Date.now()
    };
    connections.push(newConnection);
    await saveConnections(connections);
    return newConnection;
}

/**
 * Update an existing connection
 */
export async function updateConnection(connectionId, updates) {
    const connections = await loadConnections();
    const index = connections.findIndex(c => c.id === connectionId);
    if (index !== -1) {
        connections[index] = { ...connections[index], ...updates, lastUsedAt: Date.now() };
        await saveConnections(connections);
        return connections[index];
    }
    return null;
}

/**
 * Remove a connection from storage
 */
export async function removeConnection(connectionId) {
    const connections = await loadConnections();
    const filtered = connections.filter(c => c.id !== connectionId);
    await saveConnections(filtered);
}

/**
 * Find a connection by its instance URL
 */
export async function findConnectionByInstance(instanceUrl) {
    const connections = await loadConnections();
    return connections.find(c => c.instanceUrl === instanceUrl);
}

/**
 * Migrate from single-connection storage to multi-connection format
 * Should be called once on app initialization
 */
export async function migrateFromSingleConnection() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get([
                'connections',
                STORAGE_KEYS.ACCESS_TOKEN,
                STORAGE_KEYS.INSTANCE_URL,
                STORAGE_KEYS.REFRESH_TOKEN,
                STORAGE_KEYS.LOGIN_DOMAIN
            ], async (data) => {
                // Already migrated or fresh install
                if (data.connections !== undefined) {
                    resolve(false);
                    return;
                }

                // No existing auth to migrate
                if (!data[STORAGE_KEYS.ACCESS_TOKEN] || !data[STORAGE_KEYS.INSTANCE_URL]) {
                    await chrome.storage.local.set({ connections: [] });
                    resolve(false);
                    return;
                }

                // Migrate single connection to array
                const connection = {
                    id: crypto.randomUUID(),
                    label: new URL(data[STORAGE_KEYS.INSTANCE_URL]).hostname,
                    instanceUrl: data[STORAGE_KEYS.INSTANCE_URL],
                    loginDomain: data[STORAGE_KEYS.LOGIN_DOMAIN] || 'https://login.salesforce.com',
                    accessToken: data[STORAGE_KEYS.ACCESS_TOKEN],
                    refreshToken: data[STORAGE_KEYS.REFRESH_TOKEN] || null,
                    createdAt: Date.now(),
                    lastUsedAt: Date.now()
                };

                await chrome.storage.local.set({ connections: [connection] });

                // Clean up old keys
                await chrome.storage.local.remove([
                    STORAGE_KEYS.ACCESS_TOKEN,
                    STORAGE_KEYS.REFRESH_TOKEN,
                    STORAGE_KEYS.INSTANCE_URL,
                    STORAGE_KEYS.LOGIN_DOMAIN
                ]);

                console.log('Migrated single connection to multi-connection format');
                resolve(true);
            });
        } else {
            resolve(false);
        }
    });
}

// --- Custom Connected App ---

/**
 * Get OAuth credentials (custom app if configured, otherwise manifest default)
 * @returns {Promise<{clientId: string, isCustom: boolean}>}
 */
export async function getOAuthCredentials() {
    const { customConnectedApp } = await chrome.storage.local.get(['customConnectedApp']);

    if (customConnectedApp?.enabled && customConnectedApp.clientId) {
        return { clientId: customConnectedApp.clientId, isCustom: true };
    }

    return { clientId: chrome.runtime.getManifest().oauth2.client_id, isCustom: false };
}

/**
 * Load custom connected app config from storage
 * @returns {Promise<{enabled: boolean, clientId: string}|null>}
 */
export async function loadCustomConnectedApp() {
    const { customConnectedApp } = await chrome.storage.local.get(['customConnectedApp']);
    return customConnectedApp || null;
}

/**
 * Save custom connected app config to storage
 * @param {{enabled: boolean, clientId: string}} config
 */
export async function saveCustomConnectedApp(config) {
    await chrome.storage.local.set({ customConnectedApp: config });
}

/**
 * Clear custom connected app config (revert to default)
 */
export async function clearCustomConnectedApp() {
    await chrome.storage.local.remove(['customConnectedApp']);
}

// Listen for auth expiration broadcasts from background
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'authExpired') {
            triggerAuthExpired();
        }
    });
}

// Listen for storage changes (e.g., token refresh from background)
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        // Handle multi-connection format
        if (changes.connections?.newValue && ACTIVE_CONNECTION_ID) {
            const updatedConnections = changes.connections.newValue;
            const activeConn = updatedConnections.find(c => c.id === ACTIVE_CONNECTION_ID);
            if (activeConn) {
                // Update in-memory tokens if active connection was refreshed
                ACCESS_TOKEN = activeConn.accessToken;
                INSTANCE_URL = activeConn.instanceUrl;
                console.log('Active connection tokens updated from storage');
            } else {
                // Active connection was removed
                triggerAuthExpired();
            }
        }

        // Legacy single-connection format (for backward compatibility during migration)
        if (changes[STORAGE_KEYS.ACCESS_TOKEN]?.newValue) {
            ACCESS_TOKEN = changes[STORAGE_KEYS.ACCESS_TOKEN].newValue;
            console.log('Access token updated from storage (legacy)');
        }

        if (changes[STORAGE_KEYS.INSTANCE_URL]?.newValue) {
            INSTANCE_URL = changes[STORAGE_KEYS.INSTANCE_URL].newValue;
        }
    });
}
