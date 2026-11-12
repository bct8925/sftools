// VS Code build of ./editor-host.ts. Monaco keeps running inside the webview, but:
// - with the sftools theme on System, its colors come from the active VS Code theme
//   (CSS variables for the editor UI, the theme's tokenColors for syntax); on Light or
//   Dark they are sftools' own (VS Code's Visual Studio Light/Dark token colors, which
//   Monaco's own themes come from, on sftools' backgrounds),
// - its syntax highlighting comes from the TextMate grammars VS Code has installed
//   (Salesforce's SOQL and Apex grammars when those extensions are there), tokenized
//   with vscode-textmate exactly as VS Code does,
// - its suggestions add VS Code's completion providers for the language.

import { useEffect } from 'react';
import type { editor, languages } from 'monaco-editor';
import {
    INITIAL,
    Registry,
    parseRawGrammar,
    type IGrammar,
    type IRawTheme,
    type StateStack,
} from 'vscode-textmate';
import { OnigScanner, OnigString, loadWASM } from 'vscode-oniguruma';
import onigWasmUrl from 'vscode-oniguruma/release/onig.wasm?url';
import { monaco } from '../../lib/monaco-custom';
import type { CompletionSource, CompletionSuggestion } from '../../lib/completion';
import { getPlatform } from '../../platform';
import {
    EDITOR_COMPLETE,
    EDITOR_GRAMMAR,
    EDITOR_THEME,
    EDITOR_THEME_CHANGED,
    type EditorGrammarInfo,
    type EditorThemeInfo,
} from '../../platform/protocol';
import type { CodeEditorLanguage } from '../code-editor/types';
import { baseThemeFor, buildTokenRules, readEditorColors, toMonacoTokens } from './textmate-theme';

const THEME_NAME = 'sftools-vscode';
/** Stop tokenizing a very long line after this many ms, as VS Code does */
const TOKENIZE_TIME_LIMIT_MS = 500;

function monacoLanguage(language: CodeEditorLanguage): string {
    return language === 'text' ? 'plaintext' : language;
}

