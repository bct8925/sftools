// Chrome extension implementation of the platform layer.
// Every call reads the `chrome` global at call time so test mocks installed
// after import still apply.

import type { HostMessage, StorageChanges } from './protocol';
import type { Platform, PlatformStorage, RecordLaunchParams, StorageItems } from './types';

const storage: PlatformStorage = {
    async get(keys?: string | string[] | null): Promise<StorageItems> {
        return (await chrome.storage.local.get(keys ?? null)) as StorageItems;
    },
    async set(items: StorageItems): Promise<void> {
        await chrome.storage.local.set(items);
    },
    async remove(keys: string | string[]): Promise<void> {
        await chrome.storage.local.remove(keys);
    },
    onChanged(listener: (changes: StorageChanges) => void): () => void {
        if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return () => {};
        const handler = (
            changes: { [key: string]: chrome.storage.StorageChange },
            area: string
        ) => {
            if (area === 'local') listener(changes as StorageChanges);
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    },
};

/**
 * Trigger a browser download of text content.
 * Runs synchronously so callers that don't await still download immediately.
 */
function downloadText(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const chromePlatform: Platform = {
    kind: 'chrome',
    capabilities: {
        oauth: true,
        manageConnections: true,
        nativeProxy: true,
        builtInStreaming: false,
    },
    storage,

    sendMessage<T = unknown>(message: HostMessage): Promise<T> {
        return chrome.runtime.sendMessage(message) as Promise<T>;
    },

    onMessage(listener: (message: HostMessage) => void): () => void {
        if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return () => {};
        const handler = (message: HostMessage) => {
            listener(message);
        };
        chrome.runtime.onMessage.addListener(handler);
        return () => chrome.runtime.onMessage.removeListener(handler);
    },

    openExternal(url: string): void {
        chrome.tabs.create({ url });
    },

    openFeature(featureId: string): void {
        chrome.tabs.create({
            url: chrome.runtime.getURL(`dist/pages/app/app.html?feature=${featureId}`),
        });
    },

    openRecord({ objectType, recordId, connectionId }: RecordLaunchParams): void {
        const query = new URLSearchParams({ objectType, recordId, connectionId }).toString();
        chrome.tabs.create({
            url: chrome.runtime.getURL(`dist/pages/record/record.html?${query}`),
        });
    },

    saveFile(filename: string, content: string, mimeType: string): Promise<void> {
        downloadText(filename, content, mimeType);
        return Promise.resolve();
    },

    getLaunchParams(): URLSearchParams {
        return new URLSearchParams(window.location.search);
    },

    reload(): void {
        window.location.reload();
    },
};
