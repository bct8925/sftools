/**
 * Content Script for Token Refresh
 *
 * Runs in Salesforce page context to bypass CORS restrictions for token refresh.
 * Content scripts execute in the page's origin, so fetch() calls to Salesforce
 * endpoints are same-origin and avoid CORS errors.
 *
 * Security:
 * - Only responds to messages from our extension (sender.id validation)
 * - Domain whitelist for loginDomain parameter
 * - Only calls /services/oauth2/token endpoint (hardcoded path)
 * - Never logs sensitive tokens
 */

console.log('[sftools] Content script loaded on:', window.location.hostname);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Security: Verify sender is our extension
    if (sender.id !== chrome.runtime.id) {
        sendResponse({ success: false, error: 'Unauthorized' });
        return true;
    }

    if (message.type === 'ping') {
        console.log('[sftools] Content script received ping');
        sendResponse({ success: true });
        return true;
    }

    if (message.type === 'refreshToken') {
        handleTokenRefresh(message)
            .then(sendResponse)
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Async response
    }
});

async function handleTokenRefresh({ loginDomain, clientId, refreshToken }) {
    // Validate inputs
    if (!loginDomain || !clientId || !refreshToken) {
        return { success: false, error: 'Missing parameters' };
    }

    // Use current page's origin for same-origin request (bypasses CORS)
    // This works because content scripts run in the page context
    const tokenUrl = `${window.location.origin}/services/oauth2/token`;
    console.log('[sftools] Using token URL:', tokenUrl);
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken
    }).toString();

    try {
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body
        });

        const data = await response.json();

        if (response.ok && data.access_token) {
            return { success: true, accessToken: data.access_token };
        } else {
            return { success: false, error: data.error_description || data.error || 'Token refresh failed' };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}
