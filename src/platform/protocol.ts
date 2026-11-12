// Message protocol shared by the VS Code webview (src/platform/vscode.ts)
// and the VS Code extension host (vscode/src). Chrome does not use it.

/** A request from the UI to its host. `type` matches the Chrome background message types. */
export interface HostMessage {
    type: string;
    [key: string]: unknown;
}

export interface StorageChange {
    oldValue?: unknown;
    newValue?: unknown;
}

export type StorageChanges = Record<string, StorageChange>;

/** Webview -> host: a request that expects exactly one response. */
export interface WebviewRequestEnvelope {
    kind: 'request';
    id: number;
    message: HostMessage;
}

/** Host -> webview: the answer to a request. */
export interface HostResponseEnvelope {
    kind: 'response';
    id: number;
    result?: unknown;
    error?: string;
}

/** Host -> webview: an unsolicited message (stream events, auth expiry). */
export interface HostEventEnvelope {
    kind: 'event';
    message: HostMessage;
}

/** Host -> webview: storage changed (by another panel or by the host itself). */
export interface HostStorageChangedEnvelope {
    kind: 'storageChanged';
    changes: StorageChanges;
}

export type HostToWebviewEnvelope =
    | HostResponseEnvelope
    | HostEventEnvelope
    | HostStorageChangedEnvelope;

/** Response to a `subscribe` message (streaming). */
export interface SubscribeResponse {
    success: boolean;
    subscriptionId?: string;
    error?: string;
}

/** Storage message types handled by the VS Code host. */
export const STORAGE_GET = 'storage:get';
export const STORAGE_SET = 'storage:set';
export const STORAGE_REMOVE = 'storage:remove';

/** UI actions handled by the VS Code host. */
export const OPEN_EXTERNAL = 'host:openExternal';
export const OPEN_FEATURE = 'host:openFeature';
export const OPEN_RECORD = 'host:openRecord';
export const SAVE_FILE = 'host:saveFile';
export const LOGIN_ORG = 'host:loginOrg';
export const REFRESH_ORGS = 'host:refreshOrgs';
export const RELOAD = 'host:reload';

/** Bootstrap data the host injects into each webview page. */
export interface VsCodeBootstrap {
    /** Query string for the page, e.g. "feature=query" or "objectType=Account&recordId=..." */
    launchParams: string;
}

export function isHostToWebviewEnvelope(data: unknown): data is HostToWebviewEnvelope {
    if (!data || typeof data !== 'object') return false;
    const kind = (data as { kind?: unknown }).kind;
    return kind === 'response' || kind === 'event' || kind === 'storageChanged';
}
