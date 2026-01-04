// Shared utilities for sftools

// --- API Configuration ---
export const API_VERSION = '62.0';

// --- Global Auth State ---
let ACCESS_TOKEN = '';
let INSTANCE_URL = '';

export function getAccessToken() {
    return ACCESS_TOKEN;
}

export function getInstanceUrl() {
    return INSTANCE_URL;
}

export function isAuthenticated() {
    return ACCESS_TOKEN && INSTANCE_URL;
}

// --- Auth Token Loading ---
export function loadAuthTokens() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['accessToken', 'instanceUrl'], function(data) {
                if (data.accessToken && data.instanceUrl) {
                    ACCESS_TOKEN = data.accessToken;
                    INSTANCE_URL = data.instanceUrl;
                    console.log('Loaded auth for instance:', INSTANCE_URL);
                    resolve(true);
                } else {
                    console.log('No auth tokens found. Please authorize via popup.');
                    resolve(false);
                }
            });
        } else {
            resolve(false);
        }
    });
}

// --- Background Fetch Proxy ---
export async function extensionFetch(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({ type: 'fetch', url, options });
    }
    // Fallback for development without extension context
    const response = await fetch(url, options);
    const data = await response.text();
    return { success: response.ok, status: response.status, statusText: response.statusText, data };
}

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
 * Fetch via native proxy (bypasses all CORS restrictions)
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options (method, headers, body)
 * @returns {Promise<object>} - Response object
 */
export async function proxyFetch(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({
            type: 'proxyFetch',
            url,
            method: options.method,
            headers: options.headers,
            body: options.body
        });
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

// --- Salesforce API Request Helper ---

/**
 * Make an authenticated Salesforce REST API request
 * Handles URL building, headers, and error parsing
 */
export async function salesforceRequest(endpoint, options = {}) {
    const url = `${getInstanceUrl()}${endpoint}`;
    const response = await extensionFetch(url, {
        method: options.method || 'GET',
        headers: {
            'Authorization': `Bearer ${getAccessToken()}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...options.headers
        },
        body: options.body
    });

    if (!response.success && response.status !== 404) {
        const error = response.data ? JSON.parse(response.data) : { message: response.statusText };
        throw new Error(error[0]?.message || error.message || 'Request failed');
    }

    return {
        ...response,
        json: response.data ? JSON.parse(response.data) : null
    };
}
