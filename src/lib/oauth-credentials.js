// OAuth Credentials Helper
// Shared utility for retrieving OAuth credentials in both frontend and service worker contexts

/**
 * Get OAuth credentials for a specific connection or default
 * Uses per-connection clientId if available, otherwise falls back to manifest default
 *
 * This function is context-agnostic and works in both frontend pages and service workers.
 *
 * @param {string|null} connectionId - Optional connection ID to look up
 * @returns {Promise<{clientId: string, isCustom: boolean}>}
 */
export async function getOAuthCredentials(connectionId = null) {
    // Check for per-connection clientId first
    if (connectionId) {
        const { connections } = await chrome.storage.local.get(['connections']);
        const connection = connections?.find(c => c.id === connectionId);
        if (connection?.clientId) {
            return { clientId: connection.clientId, isCustom: true };
        }
    }

    // Fall back to manifest default
    return { clientId: chrome.runtime.getManifest().oauth2.client_id, isCustom: false };
}
