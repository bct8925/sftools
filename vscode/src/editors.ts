// Native VS Code documents for the panels' code editors (Query, Apex, REST body, logs...).
// Documents live in an in-memory file system (scheme "sftools") and stay in sync with
// the panel that owns them. Completions are answered by the panel, so the SOQL and
// formula logic is shared with the Chrome extension.

import * as vscode from 'vscode';
import {
    EDITOR_CHANGED,
    EDITOR_COMPLETE,
    EDITOR_EXECUTE,
    type EditorDocumentInfo,
} from '../../src/platform/protocol';
import type { CompletionKind, CompletionSuggestion } from '../../src/lib/completion';
import type { EditorMarker, HostEditors } from './handlers';
import type { PanelManager } from './panel';

export const SCHEME = 'sftools';
const RUNNABLE_CONTEXT = 'sftools.runnableEditor';

interface DocEntry {
    panelId: string;
    docId: string;
    uri: vscode.Uri;
    readonly: boolean;
    extension: string;
}

interface MemFile {
    data: Uint8Array;
    ctime: number;
    mtime: number;
    readonly: boolean;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** In-memory files for sftools documents */
class MemoryFileSystem implements vscode.FileSystemProvider {
    private readonly files = new Map<string, MemFile>();
    private readonly emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile = this.emitter.event;

    has(uri: vscode.Uri): boolean {
        return this.files.has(uri.path);
    }

    read(uri: vscode.Uri): string {
        const file = this.files.get(uri.path);
        return file ? decoder.decode(file.data) : '';
    }

    put(uri: vscode.Uri, text: string, readonly: boolean): void {
        const existing = this.files.get(uri.path);
        const now = Date.now();
        this.files.set(uri.path, {
            data: encoder.encode(text),
            ctime: existing?.ctime ?? now,
            mtime: now,
            readonly,
        });
        this.emitter.fire([
            {
                type: existing ? vscode.FileChangeType.Changed : vscode.FileChangeType.Created,
                uri,
            },
        ]);
    }

    remove(uri: vscode.Uri): void {
        if (this.files.delete(uri.path)) {
            this.emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
        }
    }

    watch(): vscode.Disposable {
        return new vscode.Disposable(() => {});
    }

    stat(uri: vscode.Uri): vscode.FileStat {
        const file = this.files.get(uri.path);
        if (file) {
            return {
                type: vscode.FileType.File,
                ctime: file.ctime,
                mtime: file.mtime,
                size: file.data.byteLength,
                permissions: file.readonly ? vscode.FilePermission.Readonly : undefined,
            };
        }
        // Folders are implied by file paths
        const prefix = uri.path.endsWith('/') ? uri.path : `${uri.path}/`;
        if (uri.path === '/' || [...this.files.keys()].some(p => p.startsWith(prefix))) {
            return { type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 };
        }
        throw vscode.FileSystemError.FileNotFound(uri);
    }

    readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
        const prefix = uri.path.endsWith('/') ? uri.path : `${uri.path}/`;
        const entries = new Map<string, vscode.FileType>();
        for (const path of this.files.keys()) {
            if (!path.startsWith(prefix)) continue;
            const [name, ...rest] = path.substring(prefix.length).split('/');
            entries.set(name, rest.length ? vscode.FileType.Directory : vscode.FileType.File);
        }
        return [...entries];
    }

    createDirectory(): void {
        // Folders are implied
    }

    readFile(uri: vscode.Uri): Uint8Array {
        const file = this.files.get(uri.path);
        if (!file) throw vscode.FileSystemError.FileNotFound(uri);
        return file.data;
    }

    writeFile(uri: vscode.Uri, content: Uint8Array): void {
        const file = this.files.get(uri.path);
        if (!file) throw vscode.FileSystemError.NoPermissions(uri);
        if (file.readonly) throw vscode.FileSystemError.NoPermissions(uri);
        file.data = content;
        file.mtime = Date.now();
        this.emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
    }

    delete(uri: vscode.Uri): void {
        this.remove(uri);
    }

    rename(): void {
        throw vscode.FileSystemError.NoPermissions('sftools documents cannot be renamed');
    }
}

const KIND_MAP: Record<CompletionKind, vscode.CompletionItemKind> = {
    field: vscode.CompletionItemKind.Field,
    constant: vscode.CompletionItemKind.Constant,
    reference: vscode.CompletionItemKind.Reference,
    value: vscode.CompletionItemKind.Value,
    enum: vscode.CompletionItemKind.Enum,
    keyword: vscode.CompletionItemKind.Keyword,
    unit: vscode.CompletionItemKind.Unit,
    event: vscode.CompletionItemKind.Event,
    module: vscode.CompletionItemKind.Module,
    class: vscode.CompletionItemKind.Class,
    function: vscode.CompletionItemKind.Function,
};

