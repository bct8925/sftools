// Chrome Extension API Mock for testing
// Simulates key Chrome APIs: storage, runtime, tabs, etc.

/**
 * Create a fresh Chrome API mock
 */
export function createChromeMock() {
    let storage = {};
    let storageListeners = [];
    let messageListeners = [];

    const chrome = {
        storage: {
            local: {
                get(keys, callback) {
                    const result = {};
                    const keyList = Array.isArray(keys)
                        ? keys
                        : keys
                          ? [keys]
                          : Object.keys(storage);
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
                    // Notify listeners
                    for (const listener of storageListeners) {
                        listener(changes, 'local');
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
                    // Notify listeners
                    for (const listener of storageListeners) {
                        listener(changes, 'local');
                    }
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                },

                clear(callback) {
                    storage = {};
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                },
            },

            onChanged: {
                addListener(callback) {
                    storageListeners.push(callback);
                },
                removeListener(callback) {
                    const index = storageListeners.indexOf(callback);
                    if (index !== -1) {
                        storageListeners.splice(index, 1);
                    }
                },
            },
        },

        runtime: {
            sendMessage: vi.fn().mockResolvedValue({}),

            onMessage: {
                addListener(callback) {
                    messageListeners.push(callback);
                },
                removeListener(callback) {
                    const index = messageListeners.indexOf(callback);
                    if (index !== -1) {
                        messageListeners.splice(index, 1);
                    }
                },
            },

            getURL(path) {
                return `chrome-extension://test-extension-id/${path}`;
            },

            getManifest() {
                return {
                    oauth2: {
                        client_id: 'test-client-id',
                    },
                };
            },

            id: 'test-extension-id',
        },

        tabs: {
            create: vi.fn().mockResolvedValue({ id: 1 }),
            query: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue({}),
        },

        contextMenus: {
            create: vi.fn(),
            update: vi.fn(),
            remove: vi.fn(),
        },

        // Test helpers (not part of real Chrome API)
        _reset() {
            storage = {};
            storageListeners = [];
            messageListeners = [];
            chrome.runtime.sendMessage.mockReset().mockResolvedValue({});
            chrome.tabs.create.mockReset().mockResolvedValue({ id: 1 });
            chrome.tabs.query.mockReset().mockResolvedValue([]);
        },

        _setStorageData(data) {
            storage = { ...data };
        },

        _getStorageData() {
            return { ...storage };
        },

        _triggerMessage(message, sender = {}) {
            for (const listener of messageListeners) {
                listener(message, sender, () => {});
            }
        },

        _triggerStorageChange(changes, areaName = 'local') {
            for (const listener of storageListeners) {
                listener(changes, areaName);
            }
        },
    };

    return chrome;
}

// Default mock instance
export const chromeMock = createChromeMock();
