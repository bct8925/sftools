// Routes webview requests to the host services. No vscode imports (unit tested).

import {
    EDITOR_DISPOSE,
    EDITOR_MARKERS,
    EDITOR_OPEN,
    EDITOR_UPDATE,
    LOGIN_ORG,
    OPEN_EXTERNAL,
    OPEN_FEATURE,
    OPEN_RECORD,
    REFRESH_ORGS,
    RELOAD,
    SAVE_FILE,
    STORAGE_GET,
    STORAGE_REMOVE,
    STORAGE_SET,
    type EditorDocumentInfo,
    type HostMessage,
} from '../../src/platform/protocol';
import type { HostHttp } from './http';
import type { OrgService } from './orgs';
import type { HostStorage } from './storage';
import type { StreamingService } from './streaming';

export interface EditorMarker {
    message: string;
    line: number;
    startColumn?: number;
    endColumn?: number;
    severity?: 'error' | 'warning' | 'info';
}

/** Actions that need the VS Code UI */
export interface HostUi {
    openExternal(url: string): Promise<void>;
    openFeature(featureId: string): void;
    openRecord(params: { objectType: string; recordId: string; connectionId: string }): void;
    saveFile(filename: string, content: string, mimeType: string): Promise<void>;
    loginOrg(options: { instanceUrl?: string; alias?: string }): Promise<void>;
    reload(panelId: string): void;
}

/** Native editor documents, per panel */
export interface HostEditors {
    open(panelId: string, info: EditorDocumentInfo): Promise<void>;
    update(panelId: string, docId: string, value: string): Promise<void>;
    close(panelId: string, docId: string): void;
    setMarkers(panelId: string, docId: string, markers: EditorMarker[]): void;
}

export interface HandlerDeps {
    storage: HostStorage;
    http: HostHttp;
    orgs: OrgService;
    streaming: StreamingService;
    ui: HostUi;
    editors: HostEditors;
}

/** Proxy status as the webview expects it; streaming is built in, so always connected */
const BUILT_IN_PROXY = { success: true, connected: true, httpPort: null, version: 'built-in' };

export type RequestHandler = (message: HostMessage, panelId: string) => Promise<unknown>;

export function createRequestHandler(deps: HandlerDeps): RequestHandler {
    const { storage, http, orgs, streaming, ui, editors } = deps;

    return async (message, panelId) => {
        switch (message.type) {
            case STORAGE_GET:
                return storage.get((message.keys as string[] | null) ?? null);
            case STORAGE_SET:
                await storage.set(message.items as Record<string, unknown>);
                return undefined;
            case STORAGE_REMOVE:
                await storage.remove(message.keys as string[]);
                return undefined;

            case 'fetch':
                return http.fetch({
                    url: message.url as string,
                    options: message.options as {
                        method?: string;
                        headers?: Record<string, string>;
                        body?: unknown;
                    },
                    connectionId: message.connectionId as string | null,
                });
            case 'proxyFetch':
                return http.fetch({
                    url: message.url as string,
                    options: {
                        method: message.method as string | undefined,
                        headers: message.headers as Record<string, string> | undefined,
                        body: message.body,
                    },
                    connectionId: message.connectionId as string | null,
                });

            case 'connectProxy':
            case 'checkProxyConnection':
            case 'getProxyInfo':
                return BUILT_IN_PROXY;
            case 'disconnectProxy':
                return { success: true };

            case 'subscribe':
                return streaming.subscribe(message, panelId);
            case 'unsubscribe':
                return streaming.unsubscribe(message);
            case 'getTopic':
                return streaming.getTopic(message);
            case 'getSchema':
                return streaming.getSchema(message);

            case OPEN_EXTERNAL:
                await ui.openExternal(message.url as string);
                return undefined;
            case OPEN_FEATURE:
                ui.openFeature(message.featureId as string);
                return undefined;
            case OPEN_RECORD:
                ui.openRecord({
                    objectType: message.objectType as string,
                    recordId: message.recordId as string,
                    connectionId: message.connectionId as string,
                });
                return undefined;
            case SAVE_FILE:
                await ui.saveFile(
                    message.filename as string,
                    message.content as string,
                    message.mimeType as string
                );
                return undefined;
            case RELOAD:
                ui.reload(panelId);
                return undefined;

            case LOGIN_ORG:
                await ui.loginOrg({
                    instanceUrl: (message.loginUrl as string | undefined) || undefined,
                    alias: (message.alias as string | undefined) || undefined,
                });
                return { success: true };
            case REFRESH_ORGS: {
                const list = await orgs.refresh();
                await storage.emitConnectionsChanged();
                return {
                    success: !orgs.getLastError(),
                    count: list.length,
                    error: orgs.getLastError(),
                };
            }

            case EDITOR_OPEN:
                await editors.open(panelId, message as unknown as EditorDocumentInfo);
                return undefined;
            case EDITOR_UPDATE:
                await editors.update(panelId, message.docId as string, message.value as string);
                return undefined;
            case EDITOR_DISPOSE:
                editors.close(panelId, message.docId as string);
                return undefined;
            case EDITOR_MARKERS:
                editors.setMarkers(
                    panelId,
                    message.docId as string,
                    (message.markers as EditorMarker[]) ?? []
                );
                return undefined;

            default:
                throw new Error(`Unknown request: ${message.type}`);
        }
    };
}