/** Language for a document; prefers the Salesforce extensions' languages when installed */
async function pickLanguage(extension: string): Promise<string | undefined> {
    const languages = new Set(await vscode.languages.getLanguages());
    switch (extension) {
        case 'soql':
            return languages.has('soql') ? 'soql' : 'sftools-soql';
        case 'apex':
            return languages.has('apex') ? 'apex' : 'sftools-apex';
        case 'log':
            return languages.has('apexlog') ? 'apexlog' : 'log';
        default:
            return undefined;
    }
}

export class NativeEditorManager implements HostEditors, vscode.Disposable {
    private readonly fs = new MemoryFileSystem();
    private readonly docs = new Map<string, DocEntry>(); // key: panelId/docId
    private readonly byUri = new Map<string, DocEntry>();
    private readonly diagnostics = vscode.languages.createDiagnosticCollection('sftools');
    private readonly disposables: vscode.Disposable[] = [];
    private readonly changeTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly saveTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(private readonly panels: PanelManager) {
        this.disposables.push(
            vscode.workspace.registerFileSystemProvider(SCHEME, this.fs, {
                isCaseSensitive: true,
            }),
            this.diagnostics,
            vscode.workspace.onDidChangeTextDocument(e => this.onDocumentChanged(e)),
            vscode.window.onDidChangeActiveTextEditor(editor => this.updateRunnable(editor)),
            vscode.languages.registerCompletionItemProvider(
                { scheme: SCHEME },
                {
                    provideCompletionItems: (doc, pos, token, ctx) =>
                        this.complete(doc, pos, token, ctx),
                },
                '.',
                ' '
            ),
            vscode.commands.registerCommand('sftools.runEditor', () => this.runActive())
        );
        panels.onDidClose(panelId => this.disposePanel(panelId));
        this.updateRunnable(vscode.window.activeTextEditor);
    }

    async open(panelId: string, info: EditorDocumentInfo): Promise<void> {
        const entry = this.register(panelId, info);
        if (!info.reveal) return;

        const document = await vscode.workspace.openTextDocument(entry.uri);
        const language = await pickLanguage(entry.extension);
        const doc =
            language && document.languageId !== language
                ? await vscode.languages.setTextDocumentLanguage(document, language)
                : document;
        const panelColumn = this.panels.getViewColumn(panelId);
        await vscode.window.showTextDocument(doc, {
            viewColumn: panelColumn ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
            preview: false,
            preserveFocus: false,
        });
    }

    async update(panelId: string, docId: string, value: string): Promise<void> {
        const entry = this.docs.get(`${panelId}/${docId}`);
        if (!entry) return;
        const open = vscode.workspace.textDocuments.find(
            d => d.uri.toString() === entry.uri.toString()
        );
        if (open && open.getText() === value) return;
        if (!open && this.fs.read(entry.uri) === value) return;

        if (open && !entry.readonly) {
            // Edit in place so the cursor and undo history survive
            const edit = new vscode.WorkspaceEdit();
            const fullRange = new vscode.Range(
                open.positionAt(0),
                open.positionAt(open.getText().length)
            );
            edit.replace(entry.uri, fullRange, value);
            await vscode.workspace.applyEdit(edit);
            await open.save();
            return;
        }
        // Read-only (or closed) documents reload from the file system
        this.fs.put(entry.uri, value, entry.readonly);
    }

    close(panelId: string, docId: string): void {
        this.disposeDoc(panelId, docId);
    }

    dispose(): void {
        for (const d of this.disposables) d.dispose();
        for (const timer of [...this.changeTimers.values(), ...this.saveTimers.values()]) {
            clearTimeout(timer);
        }
    }

    setMarkers(panelId: string, docId: string, markers: EditorMarker[]): void {
        const entry = this.docs.get(`${panelId}/${docId}`);
        if (!entry) return;
        const text = this.currentText(entry);
        const lines = text.split('\n');
        this.diagnostics.set(
            entry.uri,
            markers.map(marker => {
                const lineIndex = Math.min(
                    Math.max(marker.line - 1, 0),
                    Math.max(lines.length - 1, 0)
                );
                const lineLength = lines[lineIndex]?.length ?? 0;
                const start = Math.max((marker.startColumn ?? 1) - 1, 0);
                const end = Math.max(
                    Math.min((marker.endColumn ?? lineLength + 1) - 1, lineLength),
                    start
                );
                const diagnostic = new vscode.Diagnostic(
                    new vscode.Range(lineIndex, start, lineIndex, end),
                    marker.message,
                    marker.severity === 'warning'
                        ? vscode.DiagnosticSeverity.Warning
                        : marker.severity === 'info'
                          ? vscode.DiagnosticSeverity.Information
                          : vscode.DiagnosticSeverity.Error
                );
                diagnostic.source = 'sftools';
                return diagnostic;
            })
        );
    }

