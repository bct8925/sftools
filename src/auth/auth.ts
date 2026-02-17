// Frontend Auth Module for sftools
// Used by content scripts (app.js, etc.) - NOT the service worker

import type { SalesforceConnection } from '../types/salesforce';
import { debugInfo } from '../lib/debug';
import { isExpired } from '../lib/date-utils';

// --- Types ---

export interface StorageKeys {
    ACCESS_TOKEN: string;
    REFRESH_TOKEN: string;
    INSTANCE_URL: string;
    LOGIN_DOMAIN: string;
}

export interface PendingAuth {
    loginDomain: string;
    clientId: string | null;
    connectionId: string | null;
    state: string;
    createdAt?: number;
}

export interface OAuthValidationResult {
    valid: boolean;
    pendingAuth: PendingAuth | null;
}

export interface CustomConnectedApp {
    enabled: boolean;
    clientId: string;
}

export type ConnectionData = Partial<SalesforceConnection> & {
    instanceUrl: string;
    accessToken: string;
    username?: string;
};

type AuthExpiredCallback = (connectionId: string | null, error?: string) => void;

// --- Constants ---
export const STORAGE_KEYS: StorageKeys = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    INSTANCE_URL: 'instanceUrl',
    LOGIN_DOMAIN: 'loginDomain',
};

export const CALLBACK_URL = 'https://sftools.dev/callback';

// --- Frontend Auth State ---
// These are used by content scripts to access tokens without async calls
// Each sftools instance (browser tab/sidepanel) has its own isolated module state

let ACCESS_TOKEN = '';
let INSTANCE_URL = '';
let ACTIVE_CONNECTION_ID: string | null = null;
let authExpiredCallback: AuthExpiredCallback | null = null;

export function getAccessToken(): string {
    return ACCESS_TOKEN;
}

export function getInstanceUrl(): string {
    return INSTANCE_URL;
}

export function isAuthenticated(): boolean {
    return !!(ACCESS_TOKEN && INSTANCE_URL);
}

/**
 * Register a callback to be called when auth expires
 */
export function onAuthExpired(callback: AuthExpiredCallback): void {
    authExpiredCallback = callback;
}

/**
 * Trigger auth expiration callback
 * Called when authExpired message is received or extensionFetch returns authExpired
 */
export function triggerAuthExpired(connectionId?: string, error?: string): void {
    const expiredConnectionId = connectionId || ACTIVE_CONNECTION_ID;
    if (authExpiredCallback) {
        authExpiredCallback(expiredConnectionId, error);
    }
}

/**
 * Load auth tokens from storage into module state (legacy - for backward compatibility)
 * @deprecated Use loadConnections() and setActiveConnection() instead
 */
export function loadAuthTokens(): Promise<boolean> {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(
                [STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.INSTANCE_URL],
                data => {
                    if (data[STORAGE_KEYS.ACCESS_TOKEN] && data[STORAGE_KEYS.INSTANCE_URL]) {
                        ACCESS_TOKEN = data[STORAGE_KEYS.ACCESS_TOKEN] as string;
                        INSTANCE_URL = data[STORAGE_KEYS.INSTANCE_URL] as string;
                        debugInfo('Loaded auth for instance:', INSTANCE_URL);
                        resolve(true);
                    } else {
                        debugInfo('No auth tokens found');
                        resolve(false);
                    }
                }
            );
        } else {
            resolve(false);
        }
    });
}

// --- Multi-Connection Storage Functions ---

/**
 * Get the active connection ID for this sftools instance
 */
export function getActiveConnectionId(): string | null {
    return ACTIVE_CONNECTION_ID;
}

/**
 * Set the active connection for this sftools instance
 * Updates module-level ACCESS_TOKEN and INSTANCE_URL
 */
export function setActiveConnection(connection: SalesforceConnection | null): void {
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
 */
export function loadConnections(): Promise<SalesforceConnection[]> {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['connections'], data => {
                resolve((data.connections as SalesforceConnection[]) || []);
            });
        } else {
            resolve([]);
        }
    });
}

/**
 * Save connections array to storage
 */
export async function saveConnections(connections: SalesforceConnection[]): Promise<void> {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ connections });
    }
}

/**
 * Add a new connection to storage
 */
