// OAuth Callback Handler
// Supports both authorization code flow (with proxy) and implicit flow (without proxy)

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

        const response = await chrome.runtime.sendMessage({
            type: 'tokenExchange',
            code: code,
            redirectUri: CALLBACK_URL
        });

        if (response.success) {
            statusEl.innerText = 'Session acquired. Redirecting to sftools...';
            setTimeout(() => {
                window.location.href = '../../dist/app.html';
            }, 500);
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
        await chrome.storage.local.set({
            accessToken: accessToken,
            instanceUrl: instanceUrl
            // No refreshToken in implicit flow
        });

        statusEl.innerText = 'Session acquired. Redirecting to sftools...';
        setTimeout(() => {
            window.location.href = '../../dist/app.html';
        }, 500);
    } catch (err) {
        statusEl.innerHTML = `<span class="error">Error storing tokens: ${err.message}</span>`;
    }
}