    private register(panelId: string, info: EditorDocumentInfo): DocEntry {
        const key = `${panelId}/${info.docId}`;
        const existing = this.docs.get(key);
        if (existing) return existing;

        const safeName = info.name.replace(/[\\/:*?"<>|]/g, '-') || 'Untitled';
        let uri = vscode.Uri.from({
            scheme: SCHEME,
            path: `/${panelId}/${safeName}.${info.extension}`,
        });
        for (let n = 2; this.byUri.has(uri.toString()); n++) {
            uri = vscode.Uri.from({
                scheme: SCHEME,
                path: `/${panelId}/${safeName} ${n}.${info.extension}`,
            });
        }
        const entry: DocEntry = {
            panelId,
            docId: info.docId,
            uri,
            readonly: info.readonly,
            extension: info.extension,
        };
        this.docs.set(key, entry);
        this.byUri.set(uri.toString(), entry);
        this.fs.put(uri, info.value, info.readonly);
        return entry;
    }

    private disposeDoc(panelId: string, docId: string): void {
        const key = `${panelId}/${docId}`;
        const entry = this.docs.get(key);
        if (!entry) return;
        this.docs.delete(key);
        this.byUri.delete(entry.uri.toString());
        this.diagnostics.delete(entry.uri);
        void this.closeTabs(entry.uri).finally(() => this.fs.remove(entry.uri));
    }

    private disposePanel(panelId: string): void {
        for (const entry of [...this.docs.values()]) {
            if (entry.panelId === panelId) this.disposeDoc(panelId, entry.docId);
        }
    }

    private async closeTabs(uri: vscode.Uri): Promise<void> {
        const tabs = vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .filter(
                tab =>
                    tab.input instanceof vscode.TabInputText &&
                    tab.input.uri.toString() === uri.toString()
            );
        if (tabs.length) await vscode.window.tabGroups.close(tabs, true);
    }

    private currentText(entry: DocEntry): string {
        const open = vscode.workspace.textDocuments.find(
            d => d.uri.toString() === entry.uri.toString()
        );
        return open ? open.getText() : this.fs.read(entry.uri);
    }

    private onDocumentChanged(event: vscode.TextDocumentChangeEvent): void {
        const document = event.document;
        if (document.uri.scheme !== SCHEME || event.contentChanges.length === 0) return;
        const entry = this.byUri.get(document.uri.toString());
        if (!entry) return;
        const key = document.uri.toString();

        // Tell the panel (batched while typing)
        clearTimeout(this.changeTimers.get(key));
        this.changeTimers.set(
            key,
            setTimeout(() => {
                this.changeTimers.delete(key);
                this.panels.postEvent(entry.panelId, {
                    type: EDITOR_CHANGED,
                    docId: entry.docId,
                    value: document.getText(),
                });
            }, 50)
        );

        // Keep the document saved so closing it never asks to save
        if (!entry.readonly) {
            clearTimeout(this.saveTimers.get(key));
            this.saveTimers.set(
                key,
                setTimeout(() => {
                    this.saveTimers.delete(key);
                    if (document.isDirty && !document.isClosed) void document.save();
                }, 300)
            );
        }
    }

    private updateRunnable(editor: vscode.TextEditor | undefined): void {
        const entry = editor ? this.byUri.get(editor.document.uri.toString()) : undefined;
        void vscode.commands.executeCommand(
            'setContext',
            RUNNABLE_CONTEXT,
            !!entry && !entry.readonly
        );
    }

    private runActive(): void {
        const editor = vscode.window.activeTextEditor;
        const entry = editor ? this.byUri.get(editor.document.uri.toString()) : undefined;
        if (!entry || !editor) {
            void vscode.window.showInformationMessage(
                'Run works in sftools Query, Apex and REST editors.'
            );
            return;
        }
        // Make sure the panel has the latest text before it runs
        clearTimeout(this.changeTimers.get(editor.document.uri.toString()));
        this.panels.postEvent(entry.panelId, {
            type: EDITOR_CHANGED,
            docId: entry.docId,
            value: editor.document.getText(),
        });
        this.panels.postEvent(entry.panelId, { type: EDITOR_EXECUTE, docId: entry.docId });
    }

    private async complete(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[] | undefined> {
        const entry = this.byUri.get(document.uri.toString());
        if (!entry || entry.readonly) return undefined;
        // Space only opens suggestions in SOQL (after SELECT, FROM, WHERE...)
        if (context.triggerCharacter === ' ' && entry.extension !== 'soql') return undefined;

        let suggestions: CompletionSuggestion[];
        try {
            suggestions = await this.panels.request<CompletionSuggestion[]>(entry.panelId, {
                type: EDITOR_COMPLETE,
                docId: entry.docId,
                text: document.getText(),
                offset: document.offsetAt(position),
            });
        } catch {
            return undefined;
        }
        if (!suggestions?.length) return undefined;

        const wordRange = document.getWordRangeAtPosition(position, /[\w$]+/);
        const range = wordRange ? new vscode.Range(wordRange.start, position) : undefined;
        return suggestions.map(s => {
            const item = new vscode.CompletionItem(s.label, KIND_MAP[s.kind]);
            item.insertText = s.snippet ? new vscode.SnippetString(s.insertText) : s.insertText;
            if (s.detail) item.detail = s.detail;
            if (s.documentation) item.documentation = s.documentation;
            if (s.sortText) item.sortText = s.sortText;
            if (range) item.range = range;
            return item;
        });
    }
}
