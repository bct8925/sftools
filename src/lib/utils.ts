// Shared utilities for sftools
// Central export point for commonly used functions across the extension

// --- API Configuration ---
export const API_VERSION = '62.0';

// --- Auth Functions ---
// Re-exported from auth.ts for convenient access
export {
    // Core auth
    getAccessToken,
    getInstanceUrl,
    isAuthenticated,
    loadAuthTokens,
    onAuthExpired,
    triggerAuthExpired,
    // Multi-connection management
    getActiveConnectionId,
    setActiveConnection,
    loadConnections,
    saveConnections,
    addConnection,
    updateConnection,
    removeConnection,
    findConnectionByInstance,
    migrateFromSingleConnection,
    // OAuth flow helpers
    setPendingAuth,
    consumePendingAuth,
    getOAuthCredentials,
    generateOAuthState,
    validateOAuthState,
    // Migration utilities
    migrateCustomConnectedApp,
    loadCustomConnectedApp,
    saveCustomConnectedApp,
    clearCustomConnectedApp,
} from './auth';

// --- Fetch Utilities ---
// Re-exported from fetch.ts for convenient access
export {
    extensionFetch,
    proxyFetch,
    smartFetch,
    isProxyConnected,
    checkProxyStatus,
} from './fetch';

// --- Salesforce API Request ---
// Re-exported from salesforce-request.ts for convenient access
export { salesforceRequest } from './salesforce-request';

// --- Cache Utilities ---
// Re-exported from salesforce.ts for convenient access
export { migrateDescribeCache } from './salesforce';
