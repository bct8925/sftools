// OAuth Callback Handler
// Supports both authorization code flow (with proxy) and implicit flow (without proxy)

import { addConnection, findConnectionByInstance, updateConnection, getOAuthCredentials } from '../../lib/auth.js';

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

        // Get loginDomain that was stored before auth redirect
        const { loginDomain } = await chrome.storage.local.get(['loginDomain']);

        // Get OAuth credentials for token exchange
        const { clientId } = await getOAuthCredentials();

        const response = await chrome.runtime.sendMessage({
            type: 'tokenExchange',
            code: code,
            redirectUri: CALLBACK_URL,
            loginDomain: loginDomain,
            clientId: clientId
        });

        if (response.success) {
            // Add or update connection using the new multi-connection storage
            await addOrUpdateConnection({
                instanceUrl: response.instanceUrl,
                accessToken: response.accessToken,
                refreshToken: response.refreshToken,
                loginDomain: response.loginDomain
            });

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
        // Get loginDomain that was stored before auth redirect
        const { loginDomain } = await chrome.storage.local.get(['loginDomain']);

        // Add or update connection using the new multi-connection storage
        await addOrUpdateConnection({
            instanceUrl: instanceUrl,
            accessToken: accessToken,
            refreshToken: null, // No refresh token in implicit flow
            loginDomain: loginDomain
        });

        statusEl.innerText = 'Connection saved. You can close this tab.';
        setTimeout(() => window.close(), 1000);
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error storing tokens: ${err.message}</span>`;
    }
}

/**
 * Add a new connection or update existing one if same instanceUrl
 */
async function addOrUpdateConnection(data) {
    const existing = await findConnectionByInstance(data.instanceUrl);

    if (existing) {
        // Update existing connection with new tokens
        await updateConnection(existing.id, {
            accessToken: data.accessToken,
            refreshToken: data.refreshToken || existing.refreshToken,
            loginDomain: data.loginDomain || existing.loginDomain
        });
    } else {
        // Add new connection
        await addConnection(data);
    }
}