export async function addConnection(connectionData: ConnectionData): Promise<SalesforceConnection> {
    const connections = await loadConnections();

    // Use provided label, or username if available, otherwise fall back to hostname
    let defaultLabel = new URL(connectionData.instanceUrl).hostname;
    if (connectionData.username) {
        defaultLabel = connectionData.username;
    }

    const newConnection: SalesforceConnection = {
        id: crypto.randomUUID(),
        label: connectionData.label || defaultLabel,
        instanceUrl: connectionData.instanceUrl,
        loginDomain: connectionData.loginDomain || 'https://login.salesforce.com',
        accessToken: connectionData.accessToken,
        refreshToken: connectionData.refreshToken || null,
        clientId: connectionData.clientId || null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    };
    connections.push(newConnection);
    await saveConnections(connections);
    return newConnection;
}

/**
 * Update an existing connection
 */
export async function updateConnection(
    connectionId: string,
    updates: Partial<SalesforceConnection>
): Promise<SalesforceConnection | null> {
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
 * Also cleans up the connection's describe cache
 */
export async function removeConnection(connectionId: string): Promise<void> {
    const connections = await loadConnections();
    const filtered = connections.filter(c => c.id !== connectionId);
    await saveConnections(filtered);

    // Clean up the connection's describe cache
    await chrome.storage.local.remove(`describeCache_${connectionId}`);
}

/**
 * Find a connection by its instance URL
 */
export async function findConnectionByInstance(
    instanceUrl: string
): Promise<SalesforceConnection | undefined> {
    const connections = await loadConnections();
    return connections.find(c => c.instanceUrl === instanceUrl);
}

/**
 * Migrate from single-connection storage to multi-connection format
 * Should be called once on app initialization
 */
export function migrateFromSingleConnection(): Promise<boolean> {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(
                [
                    'connections',
                    STORAGE_KEYS.ACCESS_TOKEN,
                    STORAGE_KEYS.INSTANCE_URL,
                    STORAGE_KEYS.REFRESH_TOKEN,
                    STORAGE_KEYS.LOGIN_DOMAIN,
                ],
                async data => {
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
                    const connection: SalesforceConnection = {
                        id: crypto.randomUUID(),
                        label: new URL(data[STORAGE_KEYS.INSTANCE_URL] as string).hostname,
                        instanceUrl: data[STORAGE_KEYS.INSTANCE_URL] as string,
                        loginDomain:
                            (data[STORAGE_KEYS.LOGIN_DOMAIN] as string) ||
                            'https://login.salesforce.com',
                        accessToken: data[STORAGE_KEYS.ACCESS_TOKEN] as string,
                        refreshToken: (data[STORAGE_KEYS.REFRESH_TOKEN] as string) || null,
                        clientId: null,
                        createdAt: Date.now(),
                        lastUsedAt: Date.now(),
                    };

                    await chrome.storage.local.set({ connections: [connection] });

                    // Clean up old keys
                    await chrome.storage.local.remove([
                        STORAGE_KEYS.ACCESS_TOKEN,
                        STORAGE_KEYS.REFRESH_TOKEN,
                        STORAGE_KEYS.INSTANCE_URL,
                        STORAGE_KEYS.LOGIN_DOMAIN,
                    ]);

                    debugInfo('Migrated single connection to multi-connection format');
                    resolve(true);
                }
            );
        } else {
            resolve(false);
        }
    });
}

// --- Pending Auth State (with CSRF protection) ---

/**
 * Generate a cryptographically random state parameter for OAuth CSRF protection
 */
export function generateOAuthState(): string {
    return crypto.randomUUID();
}

/**
 * Store pending authorization parameters before OAuth redirect
 */
export async function setPendingAuth(params: Omit<PendingAuth, 'createdAt'>): Promise<void> {
    // Add timestamp for expiration checking
    await chrome.storage.local.set({
        pendingAuth: { ...params, createdAt: Date.now() },
    });
}

/**
 * Get and clear pending authorization parameters
 * Checks expiration (5 minute timeout) to prevent stale state attacks
 */
export async function consumePendingAuth(): Promise<PendingAuth | null> {
    const { pendingAuth } = (await chrome.storage.local.get(['pendingAuth'])) as {
        pendingAuth?: PendingAuth;
    };
    await chrome.storage.local.remove(['pendingAuth']);

    if (!pendingAuth) return null;

    // Expire after 5 minutes
    if (pendingAuth.createdAt && isExpired(pendingAuth.createdAt, 5)) {
        debugInfo('OAuth pending auth expired');
        return null;
    }

    return pendingAuth;
}

