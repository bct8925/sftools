// OAuth Callback Handler
// Supports both authorization code flow (with proxy) and implicit flow (without proxy)

import { addConnection, findConnectionByInstance, updateConnection, getOAuthCredentials, consumePendingAuth } from '../../lib/auth.js';

const statusEl = document.getElementById('status');

// Check for authorization code (code flow) in query params
const queryParams = new URLSearchParams(window.location.search);
const code = queryParams.get('code');
const error = queryParams.get('error');
const errorDescription = queryParams.get('error_description');

// Check for access token (implicit flow) in hash
const hashParams = new URLSearchParams(window.location.hash.substring(1));
const accessToken = hashParams.get('access_token');
const instanceUrl = hashParams.get('instance_url');

if (error) {
    // OAuth error
    statusEl.innerHTML = `<span class="error">Authorization denied: ${errorDescription || error}</span>`;
} else if (code) {
    // Authorization code flow - exchange via proxy
    handleCodeFlow(code);
} else if (accessToken && instanceUrl) {
    // Implicit flow - store tokens directly
    handleImplicitFlow(accessToken, instanceUrl);
} else {
    statusEl.innerHTML = '<span class="error">No authorization response received.</span><br>Please try authorizing again.';
}

/**
 * Handle authorization code flow - exchange code for tokens via proxy
 */
async function handleCodeFlow(code) {
    statusEl.innerText = 'Exchanging authorization code...';

    try {
        const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

        // Get pending auth parameters (includes loginDomain, clientId, connectionId)
        const pendingAuth = await consumePendingAuth();
        const loginDomain = pendingAuth?.loginDomain || 'https://login.salesforce.com';

        // Get clientId - use pending auth's custom clientId or fall back to default
        let clientId;
        if (pendingAuth?.clientId) {
            clientId = pendingAuth.clientId;
        } else {
            const credentials = await getOAuthCredentials();
            clientId = credentials.clientId;
        }

        const response = await chrome.runtime.sendMessage({
            type: 'tokenExchange',
            code: code,
            redirectUri: CALLBACK_URL,
            loginDomain: loginDomain,
            clientId: clientId
        });

        if (response.success) {
            // Add or update connection, preserving custom clientId
            await addOrUpdateConnection({
                instanceUrl: response.instanceUrl,
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                loginDomain: response.loginDomain,
                clientId: pendingAuth?.clientId || null
            }, pendingAuth?.connectionId);

            statusEl.innerText = 'Connection saved. You can close this tab.';
            setTimeout(() => window.close(), 1000);
        } else {
            statusEl.innerHTML = `<span class="error">Token exchange failed: ${response.error}</span>`;
        }
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error: ${err.message}</span>`;
    }
}

/**
 * Handle implicit flow - store tokens directly
 */
async function handleImplicitFlow(accessToken, instanceUrl) {
    statusEl.innerText = 'Processing tokens...';

    try {
        // Get pending auth parameters (includes loginDomain, clientId, connectionId)
        const pendingAuth = await consumePendingAuth();
        const loginDomain = pendingAuth?.loginDomain || 'https://login.salesforce.com';

        // Add or update connection, preserving custom clientId
        await addOrUpdateConnection({
            instanceUrl: instanceUrl,
            accessToken: accessToken,
            refreshToken: null, // No refresh token in implicit flow
            loginDomain: loginDomain,
            clientId: pendingAuth?.clientId || null
        }, pendingAuth?.connectionId);

        statusEl.innerText = 'Connection saved. You can close this tab.';
        setTimeout(() => window.close(), 1000);
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error storing tokens: ${err.message}</span>`;
    }
}

/**
 * Add a new connection or update existing one
 * @param {object} data - Connection data
 * @param {string|null} existingConnectionId - If re-authorizing, the connection ID to update
 */
async function addOrUpdateConnection(data, existingConnectionId = null) {
    if (existingConnectionId) {
        // Re-authorizing existing connection - update it directly
        await updateConnection(existingConnectionId, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            loginDomain: data.loginDomain,
            clientId: data.clientId
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
                clientId: data.clientId ?? existing.clientId
            });
        } else {
            // Add new connection
            await addConnection(data);
        }
    }
}
