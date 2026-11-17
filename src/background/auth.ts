// Backend Auth Module for sftools Chrome Extension
// Handles OAuth token exchange and refresh in the service worker

import { getOAuthCredentials } from '../auth/oauth-credentials';
import type { SalesforceConnection, TokenType } from '../types/salesforce';
import { hasHostAccess } from '../lib/host-access';
import { isProxyConnected, sendProxyRequest } from './native-messaging';
import { debugInfo } from './debug';
import { createDpopProof, handleDpopNonce, normalizeTokenType } from './dpop';

const NO_TOKEN_ROUTE =
    'Proxy not connected and no Salesforce site access. Connect the proxy or sign in again to allow access.';

interface TokenExchangeSuccess {
    success: true;
    accessToken: string;
    refreshToken: string;
    instanceUrl: string;
    loginDomain: string;
    tokenType: TokenType;
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
    tokenType: TokenType;
}

interface TokenRefreshError {
    success: false;
    error: string;
}

type TokenRefreshResult = TokenRefreshSuccess | TokenRefreshError;

interface ProxyRestResponse {
    success: boolean;
    status?: number;
    headers?: Record<string, string>;
    data: string;
    error?: string;
}

interface TokenResponseBody {
    access_token?: string;
    refresh_token?: string;
    instance_url?: string;
    token_type?: string;
    error_description?: string;
    error?: string;
}

/**
 * True when the token endpoint can be reached: through the proxy, or directly with
 * granted Salesforce host access (no CORS)
 */
export async function canReachTokenEndpoint(loginDomain: string): Promise<boolean> {
    return isProxyConnected() || hasHostAccess(`${loginDomain}/services/oauth2/token`);
}

async function sendTokenRequest(
    tokenUrl: string,
    headers: Record<string, string>,
    body: string
): Promise<ProxyRestResponse> {
    if (isProxyConnected()) {
        return (await sendProxyRequest({
            type: 'rest',
            url: tokenUrl,
            method: 'POST',
            headers,
            body,
        })) as ProxyRestResponse;
    }

    // Direct from the service worker: needs granted host access to skip CORS
    const response = await fetch(tokenUrl, { method: 'POST', headers, body });
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
    });
    return {
        success: response.ok,
        status: response.status,
        headers: responseHeaders,
        data: await response.text(),
        ...(!response.ok && { error: `HTTP ${response.status}` }),
    };
}

/**
 * POST to the Salesforce token endpoint with a DPoP proof, through the proxy or directly.
 * Retries once when the server asks for a DPoP nonce.
 */
async function postTokenRequest(
    tokenUrl: string,
    params: Record<string, string>
): Promise<ProxyRestResponse> {
    const body = new URLSearchParams(params).toString();
    for (let attempt = 0; ; attempt++) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/x-www-form-urlencoded',
        };
        try {
            headers.DPoP = await createDpopProof({ method: 'POST', url: tokenUrl });
        } catch (error) {
            // Without a key the server issues a Bearer token, which still works unless
            // the connected app requires DPoP
            console.warn('DPoP proof unavailable, requesting a Bearer token:', error);
        }

        const response = await sendTokenRequest(tokenUrl, headers, body);

        const retry =
            attempt === 0 &&
            !response.success &&
            handleDpopNonce(tokenUrl, response.status ?? 0, response.headers, response.data);
        if (!retry) return response;
        debugInfo('Token endpoint asked for a DPoP nonce, retrying');
    }
}

function parseTokenError(response: ProxyRestResponse, fallback: string): string {
    let errorMsg = response.error || fallback;
    if (response.data) {
        try {
            const errData = JSON.parse(response.data) as TokenResponseBody;
            errorMsg = errData.error_description || errData.error || errorMsg;
        } catch {
            errorMsg = response.data.substring(0, 200) || errorMsg;
        }
    }
    return errorMsg;
}

/**
 * Exchange authorization code for tokens via proxy
 * Returns token data for the callback page to handle storage
 * @param codeVerifier - PKCE code verifier for the code challenge sent to /authorize
 */