function cssVariable(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// --- TextMate registry ---------------------------------------------------------

const grammarInfos = new Map<string, EditorGrammarInfo>();
let registry: Registry | null = null;

function getRegistry(): Registry {
    if (registry) return registry;
    const onigLib = fetch(onigWasmUrl)
        .then(response => response.arrayBuffer())
        .then(buffer => loadWASM(buffer))
        .then(() => ({
            createOnigScanner: (patterns: string[]) => new OnigScanner(patterns),
            createOnigString: (text: string) => new OnigString(text),
        }));
    registry = new Registry({
        onigLib,
        loadGrammar: async scopeName => {
            const info =
                grammarInfos.get(scopeName) ??
                (await getPlatform().sendMessage<EditorGrammarInfo | null>({
                    type: EDITOR_GRAMMAR,
                    scopeName,
                }));
            if (!info) return null;
            grammarInfos.set(info.scopeName, info);
            return parseRawGrammar(info.content, info.fileName);
        },
        getInjections: scopeName => grammarInfos.get(scopeName)?.injections,
    });
    return registry;
}

// --- Theme -----------------------------------------------------------------------

/**
 * Which look the editors take, following the sftools theme setting: "system" matches
 * VS Code (the html element carries data-vscode-theme, see lib/theme.ts); light and
 * dark are sftools' own palettes.
 */
type EditorLook = 'vscode' | 'light' | 'dark';

function currentLook(): EditorLook {
    const html = document.documentElement;
    if (html.hasAttribute('data-vscode-theme')) return 'vscode';
    return html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/** Monaco's own vs/vs-dark default text colors, for sftools' looks */
const DEFAULT_TEXT: Record<'light' | 'dark', { foreground: string; background: string }> = {
    light: { foreground: '#000000', background: '#FFFFFF' },
    dark: { foreground: '#D4D4D4', background: '#1E1E1E' },
};

const tokenColors = new Map<EditorLook, Promise<EditorThemeInfo>>();

function editorColors(look: EditorLook): Record<string, string> {
    if (look === 'vscode') return readEditorColors(cssVariable);
    // As sftools' own Monaco themes (useMonacoTheme.ts): the nav background
    const navBg = cssVariable('--nav-bg');
    return navBg ? { 'editor.background': navBg, 'editorGutter.background': navBg } : {};
}

function defineTheme(look: EditorLook, rules: editor.ITokenThemeRule[]): void {
    monaco.editor.defineTheme(THEME_NAME, {
        base:
            look === 'vscode'
                ? baseThemeFor(document.body.classList)
                : look === 'dark'
                  ? 'vs-dark'
                  : 'vs',
        inherit: true,
        rules,
        colors: editorColors(look),
    });
    monaco.editor.setTheme(THEME_NAME);
}

function requestTokenColors(look: EditorLook): Promise<EditorThemeInfo> {
    let request = tokenColors.get(look);
    if (!request) {
        request = getPlatform().sendMessage<EditorThemeInfo>({
            type: EDITOR_THEME,
            variant: look === 'vscode' ? undefined : look,
        });
        tokenColors.set(look, request);
    }
    return request;
}

async function applyTheme(): Promise<void> {
    const look = currentLook();
    try {
        const theme = await requestTokenColors(look);
        // The setting changed while the host was answering; the newer apply wins
        if (currentLook() !== look) return;
        const defaults =
            look === 'vscode'
                ? {
                      foreground: cssVariable('--vscode-editor-foreground') || undefined,
                      background: cssVariable('--vscode-editor-background') || undefined,
                  }
                : DEFAULT_TEXT[look];
        const raw: IRawTheme = {
            name: theme.name,
            settings: [{ settings: defaults }, ...theme.tokenColors],
        };
        const reg = getRegistry();
        reg.setTheme(raw);
        defineTheme(look, buildTokenRules(reg.getColorMap()));
        // Token names map to colors by index, so everything needs tokenizing again
        for (const [language, grammar] of grammars) setTokensProvider(language, grammar);
    } catch (error) {
        // Keep Monaco's own highlighting, in the look's editor colors
        console.warn('[sftools] Could not load the theme for editors:', error);
        tokenColors.delete(look);
        defineTheme(look, []);
    }
}

let themeStarted = false;
let pendingApply: ReturnType<typeof setTimeout> | undefined;

function scheduleApply(): void {
    clearTimeout(pendingApply);
    pendingApply = setTimeout(() => void applyTheme(), 100);
}

function startTheme(): void {
    if (themeStarted) return;
    themeStarted = true;
    // Colors from CSS straight away; syntax colors once the host answers
    defineTheme(currentLook(), []);
    void applyTheme();

    getPlatform().onMessage(message => {
        if (message.type === EDITOR_THEME_CHANGED) {
            tokenColors.delete('vscode');
            scheduleApply();
        }
    });
    // VS Code updates the webview's CSS variables and body class on a theme change;
    // the sftools theme setting changes the html element's data attributes
    const observer = new MutationObserver(scheduleApply);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['style', 'data-theme', 'data-vscode-theme'],
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
}

export function useEditorTheme(): string {
    useEffect(startTheme, []);
    return THEME_NAME;
}

// --- Syntax highlighting -----------------------------------------------------------

class TextMateState implements languages.IState {
    constructor(readonly stack: StateStack) {}
    clone(): TextMateState {
        return this;
    }
    equals(other: languages.IState): boolean {
        return other instanceof TextMateState && other.stack.equals(this.stack);
    }
}

const grammars = new Map<string, IGrammar>();
const tokenProviders = new Map<string, { dispose(): void }>();
const preparedLanguages = new Set<CodeEditorLanguage>();

function setTokensProvider(language: string, grammar: IGrammar): void {
    tokenProviders.get(language)?.dispose();
    tokenProviders.set(
        language,
        monaco.languages.setTokensProvider(language, {
            getInitialState: () => new TextMateState(INITIAL),
            tokenize: (line, state) => {
                const result = grammar.tokenizeLine2(
                    line,
                    (state as TextMateState).stack,
                    TOKENIZE_TIME_LIMIT_MS
                );
                return {
                    tokens: toMonacoTokens(result.tokens),
                    endState: new TextMateState(result.ruleStack),
                };
            },
        })
    );
}

async function loadLanguage(language: CodeEditorLanguage): Promise<void> {
    const info = await getPlatform().sendMessage<EditorGrammarInfo | null>({
        type: EDITOR_GRAMMAR,
        language,
    });
    if (!info) return;
    grammarInfos.set(info.scopeName, info);
    const grammar = await getRegistry().loadGrammar(info.scopeName);
    if (!grammar) return;
    const id = monacoLanguage(language);
    grammars.set(id, grammar);
    setTokensProvider(id, grammar);
}

export function prepareEditorLanguage(language: CodeEditorLanguage): void {
    if (language === 'text' || preparedLanguages.has(language)) return;
    preparedLanguages.add(language);
    loadLanguage(language).catch(error => {
        // Monaco's own tokenizer stays in place
        console.warn(`[sftools] No VS Code grammar for ${language}:`, error);
    });
}

// --- Completions -------------------------------------------------------------------

const completionSources = new Map<CodeEditorLanguage, CompletionSource>();

export function hostCompletionSource(language: CodeEditorLanguage): CompletionSource | undefined {
    if (language === 'text') return undefined;
    let source = completionSources.get(language);
    if (!source) {
        source = {
            triggerCharacters: ['.', '@', '"', ':', '<', '/'],
            async provide(text, offset, context) {
                try {
                    return (
                        (await getPlatform().sendMessage<CompletionSuggestion[]>({
                            type: EDITOR_COMPLETE,
                            language,
                            text,
                            offset,
                            triggerCharacter: context?.triggerCharacter,
                        })) ?? []
                    );
                } catch {
                    return [];
                }
            },
        };
        completionSources.set(language, source);
    }
    return source;
}

// --- Fonts -------------------------------------------------------------------------

export function hostEditorOptions(): editor.IEditorOptions {
    const options: editor.IEditorOptions = { fontSize: 13 };
    const family = cssVariable('--vscode-editor-font-family');
    const size = parseFloat(cssVariable('--vscode-editor-font-size'));
    const weight = cssVariable('--vscode-editor-font-weight');
    if (family) options.fontFamily = family;
    if (size > 0) options.fontSize = size;
    if (weight) options.fontWeight = weight;
    return options;
}
