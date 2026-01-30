// OAuth Callback Handler
// Supports both authorization code flow (with proxy) and implicit flow (without proxy)

import {
    addConnection,
    findConnectionByInstance,
    updateConnection,
    getOAuthCredentials,
    validateOAuthState,
    setActiveConnection,
} from '../../auth/auth';
import { escapeHtml } from '../../lib/text-utils';
import type { SalesforceConnection, UserInfo } from '../../types/salesforce';

interface _PendingAuth {
    loginDomain?: string;
    clientId?: string | null;
    connectionId?: string | null;
    state?: string;
}

interface TokenExchangeResponse {
    success: boolean;
    instanceUrl?: string;
    accessToken?: string;
    refreshToken?: string;
    error?: string;
}

const statusEl = document.getElementById('status')!;

// Check for authorization code (code flow) in query params
const queryParams = new URLSearchParams(window.location.search);
const authCode = queryParams.get('code');
const error = queryParams.get('error');
const errorDescription = queryParams.get('error_description');
const stateFromQuery = queryParams.get('state');

// Check for access token (implicit flow) in hash
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const hashAccessToken = hashParams.get('access_token');
const hashInstanceUrl = hashParams.get('instance_url');
const stateFromHash = hashParams.get('state');

// Get state from whichever flow we're in
const oauthState = stateFromQuery || stateFromHash;

if (error) {
    // OAuth error - escape to prevent XSS
    statusEl.innerHTML = `<span class="error">Authorization denied: ${escapeHtml(errorDescription || error)}</span>`;
} else if (authCode) {
    // Authorization code flow - exchange via proxy
    handleCodeFlow(authCode, oauthState);
} else if (hashAccessToken && hashInstanceUrl) {
    // Implicit flow - store tokens directly
    handleImplicitFlow(hashAccessToken, hashInstanceUrl, oauthState);
} else {
    statusEl.innerHTML =
        '<span class="error">No authorization response received.</span><br>Please try authorizing again.';
}

/**
 * Handle authorization code flow - exchange code for tokens via proxy
 */
async function handleCodeFlow(code: string, state: string | null): Promise<void> {
    statusEl.innerText = 'Validating authorization...';

    try {
        // Validate state before proceeding
        if (!state) {
            statusEl.innerHTML =
                '<span class="error">Missing authorization state parameter.</span><br>Please try authorizing again.';
            return;
        }

        const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

        // Validate state parameter for CSRF protection
        const { valid, pendingAuth } = await validateOAuthState(state);
        if (!valid) {
            statusEl.innerHTML =
                '<span class="error">Invalid or expired authorization state.</span><br>Please try authorizing again.';
            return;
        }

        const loginDomain = pendingAuth?.loginDomain || 'https://login.salesforce.com';

        // Get clientId - use pending auth's custom clientId or fall back to default
        const clientId = pendingAuth?.clientId ?? (await getOAuthCredentials()).clientId;

        const response = (await chrome.runtime.sendMessage({
            type: 'tokenExchange',
            code,
            redirectUri: CALLBACK_URL,
            loginDomain,
            clientId,
        })) as TokenExchangeResponse;

        if (response.success && response.instanceUrl && response.accessToken) {
            // Derive loginDomain from instanceUrl if auto-detect was used (null loginDomain)
            // The instanceUrl is the My Domain URL, which is what we want for future re-auths
            const savedLoginDomain =
                pendingAuth?.loginDomain || deriveLoginDomain(response.instanceUrl);

            // Add or update connection, preserving custom clientId
            await addOrUpdateConnection(
                {
                    instanceUrl: response.instanceUrl,
                    accessToken: response.accessToken,
                    refreshToken: response.refreshToken || null,
                    loginDomain: savedLoginDomain,
                    clientId: pendingAuth?.clientId || null,
                },
                pendingAuth?.connectionId || null
            );

            statusEl.innerText = 'Connection saved. You can close this tab.';
            setTimeout(() => window.close(), 1000);
        } else {
            statusEl.innerHTML = `<span class="error">Token exchange failed: ${escapeHtml(response.error || 'Unknown error')}</span>`;
        }
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error: ${escapeHtml((err as Error).message)}</span>`;
    }
}

/**
 * Handle implicit flow - store tokens directly
 */
async function handleImplicitFlow(
    accessToken: string,
    instanceUrl: string,
    state: string | null
): Promise<void> {
    statusEl.innerText = 'Validating authorization...';

    try {
        // Validate state before proceeding
        if (!state) {
            statusEl.innerHTML =
                '<span class="error">Missing authorization state parameter.</span><br>Please try authorizing again.';
            return;
        }

        // Validate state parameter for CSRF protection
        const { valid, pendingAuth } = await validateOAuthState(state);
        if (!valid) {
            statusEl.innerHTML =
                '<span class="error">Invalid or expired authorization state.</span><br>Please try authorizing again.';
            return;
        }

        // Derive loginDomain from instanceUrl if auto-detect was used (null loginDomain)
        // The instanceUrl is the My Domain URL, which is what we want for future re-auths
        const loginDomain = pendingAuth?.loginDomain || deriveLoginDomain(instanceUrl);

        // Add or update connection, preserving custom clientId
        await addOrUpdateConnection(
            {
                instanceUrl: instanceUrl,
                accessToken: accessToken,
                refreshToken: null, // No refresh token in implicit flow
                loginDomain: loginDomain,
                clientId: pendingAuth?.clientId || null,
            },
            pendingAuth?.connectionId || null
        );

        statusEl.innerText = 'Connection saved. You can close this tab.';
        setTimeout(() => window.close(), 1000);
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error storing tokens: ${escapeHtml((err as Error).message)}</span>`;
    }
}