export async function exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    loginDomain: string,
    clientId: string,
    codeVerifier?: string
): Promise<TokenExchangeResult> {
    const normalizedDomain = loginDomain || 'https://login.salesforce.com';
    if (!(await canReachTokenEndpoint(normalizedDomain))) {
        return { success: false, error: NO_TOKEN_ROUTE };
    }

    try {
        const tokenUrl = `${normalizedDomain}/services/oauth2/token`;

        const params: Record<string, string> = {
            grant_type: 'authorization_code',
            client_id: clientId,
            code: code,
            redirect_uri: redirectUri,
        };
        if (codeVerifier) params.code_verifier = codeVerifier;

        const response = await postTokenRequest(tokenUrl, params);

        if (!response.success) {
            return {
                success: false,
                error: parseTokenError(response, 'Token exchange request failed'),
            };
        }

        const tokenData = JSON.parse(response.data) as TokenResponseBody;

        if (tokenData.access_token) {
            debugInfo('OAuth token exchange successful');
            return {
                success: true,
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token || '',
                instanceUrl: tokenData.instance_url || '',
                loginDomain: normalizedDomain,
                tokenType: normalizeTokenType(tokenData.token_type),
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

// Access token each connection had before its last refresh
const replacedAccessTokens = new Map<string, string>();

/**
 * True when the token is one a refresh already replaced for this connection,
 * so a request that failed with it should retry with the stored token instead of
 * refreshing again (which would reuse a rotated refresh token)
 */
export function isReplacedAccessToken(connectionId: string, accessToken: string): boolean {
    return replacedAccessTokens.get(connectionId) === accessToken;
}

async function getStoredConnection(connectionId: string): Promise<SalesforceConnection | null> {
    const { connections } = await chrome.storage.local.get(['connections']);
    return (
        (connections as SalesforceConnection[] | undefined)?.find(c => c.id === connectionId) ??
        null
    );
}

/**
 * Refresh the access token for a specific connection.
 * Uses mutex pattern per connection to prevent concurrent refreshes.
 * Routes through proxy to bypass CORS.
 *
 * Salesforce refresh token rotation makes each refresh token single-use: reusing an old
 * one revokes every token for the connection. So the refresh reads the newest refresh
 * token from storage and saves the rotated tokens before releasing the mutex.
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
            const current = (await getStoredConnection(connection.id)) ?? connection;
            if (!current.refreshToken) {
                return { success: false, error: 'No refresh token available' };
            }

            const loginDomain = current.loginDomain || 'https://login.salesforce.com';
            if (!(await canReachTokenEndpoint(loginDomain))) {
                return { success: false, error: NO_TOKEN_ROUTE };
            }

            const tokenUrl = `${loginDomain}/services/oauth2/token`;
            // Use connection's clientId if set, otherwise fall back to default
            const { clientId } = await getOAuthCredentials(connection.id);

            const response = await postTokenRequest(tokenUrl, {
                grant_type: 'refresh_token',
                client_id: clientId,
                refresh_token: current.refreshToken,
            });

            if (!response.success) {
                const error = parseTokenError(response, 'Refresh failed');
                console.error('Token refresh request failed:', error);
                return { success: false, error };
            }

            const tokenData = JSON.parse(response.data) as TokenResponseBody;

            if (tokenData.access_token) {
                debugInfo('Token refreshed successfully for connection:', connection.id);
                const tokenType = normalizeTokenType(tokenData.token_type);
                replacedAccessTokens.set(connection.id, current.accessToken);
                await updateConnectionToken(connection.id, tokenData.access_token, {
                    refreshToken: tokenData.refresh_token,
                    tokenType,
                });
                return { success: true, accessToken: tokenData.access_token, tokenType };
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
 * @param rotated - rotated refresh token and token type from a refresh response, if any
 */
export async function updateConnectionToken(
    connectionId: string,
    accessToken: string,
    rotated: { refreshToken?: string; tokenType?: TokenType } = {}
): Promise<void> {
    const data = await chrome.storage.local.get(['connections']);
    const connections = (data.connections || []) as SalesforceConnection[];
    const index = connections.findIndex(c => c.id === connectionId);

    if (index !== -1) {
        connections[index].accessToken = accessToken;
        if (rotated.refreshToken) connections[index].refreshToken = rotated.refreshToken;
        if (rotated.tokenType) connections[index].tokenType = rotated.tokenType;
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
