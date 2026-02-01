// Chrome Extension API Mock for testing
// Simulates key Chrome APIs: storage, runtime, tabs, etc.

interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
}

interface StorageChanges {
    [key: string]: StorageChange;
}

type StorageListener = (changes: StorageChanges, areaName: string) => void;
type MessageListener = (
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
) => void;

interface ChromeMockStorage {
    [key: string]: unknown;
}

interface ChromeMock extends Omit<typeof chrome, 'runtime' | 'tabs'> {
    runtime: Omit<typeof chrome.runtime, 'sendMessage'> & {
        sendMessage: ReturnType<typeof vi.fn>;
    };
    tabs: {
        create: ReturnType<typeof vi.fn>;
        query: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
    };
    contextMenus: {
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        remove: ReturnType<typeof vi.fn>;
    };
    _reset: () => void;
    _resetListeners: () => void;
    _setStorageData: (data: ChromeMockStorage) => void;
    _getStorageData: () => ChromeMockStorage;
    _triggerMessage: (message: unknown, sender?: chrome.runtime.MessageSender) => void;
    _triggerStorageChange: (changes: StorageChanges, areaName?: string) => void;
}

/**
 * Create a fresh Chrome API mock
 */
export function createChromeMock(): ChromeMock {
    let storage: ChromeMockStorage = {};
    let storageListeners: StorageListener[] = [];
    let messageListeners: MessageListener[] = [];

    const chrome = {
        storage: {
            local: {
                get(
                    keys?: string | string[] | null,
                    callback?: (items: ChromeMockStorage) => void
                ): Promise<ChromeMockStorage> | void {
                    const result: ChromeMockStorage = {};
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

                set(items: ChromeMockStorage, callback?: () => void): Promise<void> | void {
                    const changes: StorageChanges = {};
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

                remove(keys: string | string[], callback?: () => void): Promise<void> | void {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    const changes: StorageChanges = {};
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

                clear(callback?: () => void): Promise<void> | void {
                    storage = {};
                    if (callback) {
                        callback();
                        return;
                    }
                    return Promise.resolve();
                },
            },

            onChanged: {
                addListener(callback: StorageListener): void {
                    storageListeners.push(callback);
                },
                removeListener(callback: StorageListener): void {
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
                addListener(callback: MessageListener): void {
                    messageListeners.push(callback);
                },
                removeListener(callback: MessageListener): void {
                    const index = messageListeners.indexOf(callback);
                    if (index !== -1) {
                        messageListeners.splice(index, 1);
                    }
                },
            },

            getURL(path: string): string {
                return `chrome-extension://test-extension-id/${path}`;
            },

            getManifest(): chrome.runtime.Manifest {
                return {
                    manifest_version: 3,
                    name: 'Test Extension',
                    version: '1.0.0',
                    oauth2: {
                        client_id: 'test-client-id',
                        scopes: [],
                    },
                } as chrome.runtime.Manifest;
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
        _reset(): void {
            storage = {};
            // Don't clear listeners - they're registered at module load time
            // Use _resetListeners() if you really need to clear them
            chrome.runtime.sendMessage.mockReset().mockResolvedValue({});
            chrome.tabs.create.mockReset().mockResolvedValue({ id: 1 });
            chrome.tabs.query.mockReset().mockResolvedValue([]);
        },

        _resetListeners(): void {
            storageListeners = [];
            messageListeners = [];
        },

        _setStorageData(data: ChromeMockStorage): void {
            storage = { ...data };
        },

        _getStorageData(): ChromeMockStorage {
            return { ...storage };
        },

        _triggerMessage(message: unknown, sender: chrome.runtime.MessageSender = {}): void {
            for (const listener of messageListeners) {
                listener(message, sender, () => {});
            }
        },

        _triggerStorageChange(changes: StorageChanges, areaName = 'local'): void {
            for (const listener of storageListeners) {
                listener(changes, areaName);
            }
        },
    } as ChromeMock;

    return chrome;
}

// Default mock instance
export const chromeMock = createChromeMock();