/**
 * Validate OAuth state parameter matches the pending auth state
 */
export async function validateOAuthState(receivedState: string): Promise<OAuthValidationResult> {
    const { pendingAuth } = (await chrome.storage.local.get(['pendingAuth'])) as {
        pendingAuth?: PendingAuth;
    };

    if (!pendingAuth?.state) {
        return { valid: false, pendingAuth: null };
    }

    // Check expiration
    if (pendingAuth.createdAt && isExpired(pendingAuth.createdAt, 5)) {
        await chrome.storage.local.remove(['pendingAuth']);
        return { valid: false, pendingAuth: null };
    }

    if (pendingAuth.state !== receivedState) {
        return { valid: false, pendingAuth: null };
    }

    // State is valid - clear it and return pending auth
    await chrome.storage.local.remove(['pendingAuth']);
    return { valid: true, pendingAuth };
}

// --- OAuth Credentials ---

// Re-export OAuth credentials helper (shared with service worker)
export { getOAuthCredentials } from './oauth-credentials';

/**
 * Load custom connected app config from storage
 * @deprecated Use per-connection clientId instead
 */
export async function loadCustomConnectedApp(): Promise<CustomConnectedApp | null> {
    const { customConnectedApp } = (await chrome.storage.local.get(['customConnectedApp'])) as {
        customConnectedApp?: CustomConnectedApp;
    };
    return customConnectedApp || null;
}

/**
 * Save custom connected app config to storage
 * @deprecated Use per-connection clientId instead
 */
export async function saveCustomConnectedApp(config: CustomConnectedApp): Promise<void> {
    await chrome.storage.local.set({ customConnectedApp: config });
}

/**
 * Clear custom connected app config (revert to default)
 * @deprecated Use per-connection clientId instead
 */
export async function clearCustomConnectedApp(): Promise<void> {
    await chrome.storage.local.remove(['customConnectedApp']);
}

/**
 * Migrate from global customConnectedApp to per-connection clientId
 * Should be called once during app initialization (after migrateFromSingleConnection)
 */
export function migrateCustomConnectedApp(): Promise<boolean> {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(
                ['customConnectedApp', 'connections', 'customAppMigrated'],
                async data => {
                    // Already migrated or no custom app to migrate
                    const customApp = data.customConnectedApp as CustomConnectedApp | undefined;
                    if (data.customAppMigrated || !customApp?.enabled) {
                        resolve(false);
                        return;
                    }

                    const customClientId = customApp.clientId;
                    const connections = (data.connections as SalesforceConnection[]) || [];

                    if (connections.length > 0 && customClientId) {
                        // Apply custom clientId to all existing connections that don't have one
                        const updatedConnections = connections.map(conn => ({
                            ...conn,
                            clientId: conn.clientId || customClientId,
                        }));

                        await chrome.storage.local.set({
                            connections: updatedConnections,
                            customAppMigrated: true,
                        });

                        debugInfo('Migrated global customConnectedApp to per-connection clientIds');
                    }

                    // Remove deprecated customConnectedApp
                    await chrome.storage.local.remove(['customConnectedApp']);

                    resolve(true);
                }
            );
        } else {
            resolve(false);
        }
    });
}

// Listen for auth expiration broadcasts from background
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message: { type: string }) => {
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
            const updatedConnections = changes.connections.newValue as SalesforceConnection[];
            const activeConn = updatedConnections.find(c => c.id === ACTIVE_CONNECTION_ID);
            if (activeConn) {
                // Update in-memory tokens if active connection was refreshed
                ACCESS_TOKEN = activeConn.accessToken;
                INSTANCE_URL = activeConn.instanceUrl;
            } else {
                // Active connection was removed
                triggerAuthExpired();
            }
        }

        // Legacy single-connection format (for backward compatibility during migration)
        if (changes[STORAGE_KEYS.ACCESS_TOKEN]?.newValue) {
            ACCESS_TOKEN = changes[STORAGE_KEYS.ACCESS_TOKEN].newValue as string;
            debugInfo('Access token updated from storage (legacy)');
        }

        if (changes[STORAGE_KEYS.INSTANCE_URL]?.newValue) {
            INSTANCE_URL = changes[STORAGE_KEYS.INSTANCE_URL].newValue as string;
        }
    });
}
