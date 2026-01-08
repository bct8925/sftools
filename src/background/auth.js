// Backend Auth Module for sftools Chrome Extension
// Handles OAuth token exchange and refresh in the service worker

import { isProxyConnected, sendProxyRequest } from './native-messaging.js';

/**
 * Get OAuth credentials for a specific connection or default
 * Uses per-connection clientId if available, otherwise falls back to manifest default
 * @param {string|null} connectionId - Optional connection ID to look up
 * @returns {Promise<{clientId: string}>}
 */
async function getBackgroundOAuthCredentials(connectionId = null) {
    // Check for per-connection clientId first
    if (connectionId) {
        const { connections } = await chrome.storage.local.get(['connections']);
        const connection = connections?.find(c => c.id === connectionId);
        if (connection?.clientId) {
            return { clientId: connection.clientId };
        }
    }

    // Fall back to manifest default
    return { clientId: chrome.runtime.getManifest().oauth2.client_id };
}

/**
 * Exchange authorization code for tokens via proxy
 * Returns token data for the callback page to handle storage
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Redirect URI used in auth request
 * @param {string} loginDomain - The login domain used for auth
 * @param {string} clientId - OAuth client ID
 * @returns {Promise<{success: boolean, accessToken?: string, refreshToken?: string, instanceUrl?: string, loginDomain?: string, error?: string}>}
 */
export async function exchangeCodeForTokens(code, redirectUri, loginDomain, clientId) {
    if (!isProxyConnected()) {
        return { success: false, error: 'Proxy not connected' };
    }

    try {
        loginDomain = loginDomain || 'https://login.salesforce.com';
        const tokenUrl = `${loginDomain}/services/oauth2/token`;

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code: code,
            redirect_uri: redirectUri
        }).toString();

        const response = await sendProxyRequest({
            type: 'rest',
            url: tokenUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        if (!response.success) {
            let errorMsg = response.error || 'Token exchange request failed';
            if (response.data) {
                try {
                    const errData = JSON.parse(response.data);
                    errorMsg = errData.error_description || errData.error || errorMsg;
                } catch (e) {
                    errorMsg = response.data.substring(0, 200) || errorMsg;
                }
            }
            return { success: false, error: errorMsg };
        }

        const tokenData = JSON.parse(response.data);

        if (tokenData.access_token) {
            console.log('OAuth token exchange successful');
            return {
                success: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                instanceUrl: tokenData.instance_url,
                loginDomain: loginDomain
            };
        } else {
            return {
                success: false,
                error: tokenData.error_description || tokenData.error || 'Token exchange failed'
            };
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Track refresh promises per connection to prevent concurrent refreshes
const refreshPromises = new Map();

/**
 * Refresh the access token for a specific connection.
 * Uses mutex pattern per connection to prevent concurrent refreshes.
 * Routes through proxy to bypass CORS.
 * @param {object} connection - Connection object with refreshToken and loginDomain
 * @returns {Promise<{success: boolean, accessToken?: string, error?: string}>}
 */
export async function refreshAccessToken(connection) {
    if (!connection || !connection.id) {
        return { success: false, error: 'No connection provided' };
    }

    // Check for existing refresh in progress for this connection
    if (refreshPromises.has(connection.id)) {
        return refreshPromises.get(connection.id);
    }

    const promise = (async () => {
        try {
            if (!connection.refreshToken) {
                return { success: false, error: 'No refresh token available' };
            }

            if (!isProxyConnected()) {
                return { success: false, error: 'Proxy not connected for token refresh' };
            }

            const loginDomain = connection.loginDomain || 'https://login.salesforce.com';
            const tokenUrl = `${loginDomain}/services/oauth2/token`;
            // Use connection's clientId if set, otherwise fall back to default
            const { clientId } = await getBackgroundOAuthCredentials(connection.id);

            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: connection.refreshToken
            }).toString();

            const response = await sendProxyRequest({
                type: 'rest',
                url: tokenUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            });

            if (!response.success) {
                console.error('Token refresh request failed:', response.error);
                return { success: false, error: response.error || 'Refresh failed' };
            }

            const tokenData = JSON.parse(response.data);

            if (tokenData.access_token) {
                console.log('Token refreshed successfully for connection:', connection.id);
                return { success: true, accessToken: tokenData.access_token };
            } else {
                console.error('Token refresh failed:', tokenData.error_description);
                return { success: false, error: tokenData.error_description || 'Refresh failed' };
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: error.message };
        } finally {
            refreshPromises.delete(connection.id);
        }
    })();

    refreshPromises.set(connection.id, promise);
    return promise;
}

/**
 * Update a specific connection's access token in storage
 * @param {string} connectionId - The connection ID to update
 * @param {string} accessToken - The new access token
 */
export async function updateConnectionToken(connectionId, accessToken) {
    const data = await chrome.storage.local.get(['connections']);
    const connections = data.connections || [];
    const index = connections.findIndex(c => c.id === connectionId);

    if (index !== -1) {
        connections[index].accessToken = accessToken;
        connections[index].lastUsedAt = Date.now();
        await chrome.storage.local.set({ connections });
    }
}

/**
 * Clear all auth tokens from storage and broadcast expiration
 */
export async function clearAuthTokens() {
    await chrome.storage.local.remove(['accessToken', 'refreshToken', 'instanceUrl', 'loginDomain']);
    chrome.runtime.sendMessage({ type: 'authExpired' }).catch(() => {});
}
