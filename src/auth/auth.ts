// Frontend Auth Module for sftools
// Used by content scripts (app.js, etc.) - NOT the service worker

import type { SalesforceConnection } from '../types/salesforce';
import { debugInfo } from '../lib/debug';
import { isExpired } from '../lib/date-utils';
import { getPlatform, storage } from '../platform';

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
export async function loadAuthTokens(): Promise<boolean> {
    const data = await storage.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.INSTANCE_URL]);
    if (data[STORAGE_KEYS.ACCESS_TOKEN] && data[STORAGE_KEYS.INSTANCE_URL]) {
        ACCESS_TOKEN = data[STORAGE_KEYS.ACCESS_TOKEN] as string;
        INSTANCE_URL = data[STORAGE_KEYS.INSTANCE_URL] as string;
        debugInfo('Loaded auth for instance:', INSTANCE_URL);
        return true;
    }
    debugInfo('No auth tokens found');
    return false;
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
export async function loadConnections(): Promise<SalesforceConnection[]> {
    const data = await storage.get(['connections']);
    return (data.connections as SalesforceConnection[]) || [];
}

/**
 * Save connections array to storage
 */
export async function saveConnections(connections: SalesforceConnection[]): Promise<void> {
    await storage.set({ connections });
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
    await storage.remove(`describeCache_${connectionId}`);
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
export async function migrateFromSingleConnection(): Promise<boolean> {
    // Connections in VS Code come from the sf CLI; there is nothing to migrate
    if (!getPlatform().capabilities.manageConnections) return false;

    const data = await storage.get([
        'connections',
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.INSTANCE_URL,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.LOGIN_DOMAIN,
    ]);

    // Already migrated or fresh install
    if (data.connections !== undefined) {
        return false;
    }

    // No existing auth to migrate
    if (!data[STORAGE_KEYS.ACCESS_TOKEN] || !data[STORAGE_KEYS.INSTANCE_URL]) {
        await storage.set({ connections: [] });
        return false;
    }

    // Migrate single connection to array
    const connection: SalesforceConnection = {
        id: crypto.randomUUID(),
        label: new URL(data[STORAGE_KEYS.INSTANCE_URL] as string).hostname,
        instanceUrl: data[STORAGE_KEYS.INSTANCE_URL] as string,
        loginDomain: (data[STORAGE_KEYS.LOGIN_DOMAIN] as string) || 'https://login.salesforce.com',
        accessToken: data[STORAGE_KEYS.ACCESS_TOKEN] as string,
        refreshToken: (data[STORAGE_KEYS.REFRESH_TOKEN] as string) || null,
        clientId: null,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
    };

    await storage.set({ connections: [connection] });

    // Clean up old keys
    await storage.remove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.INSTANCE_URL,
        STORAGE_KEYS.LOGIN_DOMAIN,
    ]);

    debugInfo('Migrated single connection to multi-connection format');
    return true;
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
    await storage.set({
        pendingAuth: { ...params, createdAt: Date.now() },
    });
}

/**
 * Get and clear pending authorization parameters
 * Checks expiration (5 minute timeout) to prevent stale state attacks
 */
export async function consumePendingAuth(): Promise<PendingAuth | null> {
    const { pendingAuth } = (await storage.get(['pendingAuth'])) as {
        pendingAuth?: PendingAuth;
    };
    await storage.remove(['pendingAuth']);

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
    const { pendingAuth } = (await storage.get(['pendingAuth'])) as {
        pendingAuth?: PendingAuth;
    };

    if (!pendingAuth?.state) {
        return { valid: false, pendingAuth: null };
    }

    // Check expiration
    if (pendingAuth.createdAt && isExpired(pendingAuth.createdAt, 5)) {
        await storage.remove(['pendingAuth']);
        return { valid: false, pendingAuth: null };
    }

    if (pendingAuth.state !== receivedState) {
        return { valid: false, pendingAuth: null };
    }

    // State is valid - clear it and return pending auth
    await storage.remove(['pendingAuth']);
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
    const { customConnectedApp } = (await storage.get(['customConnectedApp'])) as {
        customConnectedApp?: CustomConnectedApp;
    };
    return customConnectedApp || null;
}

/**
 * Save custom connected app config to storage
 * @deprecated Use per-connection clientId instead
 */
export async function saveCustomConnectedApp(config: CustomConnectedApp): Promise<void> {
    await storage.set({ customConnectedApp: config });
}

/**
 * Clear custom connected app config (revert to default)
 * @deprecated Use per-connection clientId instead
 */
export async function clearCustomConnectedApp(): Promise<void> {
    await storage.remove(['customConnectedApp']);
}

/**
 * Migrate from global customConnectedApp to per-connection clientId
 * Should be called once during app initialization (after migrateFromSingleConnection)
 */
export async function migrateCustomConnectedApp(): Promise<boolean> {
    if (!getPlatform().capabilities.manageConnections) return false;

    const data = await storage.get(['customConnectedApp', 'connections', 'customAppMigrated']);

    // Already migrated or no custom app to migrate
    const customApp = data.customConnectedApp as CustomConnectedApp | undefined;
    if (data.customAppMigrated || !customApp?.enabled) {
        return false;
    }

    const customClientId = customApp.clientId;
    const connections = (data.connections as SalesforceConnection[]) || [];

    if (connections.length > 0 && customClientId) {
        // Apply custom clientId to all existing connections that don't have one
        const updatedConnections = connections.map(conn => ({
            ...conn,
            clientId: conn.clientId || customClientId,
        }));

        await storage.set({
            connections: updatedConnections,
            customAppMigrated: true,
        });

        debugInfo('Migrated global customConnectedApp to per-connection clientIds');
    }

    // Remove deprecated customConnectedApp
    await storage.remove(['customConnectedApp']);

    return true;
}

// Listen for auth expiration broadcasts from the host (background / extension host)
getPlatform().onMessage(message => {
    if (message.type === 'authExpired') {
        triggerAuthExpired();
    }
});

// Listen for storage changes (e.g., token refresh from the host)
getPlatform().storage.onChanged(changes => {
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