/**
 * Derive login domain from instance URL
 * For My Domain orgs, the instanceUrl is the login URL
 * Falls back to standard login.salesforce.com
 */
function deriveLoginDomain(instanceUrl: string): string {
    if (!instanceUrl) return 'https://login.salesforce.com';

    try {
        const url = new URL(instanceUrl);
        // My Domain URLs like https://mycompany.my.salesforce.com can be used directly
        if (
            url.hostname.includes('.my.salesforce.com') ||
            url.hostname.includes('.sandbox.my.salesforce.com')
        ) {
            return url.origin;
        }
    } catch {
        // Invalid URL, use default
    }

    return 'https://login.salesforce.com';
}

/**
 * Fetch username from Salesforce UserInfo endpoint
 * Returns username or null if fetch fails
 */
async function fetchUsername(instanceUrl: string, accessToken: string): Promise<string | null> {
    try {
        const response = await fetch(`${instanceUrl}/services/oauth2/userinfo`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            console.warn('Failed to fetch user info:', response.status);
            return null;
        }

        const userInfo = (await response.json()) as UserInfo;
        return userInfo.preferred_username || null;
    } catch (error) {
        console.warn('Error fetching username:', error);
        return null;
    }
}

/**
 * Add a new connection or update existing one
 * @param data - Connection data
 * @param existingConnectionId - If re-authorizing, the connection ID to update
 */
async function addOrUpdateConnection(
    data: Partial<SalesforceConnection> & {
        instanceUrl: string;
        accessToken: string;
        refreshToken: string | null;
        loginDomain: string;
        clientId: string | null;
    },
    existingConnectionId: string | null = null
): Promise<void> {
    if (existingConnectionId) {
        // Re-authorizing existing connection - update it directly
        await updateConnection(existingConnectionId, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            loginDomain: data.loginDomain,
            clientId: data.clientId,
        });
    } else {
        // Check for existing connection by instanceUrl
        const existing = await findConnectionByInstance(data.instanceUrl);

        if (existing) {
            // Update existing connection with new tokens, preserve clientId if not provided
            await updateConnection(existing.id, {
                accessToken: data.accessToken,
                refreshToken: data.refreshToken || existing.refreshToken,
                loginDomain: data.loginDomain || existing.loginDomain,
                clientId: data.clientId ?? existing.clientId,
            });
        } else {
            // Fetch username for new connection
            const username = await fetchUsername(data.instanceUrl, data.accessToken);

            // Add new connection with username
            const newConnection = await addConnection({
                ...data,
                username: username || undefined,
            });

            // Set as active connection temporarily to make the API call work
            setActiveConnection(newConnection);
        }
    }
}
