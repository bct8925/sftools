// Platform abstraction: everything the shared UI needs from its host
// (Chrome extension or VS Code extension).

import type { HostMessage, StorageChanges } from './protocol';

export type PlatformKind = 'chrome' | 'vscode';

export type StorageItems = Record<string, unknown>;

export interface PlatformStorage {
    /** Read keys (all keys when omitted or null). Missing keys are absent from the result. */
    get(keys?: string | string[] | null): Promise<StorageItems>;
    set(items: StorageItems): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
    /** Subscribe to storage changes. Returns an unsubscribe function. */
    onChanged(listener: (changes: StorageChanges) => void): () => void;
}

export interface OpenExternalOptions {
    systemBrowser?: boolean;
}

export interface RecordLaunchParams {
    objectType: string;
    recordId: string;
    connectionId: string;
}

export interface PlatformCapabilities {
    /** sftools runs its own OAuth flow and stores tokens (Chrome). */
    oauth: boolean;
    /** Connections can be added, edited and deleted in Settings (Chrome). */
    manageConnections: boolean;
    /** The native-messaging proxy exists and can be configured (Chrome). */
    nativeProxy: boolean;
    /** Streaming (gRPC/CometD) works without any proxy (VS Code). */
    builtInStreaming: boolean;
}

export interface Platform {
    kind: PlatformKind;
    capabilities: PlatformCapabilities;
    storage: PlatformStorage;
    /** Send a request to the host (Chrome background / VS Code extension host). */
    sendMessage<T = unknown>(message: HostMessage): Promise<T>;
    /** Listen for unsolicited host messages. Returns an unsubscribe function. */
    onMessage(listener: (message: HostMessage) => void): () => void;
    /** Open a URL (e.g. a Salesforce org) in the user's browser. */
    /** systemBrowser: VS Code only, skip the integrated browser (e.g. on Cmd/Ctrl-click) */
    openExternal(url: string, options?: OpenExternalOptions): void;
    /** Open an sftools feature (or settings) in a new tab / panel. */
    openFeature(featureId: string): void;
    /** Open the Record Viewer for a record. */
    openRecord(params: RecordLaunchParams): void;
    /** Save text content to a file chosen by the user (download in Chrome). */
    saveFile(filename: string, content: string, mimeType: string): Promise<void>;
    /** Parameters this page was launched with (feature, record, ...). */
    getLaunchParams(): URLSearchParams;
    /** Reload the current page. */
    reload(): void;
}
