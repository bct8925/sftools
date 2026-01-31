// Shared utilities for sftools
// Central export point for commonly used functions across the extension

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
} from '../auth/auth';

// --- Fetch Utilities ---
// Re-exported from fetch.ts for convenient access
export {
    extensionFetch,
    proxyFetch,
    smartFetch,
    isProxyConnected,
    checkProxyStatus,
} from '../api/fetch';

// --- Salesforce API Request ---
// Re-exported from salesforce-request.ts for convenient access
export { salesforceRequest } from '../api/salesforce-request';

// --- Cache Utilities ---
// Re-exported from salesforce.ts for convenient access
export { migrateDescribeCache } from '../api/salesforce';
