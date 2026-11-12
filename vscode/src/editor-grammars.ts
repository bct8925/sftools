// Finds the TextMate grammars VS Code would use, for the webview's Monaco editors.
// No vscode imports, so it is unit tested; extension.ts supplies the inputs.

import * as path from 'path';
import type { EditorGrammarInfo } from '../../src/platform/protocol';

/** A grammar an extension contributes (package.json contributes.grammars) */
export interface GrammarContribution {
    extensionPath: string;
    language?: string;
    scopeName: string;
    path: string;
    injectTo?: string[];
}

/**
 * VS Code languages for each sftools editor language, best first.
 * Anonymous Apex is `apex-anon` in the Salesforce extensions.
 */
export const VSCODE_LANGUAGES: Record<string, string[]> = {
    sql: ['soql'],
    apex: ['apex-anon', 'apex'],
    json: ['json'],
    xml: ['xml'],
    javascript: ['javascript'],
};

export type ReadFile = (filePath: string) => Promise<string>;

export class GrammarCatalog {
    /**
     * @param contributions - grammars from all installed extensions
     * @param fallbacks - sftools' own grammars, used when no extension has one
     */
    constructor(
        private readonly contributions: () => GrammarContribution[],
        private readonly fallbacks: GrammarContribution[],
        private readonly readFile: ReadFile
    ) {}

    private all(): GrammarContribution[] {
        return [...this.contributions(), ...this.fallbacks];
    }

    forLanguage(editorLanguage: string): Promise<EditorGrammarInfo | null> {
        const all = this.all();
        for (const language of VSCODE_LANGUAGES[editorLanguage] ?? []) {
            const grammar = all.find(g => g.language === language);
            if (grammar) return this.load(grammar, all);
        }
        return Promise.resolve(null);
    }

    forScope(scopeName: string): Promise<EditorGrammarInfo | null> {
        const all = this.all();
        const grammar = all.find(g => g.scopeName === scopeName);
        return grammar ? this.load(grammar, all) : Promise.resolve(null);
    }

    private async load(
        grammar: GrammarContribution,
        all: GrammarContribution[]
    ): Promise<EditorGrammarInfo | null> {
        const filePath = path.join(grammar.extensionPath, grammar.path);
        try {
            return {
                scopeName: grammar.scopeName,
                fileName: path.basename(filePath),
                content: await this.readFile(filePath),
                injections: all
                    .filter(g => g.injectTo?.includes(grammar.scopeName))
                    .map(g => g.scopeName),
            };
        } catch {
            return null;
        }
    }
}
