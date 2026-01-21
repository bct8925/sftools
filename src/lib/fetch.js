// Fetch routing and proxy connection utilities

import { getActiveConnectionId, getInstanceUrl, triggerAuthExpired } from './auth.js';
import { debugInfo } from './debug.js';

// --- Proxy Connection State ---
let PROXY_CONNECTED = false;

export function isProxyConnected() {
    return PROXY_CONNECTED;
}

/**
 * Check and update proxy connection status
 * @returns {Promise<boolean>} - Whether proxy is connected
 */
export async function checkProxyStatus() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'checkProxyConnection' });
            PROXY_CONNECTED = response.connected;
            return PROXY_CONNECTED;
        } catch (err) {
            console.error('Error checking proxy status:', err);
            PROXY_CONNECTED = false;
            return false;
        }
    }
    return false;
}

/**
 * Helper to handle auth expiration from background responses
 * @param {object} response - Background response
 * @param {string} connectionId - Connection ID used for the request
 * @returns {object} - Same response object
 */
function handleAuthExpired(response, connectionId) {
    if (response.authExpired) {
        triggerAuthExpired(response.connectionId || connectionId, response.error);
    }
    return response;
}

/**
 * Background fetch proxy (uses Chrome extension fetch to bypass CORS)
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {string|null} connectionId - Optional connection ID
 * @returns {Promise<object>} - Response object
 */
export async function extensionFetch(url, options = {}, connectionId = null) {
    const connId = connectionId || getActiveConnectionId();
    const response = await chrome.runtime.sendMessage({
        type: 'fetch',
        url,
        options,
        connectionId: connId
    });
    return handleAuthExpired(response, connId);
}

/**
 * Fetch via native proxy (bypasses all CORS restrictions)
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options (method, headers, body)
 * @returns {Promise<object>} - Response object
 */
export async function proxyFetch(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        const connId = getActiveConnectionId();
        debugInfo('[proxyFetch]', options.method || 'GET', url);

        const response = await chrome.runtime.sendMessage({
            type: 'proxyFetch',
            url,
            method: options.method,
            headers: options.headers,
            body: options.body,
            connectionId: connId
        });

        return handleAuthExpired(response, connId);
    }
    throw new Error('Proxy fetch requires extension context');
}

/**
 * Fetch via content script in active Salesforce tab
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {string|null} connectionId - Optional connection ID
 * @returns {Promise<object>} - Response object
 */
export async function contentFetch(url, options = {}, connectionId = null) {
    const connId = connectionId || getActiveConnectionId();
    const instanceUrl = getInstanceUrl();  // Get active connection's instance URL

    debugInfo('[contentFetch]', options.method || 'GET', url);

    const response = await chrome.runtime.sendMessage({
        type: 'contentFetch',
        url,
        options,
        instanceUrl,
        connectionId: connId
    });

    return handleAuthExpired(response, connId);
}

/**
 * Smart fetch: uses proxy if available, tries content script, falls back to extensionFetch
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - Response object
 */
export async function smartFetch(url, options = {}) {
    // 1. Proxy is best - no CORS issues
    if (PROXY_CONNECTED) {
        debugInfo('[smartFetch] Using proxy');
        return await proxyFetch(url, options);
    }

    // 2. Try content script if available
    debugInfo('[smartFetch] Trying content script');
    const contentResponse = await contentFetch(url, options);

    // If content script succeeded OR failed for non-tab reasons, return response
    if (contentResponse.success || !contentResponse.noTab) {
        debugInfo('[smartFetch] Content script result:', contentResponse.success ? 'success' : 'failed');
        return contentResponse;
    }

    // 3. Fall back to extension fetch (may hit CORS)
    debugInfo('[smartFetch] Content script unavailable, falling back to extensionFetch');
    return await extensionFetch(url, options);
}
