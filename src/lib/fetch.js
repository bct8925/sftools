// Fetch routing and proxy connection utilities

import { getActiveConnectionId, triggerAuthExpired } from './auth.js';

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
        console.log('[proxyFetch]', options.method || 'GET', url);

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
 * Smart fetch: uses proxy if available, falls back to extensionFetch
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @returns {Promise<object>} - Response object
 */
export async function smartFetch(url, options = {}) {
    if (PROXY_CONNECTED) {
        return await proxyFetch(url, options);
    }
    return await extensionFetch(url, options);
}
