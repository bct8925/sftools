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

export type WebviewToHostEnvelope = WebviewRequestEnvelope;

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
 * Monaco editors in the VS Code webview take their look and suggestions from VS Code.
 * All three are webview -> host requests.
 */
/** Token colors: the active VS Code theme, or sftools light/dark (EditorThemeRequest). Answers EditorThemeInfo. */
export const EDITOR_THEME = 'editor:theme';
/** A TextMate grammar, for an editor language or by scope name. Answers EditorGrammarInfo | null. */
export const EDITOR_GRAMMAR = 'editor:grammar';
/** Suggestions from VS Code's completion providers. Answers CompletionSuggestion[]. */
export const EDITOR_COMPLETE = 'editor:complete';
/** Host -> webview event: the color theme changed; ask for EDITOR_THEME again. */
export const EDITOR_THEME_CHANGED = 'editor:themeChanged';

/** One TextMate theme rule, as in a VS Code theme's tokenColors. */
export interface TokenColorRule {
    name?: string;
    scope?: string | string[];
    settings: { foreground?: string; background?: string; fontStyle?: string };
}

export interface EditorThemeInfo {
    /** Theme name as VS Code shows it, if found */
    name?: string;
    tokenColors: TokenColorRule[];
}

export interface EditorGrammarInfo {
    scopeName: string;
    /** File name of the grammar; its extension tells JSON from plist */
    fileName: string;
    content: string;
    /** Scopes of grammars that inject into this one */
    injections: string[];
}

export interface EditorThemeRequest {
    type: typeof EDITOR_THEME;
    /**
     * Omitted: the active VS Code theme, with the user's token color customizations.
     * light/dark: sftools' own editor colors (VS Code's built-in Visual Studio
     * Light/Dark themes, which Monaco's own vs/vs-dark themes come from).
     */
    variant?: 'light' | 'dark';
}

export interface EditorGrammarRequest {
    type: typeof EDITOR_GRAMMAR;
    /** sftools editor language (CodeEditorLanguage, e.g. "sql" for SOQL); the host picks the VS Code language */
    language?: string;
    scopeName?: string;
}

export interface EditorCompleteRequest {
    type: typeof EDITOR_COMPLETE;
    /** sftools editor language (CodeEditorLanguage); the host picks the VS Code language */
    language: string;
    text: string;
    offset: number;
    triggerCharacter?: string;
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
    return kind === 'response' || kind === 'event' || kind === 'storageChanged';
}
