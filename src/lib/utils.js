// Shared utilities for sftools

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
