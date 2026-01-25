/**
 * Browser-Injectable Chrome Mock
 *
 * Creates a JavaScript string that can be injected via Playwright's addInitScript().
 * This code runs BEFORE any page scripts, ensuring chrome.* APIs are available
 * when modules like auth.ts, theme.ts, and contexts initialize.
 *
 * Used for headless frontend testing where we load pages directly instead of
 * as a Chrome extension.
 */

export interface ChromeMockInitialState {
    storage?: Record<string, unknown>;
}

/**
 * Test extension ID used to detect headless test mode.
 * Code can check `chrome.runtime.id === 'test-extension-id'` to determine
 * if it's running in test mode vs real extension context.
 */
export const TEST_EXTENSION_ID = 'test-extension-id';

/**
 * Returns JavaScript code string to inject into browser context via addInitScript().
 *
 * @param initialState - Optional initial state for storage
 * @returns JavaScript code string to execute in browser
 */
export function createChromeMockScript(initialState?: ChromeMockInitialState): string {
    const storageJson = JSON.stringify(initialState?.storage || {});

    return `
(function() {
    // In-memory storage
    const storage = ${storageJson};
    const storageListeners = [];
    const messageListeners = [];

    window.chrome = {
        storage: {
            local: {
                get(keys, callback) {
                    const result = {};
                    let keyList;
                    if (keys === null || keys === undefined) {
                        keyList = Object.keys(storage);
                    } else if (typeof keys === 'string') {
                        keyList = [keys];
                    } else if (Array.isArray(keys)) {
                        keyList = keys;
                    } else if (typeof keys === 'object') {
                        // Object with default values
                        keyList = Object.keys(keys);
                        for (const key of keyList) {
                            result[key] = keys[key]; // Set defaults
                        }
                    } else {
                        keyList = [];
                    }

                    for (const key of keyList) {
                        if (storage[key] !== undefined) {
                            result[key] = storage[key];
                        }
                    }

                    if (callback) {
                        callback(result);
                        return;
                    }
                    return Promise.resolve(result);
                },

                set(items, callback) {
                    const changes = {};
                    for (const [key, value] of Object.entries(items)) {
                        const oldValue = storage[key];
                        storage[key] = value;
                        changes[key] = { oldValue, newValue: value };
                    }

                    // Trigger onChanged listeners
                    for (const listener of storageListeners) {
                        try {
                            listener(changes, 'local');
                        } catch (e) {
                            console.error('[Chrome Mock] Storage listener error:', e);
                        }
                    }

                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                },

                remove(keys, callback) {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    const changes = {};

                    for (const key of keyList) {
                        if (storage[key] !== undefined) {
                            changes[key] = { oldValue: storage[key], newValue: undefined };
                            delete storage[key];
                        }
                    }

                    for (const listener of storageListeners) {
                        try {
                            listener(changes, 'local');
                        } catch (e) {
                            console.error('[Chrome Mock] Storage listener error:', e);
                        }
                    }

                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                },

                clear(callback) {
                    const changes = {};
                    for (const key of Object.keys(storage)) {
                        changes[key] = { oldValue: storage[key], newValue: undefined };
                        delete storage[key];
                    }

                    for (const listener of storageListeners) {
                        try {
                            listener(changes, 'local');
                        } catch (e) {
                            console.error('[Chrome Mock] Storage listener error:', e);
                        }
                    }

                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                }
            },

            onChanged: {
                addListener(callback) {
                    storageListeners.push(callback);
                },
                removeListener(callback) {
                    const idx = storageListeners.indexOf(callback);
                    if (idx !== -1) {
                        storageListeners.splice(idx, 1);
                    }
                },
                hasListener(callback) {
                    return storageListeners.includes(callback);
                }
            }
        },

        runtime: {
            // Test extension ID - code can check this to detect test mode
            id: '${TEST_EXTENSION_ID}',

            sendMessage(message) {
                // In headless test mode, we don't have a background script.
                // Return mock responses that signal code should use direct fetch.
                const handlers = {
                    'fetch': () => {
                        // Signal that fetch should use direct network
                        // (MockRouter intercepts at network level)
                        return { success: false, error: '__USE_DIRECT_FETCH__' };
                    },
                    'proxyFetch': () => {
                        return { success: false, error: '__USE_DIRECT_FETCH__' };
                    },
                    'checkProxyConnection': () => {
                        // Check if test has overridden proxy status
                        const testProxyStatus = window.__testProxyConnected;
                        const connected = testProxyStatus !== undefined ? testProxyStatus : true;
                        return { connected };
                    },
                    'connectProxy': () => ({
                        success: false,
                        error: 'Proxy not available in test mode'
                    }),
                    'disconnectProxy': () => ({}),
                    'tokenExchange': () => ({
                        success: false,
                        error: 'Token exchange not available in test mode'
                    })
                };

                const handler = handlers[message.type];
                return Promise.resolve(handler ? handler() : {});
            },

            onMessage: {
                addListener(callback) {
                    messageListeners.push(callback);
                },
                removeListener(callback) {
                    const idx = messageListeners.indexOf(callback);
                    if (idx !== -1) {
                        messageListeners.splice(idx, 1);
                    }
                },
                hasListener(callback) {
                    return messageListeners.includes(callback);
                }
            },

            getManifest() {
                return {
                    manifest_version: 3,
                    name: 'sftools Test Mode',
                    version: '1.0.0',
                    oauth2: {
                        client_id: 'test-client-id',
                        scopes: []
                    }
                };
            },

            getURL(path) {
                // In test mode, return path as-is (relative to Vite server)
                if (path.startsWith('/')) {
                    return path;
                }
                return '/' + path;
            }
        }
    };

    // Expose test helpers for test code to manipulate mock state
    window.__chromeMock = {
        storage,

        setStorage(data) {
            Object.assign(storage, data);
        },

        getStorage() {
            return { ...storage };
        },

        clearStorage() {
            for (const key of Object.keys(storage)) {
                delete storage[key];
            }
        },

        triggerStorageChange(changes) {
            for (const listener of storageListeners) {
                try {
                    listener(changes, 'local');
                } catch (e) {
                    console.error('[Chrome Mock] Storage listener error:', e);
                }
            }
        },

        triggerMessage(message, sender = {}) {
            for (const listener of messageListeners) {
                try {
                    listener(message, sender, () => {});
                } catch (e) {
                    console.error('[Chrome Mock] Message listener error:', e);
                }
            }
        },

        setProxyConnected(connected) {
            window.__testProxyConnected = connected;
        }
    };

    console.log('[Chrome Mock] Initialized with storage keys:', Object.keys(storage));
})();
`;
}

/**
 * TypeScript interface for the window.__chromeMock helper object.
 * This is available in browser context after mock injection.
 */
export interface ChromeMockHelper {
    storage: Record<string, unknown>;
    setStorage(data: Record<string, unknown>): void;
    getStorage(): Record<string, unknown>;
    clearStorage(): void;
    triggerStorageChange(changes: Record<string, { oldValue?: unknown; newValue?: unknown }>): void;
    triggerMessage(message: unknown, sender?: unknown): void;
    setProxyConnected(connected: boolean): void;
}

declare global {
    interface Window {
        __chromeMock?: ChromeMockHelper;
        __testProxyConnected?: boolean;
    }
}
