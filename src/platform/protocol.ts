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

/** Host -> webview: a request the webview answers (e.g. completions for a native editor). */
export interface HostRequestEnvelope {
    kind: 'hostRequest';
    id: number;
    message: HostMessage;
}

/** Webview -> host: the answer to a HostRequestEnvelope. */
export interface WebviewResponseEnvelope {
    kind: 'hostResponse';
    id: number;
    result?: unknown;
    error?: string;
}

export type HostToWebviewEnvelope =
    | HostResponseEnvelope
    | HostEventEnvelope
    | HostStorageChangedEnvelope
    | HostRequestEnvelope;

export type WebviewToHostEnvelope = WebviewRequestEnvelope | WebviewResponseEnvelope;

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

/**
 * Native editors (VS Code only). Each in-panel CodeEditor has a docId that is unique
 * within its panel; the host maps it to a VS Code document.
 */
/** Webview -> host: open (or reveal) the native document. */
export const EDITOR_OPEN = 'editor:open';
/** Webview -> host: the panel changed the content (setValue/appendValue/typing). */
export const EDITOR_UPDATE = 'editor:update';
/** Webview -> host: the in-panel editor unmounted. */
export const EDITOR_DISPOSE = 'editor:dispose';
/** Webview -> host: diagnostics for the document. */
export const EDITOR_MARKERS = 'editor:markers';
/** Host -> webview event: the native document was edited. */
export const EDITOR_CHANGED = 'editor:changed';
/** Host -> webview event: Run was pressed in the native document. */
export const EDITOR_EXECUTE = 'editor:execute';
/** Host -> webview request: completion suggestions for the native document. */
export const EDITOR_COMPLETE = 'editor:complete';

export interface EditorDocumentInfo {
    docId: string;
    /** Display name without extension, e.g. "Query" */
    name: string;
    /** File extension without dot, e.g. "soql" */
    extension: string;
    value: string;
    readonly: boolean;
    /** Reveal the editor beside the panel (true) or just register it (false) */
    reveal: boolean;
}

/**
 * Access tokens stay in the VS Code extension host (they come from the sf CLI).
 * Connections handed to the webview carry this placeholder instead; the host swaps
 * it for the real token on every request it makes.
 */
export const SF_CLI_ACCESS_TOKEN = 'sf-cli-managed-token';

/** Bootstrap data the host injects into each webview page. */
export interface VsCodeBootstrap {
    /** Query string for the page, e.g. "feature=query" or "objectType=Account&recordId=..." */
    launchParams: string;
}

export function isHostToWebviewEnvelope(data: unknown): data is HostToWebviewEnvelope {
    if (!data || typeof data !== 'object') return false;
    const kind = (data as { kind?: unknown }).kind;
    return (
        kind === 'response' ||
        kind === 'event' ||
        kind === 'storageChanged' ||
        kind === 'hostRequest'
    );
}
