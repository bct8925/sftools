// What MonacoEditor borrows from its host. This is the Chrome version: sftools' own
// theme, Monaco's built-in highlighting and no extra completions.
// The VS Code build swaps in ./editor-host.vscode.ts (see vite.config.vscode.ts).

import type { editor } from 'monaco-editor';
import type { CompletionSource } from '../../lib/completion';
import type { CodeEditorLanguage } from '../code-editor/types';
import { useMonacoTheme } from './useMonacoTheme';

/** Monaco theme name to use, kept current as the host theme changes */
export function useEditorTheme(): string {
    return useMonacoTheme();
}

/** Prepare syntax highlighting for a language (VS Code loads its grammar) */
export function prepareEditorLanguage(_language: CodeEditorLanguage): void {
    // Monaco's built-in tokenizers are already registered
}

/** Completions the host adds to an editable editor */
export function hostCompletionSource(_language: CodeEditorLanguage): CompletionSource | undefined {
    return undefined;
}

/** Editor options the host decides (fonts) */
export function hostEditorOptions(): editor.IEditorOptions {
    return { fontSize: 13 };
}
