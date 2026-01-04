// Frontend Auth Module for sftools
// Used by content scripts (app.js, etc.) - NOT the service worker

// --- Constants ---
export const STORAGE_KEYS = {
    ACCESS_TOKEN: 'accessToken',
    REFRESH_TOKEN: 'refreshToken',
    INSTANCE_URL: 'instanceUrl',
    LOGIN_DOMAIN: 'loginDomain'
};

export const CALLBACK_URL = 'https://sftools.dev/sftools-callback';

// --- Frontend Auth State ---
// These are used by content scripts to access tokens without async calls

let ACCESS_TOKEN = '';
let INSTANCE_URL = '';
let authExpiredCallback = null;

export function getAccessToken() {
    return ACCESS_TOKEN;
}

export function getInstanceUrl() {
    return INSTANCE_URL;
}

export function isAuthenticated() {
    return ACCESS_TOKEN && INSTANCE_URL;
}

/**
 * Register a callback to be called when auth expires
 * @param {Function} callback - Function to call when auth expires
 */
export function onAuthExpired(callback) {
    authExpiredCallback = callback;
}

/**
 * Trigger auth expiration callback and clear local state
 * Called when authExpired message is received or extensionFetch returns authExpired
 */
export function triggerAuthExpired() {
    ACCESS_TOKEN = '';
    INSTANCE_URL = '';
    if (authExpiredCallback) {
        authExpiredCallback();
    }
}

/**
 * Load auth tokens from storage into module state
 * @returns {Promise<boolean>} - Whether tokens were loaded successfully
 */
export function loadAuthTokens() {
    return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get([STORAGE_KEYS.ACCESS_TOKEN, STORAGE_KEYS.INSTANCE_URL], function(data) {
                if (data[STORAGE_KEYS.ACCESS_TOKEN] && data[STORAGE_KEYS.INSTANCE_URL]) {
                    ACCESS_TOKEN = data[STORAGE_KEYS.ACCESS_TOKEN];
                    INSTANCE_URL = data[STORAGE_KEYS.INSTANCE_URL];
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

// Listen for auth expiration broadcasts from background
if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'authExpired') {
            triggerAuthExpired();
        }
    });
}

// Listen for storage changes (e.g., token refresh from background)
if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;

        if (changes[STORAGE_KEYS.ACCESS_TOKEN]?.newValue) {
            ACCESS_TOKEN = changes[STORAGE_KEYS.ACCESS_TOKEN].newValue;
            console.log('Access token updated from storage');
        }

        if (changes[STORAGE_KEYS.INSTANCE_URL]?.newValue) {
            INSTANCE_URL = changes[STORAGE_KEYS.INSTANCE_URL].newValue;
        }
    });
}
