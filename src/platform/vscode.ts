// VS Code webview implementation of the platform layer.
// Talks to the extension host (vscode/src) over postMessage using ./protocol.

import {
    isHostToWebviewEnvelope,
    OPEN_EXTERNAL,
    OPEN_FEATURE,
    OPEN_RECORD,
    RELOAD,
    SAVE_FILE,
    STORAGE_GET,
    STORAGE_REMOVE,
    STORAGE_SET,
    type HostMessage,
    type StorageChanges,
    type VsCodeBootstrap,
    type WebviewRequestEnvelope,
} from './protocol';
import type { Platform, RecordLaunchParams, StorageItems } from './types';

/** Minimal shape of the API returned by acquireVsCodeApi() */
export interface VsCodeApi {
    postMessage(message: unknown): void;
}

declare global {
    interface Window {
        acquireVsCodeApi?: () => VsCodeApi;
        __SFTOOLS_VSCODE__?: VsCodeBootstrap;
    }
}

interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
}

/**
 * Create the VS Code platform.
 * @param api - the object returned by acquireVsCodeApi() (can only be acquired once)
 * @param target - where host messages arrive (window in a webview)
 * @param bootstrap - launch data injected by the host
 */
export function createVsCodePlatform(
    api: VsCodeApi,
    target: Pick<Window, 'addEventListener'>,
    bootstrap: VsCodeBootstrap | undefined
): Platform {
    let nextId = 1;
    const pending = new Map<number, PendingRequest>();
    const messageListeners = new Set<(message: HostMessage) => void>();
    const storageListeners = new Set<(changes: StorageChanges) => void>();

    target.addEventListener('message', (event: Event) => {
        const data = (event as MessageEvent).data;
        if (!isHostToWebviewEnvelope(data)) return;

        if (data.kind === 'response') {
            const request = pending.get(data.id);
            if (!request) return;
            pending.delete(data.id);
            if (data.error !== undefined) {
                request.reject(new Error(data.error));
            } else {
                request.resolve(data.result);
            }
        } else if (data.kind === 'event') {
            for (const listener of messageListeners) listener(data.message);
        } else {
            for (const listener of storageListeners) listener(data.changes);
        }
    });

    function sendMessage<T = unknown>(message: HostMessage): Promise<T> {
        const id = nextId++;
        const envelope: WebviewRequestEnvelope = { kind: 'request', id, message };
        return new Promise<T>((resolve, reject) => {
            pending.set(id, { resolve: resolve as (value: unknown) => void, reject });
            api.postMessage(envelope);
        });
    }

    function fireAndForget(message: HostMessage): void {
        sendMessage(message).catch(error => {
            console.error(`[sftools] ${message.type} failed:`, error);
        });
    }

    return {
        kind: 'vscode',
        capabilities: {
            oauth: false,
            manageConnections: false,
            nativeProxy: false,
            builtInStreaming: true,
        },
        storage: {
            async get(keys?: string | string[] | null): Promise<StorageItems> {
                const keyList = keys == null ? null : Array.isArray(keys) ? keys : [keys];
                return (
                    (await sendMessage<StorageItems>({ type: STORAGE_GET, keys: keyList })) ?? {}
                );
            },
            async set(items: StorageItems): Promise<void> {
                await sendMessage({ type: STORAGE_SET, items });
            },
            async remove(keys: string | string[]): Promise<void> {
                await sendMessage({
                    type: STORAGE_REMOVE,
                    keys: Array.isArray(keys) ? keys : [keys],
                });
            },
            onChanged(listener: (changes: StorageChanges) => void): () => void {
                storageListeners.add(listener);
                return () => storageListeners.delete(listener);
            },
        },
        sendMessage,
        onMessage(listener: (message: HostMessage) => void): () => void {
            messageListeners.add(listener);
            return () => messageListeners.delete(listener);
        },
        openExternal(url: string): void {
            fireAndForget({ type: OPEN_EXTERNAL, url });
        },
        openFeature(featureId: string): void {
            fireAndForget({ type: OPEN_FEATURE, featureId });
        },
        openRecord(params: RecordLaunchParams): void {
            fireAndForget({ type: OPEN_RECORD, ...params });
        },
        async saveFile(filename: string, content: string, mimeType: string): Promise<void> {
            await sendMessage({ type: SAVE_FILE, filename, content, mimeType });
        },
        getLaunchParams(): URLSearchParams {
            return new URLSearchParams(bootstrap?.launchParams ?? '');
        },
        reload(): void {
            fireAndForget({ type: RELOAD });
        },
    };
}
