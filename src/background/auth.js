// Backend Auth Module for sftools Chrome Extension
// Handles OAuth token exchange and refresh in the service worker

import { isProxyConnected, sendProxyRequest } from './native-messaging.js';

let refreshPromise = null;

/**
 * Exchange authorization code for tokens via proxy
 * @param {string} code - Authorization code
 * @param {string} redirectUri - Redirect URI used in auth request
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function exchangeCodeForTokens(code, redirectUri) {
    if (!isProxyConnected()) {
        return { success: false, error: 'Proxy not connected' };
    }

    try {
        const data = await chrome.storage.local.get(['loginDomain']);
        const loginDomain = data.loginDomain || 'https://login.salesforce.com';
        const tokenUrl = `${loginDomain}/services/oauth2/token`;
        const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
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
            return { success: false, error: response.error || 'Token exchange failed' };
        }

        const tokenData = JSON.parse(response.data);

        if (tokenData.access_token) {
            await chrome.storage.local.set({
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                instanceUrl: tokenData.instance_url
            });
            console.log('OAuth tokens stored successfully');
            return { success: true };
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

/**
 * Refresh the access token using the stored refresh token.
 * Uses mutex pattern to prevent concurrent refreshes.
 * Routes through proxy to bypass CORS.
 * @returns {Promise<{success: boolean, accessToken?: string, error?: string}>}
 */
export async function refreshAccessToken() {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const data = await chrome.storage.local.get(['refreshToken', 'loginDomain']);

            if (!data.refreshToken) {
                return { success: false, error: 'No refresh token available' };
            }

            if (!isProxyConnected()) {
                return { success: false, error: 'Proxy not connected for token refresh' };
            }

            const loginDomain = data.loginDomain || 'https://login.salesforce.com';
            const tokenUrl = `${loginDomain}/services/oauth2/token`;
            const CLIENT_ID = chrome.runtime.getManifest().oauth2.client_id;

            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: CLIENT_ID,
                refresh_token: data.refreshToken
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
                await clearAuthTokens();
                return { success: false, error: response.error || 'Refresh failed' };
            }

            const tokenData = JSON.parse(response.data);

            if (tokenData.access_token) {
                await chrome.storage.local.set({ accessToken: tokenData.access_token });
                console.log('Token refreshed successfully');
                return { success: true, accessToken: tokenData.access_token };
            } else {
                console.error('Token refresh failed:', tokenData.error_description);
                await clearAuthTokens();
                return { success: false, error: tokenData.error_description || 'Refresh failed' };
            }
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: error.message };
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

/**
 * Clear all auth tokens from storage and broadcast expiration
 */
export async function clearAuthTokens() {
    await chrome.storage.local.remove(['accessToken', 'refreshToken', 'instanceUrl', 'loginDomain']);
    chrome.runtime.sendMessage({ type: 'authExpired' }).catch(() => {});
}
