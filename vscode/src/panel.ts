// Webview panels that host the sftools React pages.

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import {
    type HostMessage,
    type HostToWebviewEnvelope,
    type StorageChanges,
    type WebviewToHostEnvelope,
} from '../../src/platform/protocol';
import type { RequestHandler } from './handlers';
import { buildWebviewHtml } from './webview-html';

export type PageName = 'app' | 'record';

interface PanelEntry {
    id: string;
    page: PageName;
    launchParams: string;
    webview: vscode.Webview;
    /** Editor column of a panel; undefined for the side bar view */
    viewColumn(): vscode.ViewColumn | undefined;
    dispose(): void;
    pendingHostRequests: Map<number, (envelope: { result?: unknown; error?: string }) => void>;
}

export interface OpenPanelOptions {
    page: PageName;
    launchParams: string;
    title: string;
    viewColumn?: vscode.ViewColumn;
}

export class PanelManager implements vscode.Disposable {
    private readonly panels = new Map<string, PanelEntry>();
    private nextPanel = 1;
    private nextHostRequest = 1;
    private handler: RequestHandler | null = null;
    private readonly closeListeners = new Set<(panelId: string) => void>();

    constructor(private readonly extensionUri: vscode.Uri) {}

    setRequestHandler(handler: RequestHandler): void {
        this.handler = handler;
    }

    onDidClose(listener: (panelId: string) => void): void {
        this.closeListeners.add(listener);
    }

    open(options: OpenPanelOptions): string {
        const panel = vscode.window.createWebviewPanel(
            'sftools',
            options.title,
            options.viewColumn ?? vscode.ViewColumn.Active,
            { ...this.webviewOptions(), retainContextWhenHidden: true }
        );
        panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png');
        return this.attach(options, panel.webview, {
            viewColumn: () => panel.viewColumn,
            dispose: () => panel.dispose(),
            onDidDispose: listener => panel.onDidDispose(listener),
        });
    }

    /** Host sftools in the side bar view, like the Chrome side panel */
    attachView(view: vscode.WebviewView, options: Omit<OpenPanelOptions, 'title'>): string {
        view.webview.options = this.webviewOptions();
        return this.attach(options, view.webview, {
            viewColumn: () => undefined,
            dispose: () => undefined,
            onDidDispose: listener => view.onDidDispose(listener),
        });
    }

    private webviewOptions(): vscode.WebviewOptions {
        return {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview')],
        };
    }

    private attach(
        options: Pick<OpenPanelOptions, 'page' | 'launchParams'>,
        webview: vscode.Webview,
        host: {
            viewColumn(): vscode.ViewColumn | undefined;
            dispose(): void;
            onDidDispose(listener: () => void): vscode.Disposable;
        }
    ): string {
        const id = `panel-${this.nextPanel++}`;
        const entry: PanelEntry = {
            id,
            page: options.page,
            launchParams: options.launchParams,
            webview,
            viewColumn: host.viewColumn,
            dispose: host.dispose,
            pendingHostRequests: new Map(),
        };
        this.panels.set(id, entry);

        webview.onDidReceiveMessage(data => this.onMessage(entry, data));
        host.onDidDispose(() => {
            this.panels.delete(id);
            for (const pending of entry.pendingHostRequests.values()) {
                pending({ error: 'Panel closed' });
            }
            for (const listener of this.closeListeners) listener(id);
        });

        void this.render(entry);
        return id;
    }

    reload(panelId: string): void {
        const entry = this.panels.get(panelId);
        if (entry) void this.render(entry);
    }

    /** Reveal the panel's column so native editors can open beside it */
    getViewColumn(panelId: string): vscode.ViewColumn | undefined {
        return this.panels.get(panelId)?.viewColumn();
    }

    postEvent(panelId: string, message: HostMessage): void {
        this.post(panelId, { kind: 'event', message });
    }

    broadcastStorage(changes: StorageChanges): void {
        for (const id of this.panels.keys()) {
            this.post(id, { kind: 'storageChanged', changes });
        }
    }

    broadcastEvent(message: HostMessage): void {
        for (const id of this.panels.keys()) this.postEvent(id, message);
    }

    /** Ask a panel for something (e.g. completions); resolves with its answer */
    request<T>(panelId: string, message: HostMessage, timeoutMs = 5000): Promise<T> {
        const entry = this.panels.get(panelId);
        if (!entry) return Promise.reject(new Error('Panel closed'));
        const id = this.nextHostRequest++;
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                entry.pendingHostRequests.delete(id);
                reject(new Error('Panel did not answer'));
            }, timeoutMs);
            entry.pendingHostRequests.set(id, envelope => {
                clearTimeout(timer);
                entry.pendingHostRequests.delete(id);
                if (envelope.error !== undefined) reject(new Error(envelope.error));
                else resolve(envelope.result as T);
            });
            this.post(panelId, { kind: 'hostRequest', id, message });
        });
    }

    dispose(): void {
        for (const entry of [...this.panels.values()]) entry.dispose();
    }

    private post(panelId: string, envelope: HostToWebviewEnvelope): void {
        void this.panels.get(panelId)?.webview.postMessage(envelope);
    }

    private async onMessage(entry: PanelEntry, data: unknown): Promise<void> {
        const envelope = data as WebviewToHostEnvelope;
        if (!envelope || typeof envelope !== 'object') return;

        if (envelope.kind === 'hostResponse') {
            entry.pendingHostRequests.get(envelope.id)?.(envelope);
            return;
        }
        if (envelope.kind !== 'request' || !this.handler) return;

        try {
            const result = await this.handler(envelope.message, entry.id);
            this.post(entry.id, { kind: 'response', id: envelope.id, result });
        } catch (error) {
            this.post(entry.id, {
                kind: 'response',
                id: envelope.id,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    private async render(entry: PanelEntry): Promise<void> {
        const pageDir = vscode.Uri.joinPath(
            this.extensionUri,
            'dist',
            'webview',
            'pages',
            entry.page
        );
        const htmlBytes = await vscode.workspace.fs.readFile(
            vscode.Uri.joinPath(pageDir, `${entry.page}.html`)
        );
        const webview = entry.webview;
        webview.html = buildWebviewHtml({
            html: Buffer.from(htmlBytes).toString('utf8'),
            baseUri: `${webview.asWebviewUri(pageDir).toString()}/`,
            cspSource: webview.cspSource,
            nonce: randomBytes(16).toString('base64'),
            bootstrap: { launchParams: entry.launchParams },
        });
    }
}
