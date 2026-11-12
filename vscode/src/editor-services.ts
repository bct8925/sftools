// Serves the webview's Monaco editors what VS Code knows: the color theme's token
// colors, installed TextMate grammars, and completions from VS Code's providers.

import * as vscode from 'vscode';
import type { CompletionSuggestion } from '../../src/lib/completion';
import type {
    EditorCompleteRequest,
    EditorGrammarInfo,
    EditorThemeInfo,
} from '../../src/platform/protocol';
import { toSuggestion, type CompletionItemLike } from './completion-items';
import { GrammarCatalog, VSCODE_LANGUAGES, type GrammarContribution } from './editor-grammars';
import { resolveEditorTheme, type ThemeContribution, type ThemeKind } from './editor-theme';
import type { HostEditors } from './handlers';

/** File extension of the hidden document completions are asked for */
const MIRROR_EXTENSIONS: Record<string, string> = {
    soql: 'soql',
    'apex-anon': 'apex',
    apex: 'apex',
    json: 'json',
    xml: 'xml',
    javascript: 'js',
};
const MAX_SUGGESTIONS = 3000;
const COMPLETION_TIMEOUT_MS = 3000;
const SYNC_TIMEOUT_MS = 1000;

async function readText(filePath: string): Promise<string> {
    return new TextDecoder().decode(await vscode.workspace.fs.readFile(vscode.Uri.file(filePath)));
}

function contributions<T>(key: 'grammars' | 'themes'): Array<T & { extensionPath: string }> {
    return vscode.extensions.all.flatMap(extension => {
        const list = (extension.packageJSON as { contributes?: Record<string, unknown> })
            ?.contributes?.[key];
        return Array.isArray(list)
            ? list.map(entry => ({ ...(entry as T), extensionPath: extension.extensionPath }))
            : [];
    });
}

function withTimeout<T>(promise: Thenable<T>, ms: number): Promise<T | undefined> {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(undefined), ms);
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            () => {
                clearTimeout(timer);
                resolve(undefined);
            }
        );
    });
}

export class EditorServices implements HostEditors, vscode.Disposable {
    private readonly grammars: GrammarCatalog;
    private theme: Promise<EditorThemeInfo> | null = null;
    private readonly queues = new Map<string, Promise<CompletionSuggestion[]>>();
    private readonly latest = new Map<string, number>();
    private generation = 0;
    private readonly disposables: vscode.Disposable[] = [];

    /**
     * @param extensionPath - sftools' own folder, for its fallback grammars
     * @param storageUri - where the hidden completion documents live (outside the workspace)
     * @param onThemeChanged - tell the webviews to ask for the theme again
     */
    constructor(
        extensionPath: string,
        private readonly storageUri: vscode.Uri,
        onThemeChanged: () => void
    ) {
        this.grammars = new GrammarCatalog(
            () => contributions<GrammarContribution>('grammars'),
            [
                {
                    extensionPath,
                    language: 'soql',
                    scopeName: 'source.sftools.soql',
                    path: 'syntaxes/soql.tmLanguage.json',
                },
                {
                    extensionPath,
                    language: 'apex',
                    scopeName: 'source.sftools.apex',
                    path: 'syntaxes/apex.tmLanguage.json',
                },
            ],
            readText
        );
        const themeChanged = () => {
            this.theme = null;
            onThemeChanged();
        };
        this.disposables.push(
            vscode.window.onDidChangeActiveColorTheme(themeChanged),
            vscode.workspace.onDidChangeConfiguration(event => {
                if (event.affectsConfiguration('editor.tokenColorCustomizations')) themeChanged();
            }),
            vscode.extensions.onDidChange(() => {
                this.theme = null;
            })
        );
    }

    getTheme(): Promise<EditorThemeInfo> {
        this.theme ??= this.loadTheme();
        return this.theme;
    }

