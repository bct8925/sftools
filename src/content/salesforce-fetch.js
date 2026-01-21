/**
 * Content Script for Salesforce API Fetch
 *
 * Runs in Salesforce page context to bypass CORS restrictions for API requests.
 * Content scripts execute in the page's origin, so fetch() calls to Salesforce
 * endpoints are same-origin and avoid CORS errors.
 *
 * Handles:
 * - Token refresh (/services/oauth2/token)
 * - General API requests (/services/* endpoints)
 *
 * Security:
 * - Only responds to messages from our extension (sender.id validation)
 * - URL origin validation (must match page origin)
 * - Path whitelist (/services/* only)
 * - Method whitelist (GET, POST, PATCH, DELETE, PUT)
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

    if (message.type === 'contentFetch') {
        handleContentFetch(message)
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

async function handleContentFetch({ url, method, headers, body }) {
    // Security: Validate URL matches page origin
    const pageOrigin = window.location.origin;
    let requestUrl;

    try {
        requestUrl = new URL(url);
    } catch (err) {
        return { success: false, error: 'Invalid URL' };
    }

    if (requestUrl.origin !== pageOrigin) {
        console.error('[sftools] Origin mismatch:', requestUrl.origin, 'vs', pageOrigin);
        return { success: false, error: 'URL origin mismatch' };
    }

    // Security: Only allow Salesforce API paths
    if (!requestUrl.pathname.startsWith('/services/')) {
        console.error('[sftools] Invalid path:', requestUrl.pathname);
        return { success: false, error: 'Invalid API path' };
    }

    // Security: Method whitelist
    const allowedMethods = ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'];
    const requestMethod = (method || 'GET').toUpperCase();
    if (!allowedMethods.includes(requestMethod)) {
        console.error('[sftools] Method not allowed:', requestMethod);
        return { success: false, error: 'Method not allowed' };
    }

    console.log('[sftools] Content fetch:', requestMethod, url);

    try {
        const response = await fetch(url, {
            method: requestMethod,
            headers: headers || {},
            body: body
        });

        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data: await response.text()
        };
    } catch (err) {
        console.error('[sftools] Content fetch error:', err.message);
        return { success: false, status: 0, error: err.message };
    }
}
