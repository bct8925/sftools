// Backend Auth Module for sftools Chrome Extension
// Handles OAuth token exchange and refresh in the service worker

import { getOAuthCredentials } from '../auth/oauth-credentials';
import type { SalesforceConnection } from '../types/salesforce';
import { isProxyConnected, sendProxyRequest } from './native-messaging';
import { debugInfo } from './debug';

interface _TokenExchangeRequest {
    code: string;
    redirectUri: string;
    loginDomain: string;
    clientId: string;
}

interface TokenExchangeSuccess {
    success: true;
    accessToken: string;
    refreshToken: string;
    instanceUrl: string;
    loginDomain: string;
    [key: string]: unknown;
}

interface TokenExchangeError {
    success: false;
    error: string;
    [key: string]: unknown;
}

type TokenExchangeResult = TokenExchangeSuccess | TokenExchangeError;

interface TokenRefreshSuccess {
    success: true;
    accessToken: string;
}

interface TokenRefreshError {
    success: false;
    error: string;
}

type TokenRefreshResult = TokenRefreshSuccess | TokenRefreshError;

interface ProxyRestResponse {
    success: boolean;
    data: string;
    error?: string;
}

/**
 * Exchange authorization code for tokens via proxy
 * Returns token data for the callback page to handle storage
 */
export async function exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    loginDomain: string,
    clientId: string
): Promise<TokenExchangeResult> {
    if (!isProxyConnected()) {
        return { success: false, error: 'Proxy not connected' };
    }

    try {
        const normalizedDomain = loginDomain || 'https://login.salesforce.com';
        const tokenUrl = `${normalizedDomain}/services/oauth2/token`;

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code: code,
            redirect_uri: redirectUri,
        }).toString();

        const response = (await sendProxyRequest({
            type: 'rest',
            url: tokenUrl,
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
        })) as ProxyRestResponse;

        if (!response.success) {
            let errorMsg = response.error || 'Token exchange request failed';
            if (response.data) {
                try {
                    const errData = JSON.parse(response.data) as {
                        error_description?: string;
                        error?: string;
                    };
                    errorMsg = errData.error_description || errData.error || errorMsg;
                } catch {
                    errorMsg = response.data.substring(0, 200) || errorMsg;
                }
            }
            return { success: false, error: errorMsg };
        }

        const tokenData = JSON.parse(response.data) as {
            access_token?: string;
            refresh_token?: string;
            instance_url?: string;
            error_description?: string;
            error?: string;
        };

        if (tokenData.access_token) {
            debugInfo('OAuth token exchange successful');
            return {
                success: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || '',
                instanceUrl: tokenData.instance_url || '',
                loginDomain: normalizedDomain,
            };
        }
        return {
            success: false,
            error: tokenData.error_description || tokenData.error || 'Token exchange failed',
        };
    } catch (error) {
        return { success: false, error: (error as Error).message };
    }
}

// Track refresh promises per connection to prevent concurrent refreshes
const refreshPromises = new Map<string, Promise<TokenRefreshResult>>();

/**
 * Refresh the access token for a specific connection.
 * Uses mutex pattern per connection to prevent concurrent refreshes.
 * Routes through proxy to bypass CORS.
 */
export function refreshAccessToken(connection: SalesforceConnection): Promise<TokenRefreshResult> {
    if (!connection || !connection.id) {
        return Promise.resolve({ success: false, error: 'No connection provided' });
    }

    // Check for existing refresh in progress for this connection
    if (refreshPromises.has(connection.id)) {
        return refreshPromises.get(connection.id)!;
    }

    const promise = (async (): Promise<TokenRefreshResult> => {
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
            const { clientId } = await getOAuthCredentials(connection.id);

            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: connection.refreshToken,
            }).toString();

            const response = (await sendProxyRequest({
                type: 'rest',
                url: tokenUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body,
            })) as ProxyRestResponse;

            if (!response.success) {
                console.error('Token refresh request failed:', response.error);
                return { success: false, error: response.error || 'Refresh failed' };
            }

            const tokenData = JSON.parse(response.data) as {
                access_token?: string;
                error_description?: string;
            };

            if (tokenData.access_token) {
                debugInfo('Token refreshed successfully for connection:', connection.id);
                return { success: true, accessToken: tokenData.access_token };
            }
            return { success: false, error: tokenData.error_description || 'Refresh failed' };
        } catch (error) {
            console.error('Token refresh error:', error);
            return { success: false, error: (error as Error).message };
        } finally {
            refreshPromises.delete(connection.id);
        }
    })();

    refreshPromises.set(connection.id, promise);
    return promise;
}

/**
 * Update a specific connection's access token in storage
 */
export async function updateConnectionToken(
    connectionId: string,
    accessToken: string
): Promise<void> {
    const data = await chrome.storage.local.get(['connections']);
    const connections = (data.connections || []) as SalesforceConnection[];
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
export async function clearAuthTokens(): Promise<void> {
    await chrome.storage.local.remove([
        'accessToken',
        'refreshToken',
        'instanceUrl',
        'loginDomain',
    ]);
    chrome.runtime.sendMessage({ type: 'authExpired' }).catch(() => {
        /* ignore */
    });
}