    private loadTheme(): Promise<EditorThemeInfo> {
        const workbench = vscode.workspace.getConfiguration('workbench');
        return resolveEditorTheme(
            contributions<ThemeContribution>('themes'),
            {
                colorTheme: workbench.get<string>('colorTheme'),
                autoDetectColorScheme: vscode.workspace
                    .getConfiguration('window')
                    .get<boolean>('autoDetectColorScheme'),
                preferredDark: workbench.get<string>('preferredDarkColorTheme'),
                preferredLight: workbench.get<string>('preferredLightColorTheme'),
                preferredHighContrast: workbench.get<string>('preferredHighContrastColorTheme'),
                preferredHighContrastLight: workbench.get<string>(
                    'preferredHighContrastLightColorTheme'
                ),
                customizations: vscode.workspace
                    .getConfiguration('editor')
                    .get<Record<string, unknown>>('tokenColorCustomizations'),
            },
            vscode.window.activeColorTheme.kind as number as ThemeKind,
            readText
        );
    }

    getGrammar(request: {
        language?: string;
        scopeName?: string;
    }): Promise<EditorGrammarInfo | null> {
        if (request.scopeName) return this.grammars.forScope(request.scopeName);
        if (request.language) return this.grammars.forLanguage(request.language);
        return Promise.resolve(null);
    }

    /**
     * VS Code's completion providers answer for documents VS Code has open. The editor
     * text is mirrored into a hidden file of the right language and the providers are
     * asked about it, the way VS Code would for an open file. Language servers that only
     * serve files inside a project may still give nothing; sftools' own SOQL
     * suggestions don't depend on this.
     */
    async complete(request: EditorCompleteRequest): Promise<CompletionSuggestion[]> {
        const known = await vscode.languages.getLanguages();
        const languageId = (VSCODE_LANGUAGES[request.language] ?? []).find(id =>
            known.includes(id)
        );
        if (!languageId) return [];

        // One request per language at a time; a newer request replaces a waiting one
        const generation = ++this.generation;
        this.latest.set(languageId, generation);
        const previous = this.queues.get(languageId) ?? Promise.resolve([]);
        const next = previous
            .catch(() => [])
            .then(() =>
                this.latest.get(languageId) === generation
                    ? this.runCompletion(languageId, request, generation)
                    : []
            );
        this.queues.set(languageId, next);
        return next;
    }

    private async runCompletion(
        languageId: string,
        request: EditorCompleteRequest,
        generation: number
    ): Promise<CompletionSuggestion[]> {
        const document = await this.syncMirror(languageId, request.text);
        if (!document || this.latest.get(languageId) !== generation) return [];
        const list = await withTimeout(
            vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                document.uri,
                document.positionAt(request.offset),
                request.triggerCharacter
            ),
            COMPLETION_TIMEOUT_MS
        );
        if (!list?.items) return [];
        return list.items.slice(0, MAX_SUGGESTIONS).map(item =>
            toSuggestion(
                item as unknown as CompletionItemLike,
                kind => vscode.CompletionItemKind[kind],
                position =>
                    document.offsetAt(new vscode.Position(position.line, position.character))
            )
        );
    }

    /** The hidden document for a language, holding `text` */
    private async syncMirror(
        languageId: string,
        text: string
    ): Promise<vscode.TextDocument | undefined> {
        const uri = vscode.Uri.joinPath(
            this.storageUri,
            'editors',
            `sftools-${languageId}.${MIRROR_EXTENSIONS[languageId] ?? 'txt'}`
        );
        const open = vscode.workspace.textDocuments.find(d => d.uri.toString() === uri.toString());
        if (!open || open.getText() !== text) {
            // Written to disk, never edited, so the document is never dirty or offered for saving
            await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(text));
        }
        let document = await vscode.workspace.openTextDocument(uri);
        if (document.languageId !== languageId) {
            document = await vscode.languages.setTextDocumentLanguage(document, languageId);
        }
        if (document.getText() === text) return document;
        return this.waitForText(document, text);
    }

    private waitForText(
        document: vscode.TextDocument,
        text: string
    ): Promise<vscode.TextDocument | undefined> {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                listener.dispose();
                resolve(undefined);
            }, SYNC_TIMEOUT_MS);
            const listener = vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document === document && document.getText() === text) {
                    clearTimeout(timer);
                    listener.dispose();
                    resolve(document);
                }
            });
        });
    }

    dispose(): void {
        for (const disposable of this.disposables) disposable.dispose();
    }
}
