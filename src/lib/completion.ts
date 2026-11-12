// Editor-agnostic completion types.
// Completion logic (SOQL, formula fields) produces these; the Monaco editor (Chrome)
// and the VS Code extension each map them to their own completion item format.

export type CompletionKind =
    | 'field'
    | 'constant'
    | 'reference'
    | 'value'
    | 'enum'
    | 'keyword'
    | 'unit'
    | 'event'
    | 'module'
    | 'class'
    | 'function'
    | 'method'
    | 'constructor'
    | 'variable'
    | 'property'
    | 'interface'
    | 'struct'
    | 'enumMember'
    | 'typeParameter'
    | 'operator'
    | 'snippet'
    | 'text'
    | 'color'
    | 'file'
    | 'folder';

export interface CompletionSuggestion {
    label: string;
    kind: CompletionKind;
    detail?: string;
    documentation?: string;
    /** Text to insert. When `snippet` is true it may contain snippet tabstops like `$0`. */
    insertText: string;
    snippet?: boolean;
    sortText?: string;
    filterText?: string;
    /** Text the suggestion replaces, as offsets into the editor text (default: the word at the cursor) */
    range?: { start: number; end: number };
}

export interface CompletionContext {
    /** Character that opened the suggestion list, if one did */
    triggerCharacter?: string;
}

export interface CompletionSource {
    /** Characters that open the suggestion list automatically */
    triggerCharacters: string[];
    /**
     * Suggestions for the cursor position.
     * @param text - full editor text
     * @param offset - cursor offset into `text`
     */
    provide(
        text: string,
        offset: number,
        context?: CompletionContext
    ): Promise<CompletionSuggestion[]>;
}

/**
 * One source made of several. Suggestions come in source order; a label that an
 * earlier source already gave is dropped. A failing source contributes nothing.
 */
export function mergeCompletionSources(
    ...sources: Array<CompletionSource | undefined>
): CompletionSource | undefined {
    const present = sources.filter((s): s is CompletionSource => s !== undefined);
    if (present.length <= 1) return present[0];
    return {
        triggerCharacters: [...new Set(present.flatMap(s => s.triggerCharacters))],
        async provide(text, offset, context) {
            const results = await Promise.allSettled(
                present.map(source =>
                    // A source only answers its own trigger characters
                    context?.triggerCharacter &&
                    !source.triggerCharacters.includes(context.triggerCharacter)
                        ? Promise.resolve([])
                        : source.provide(text, offset, context)
                )
            );
            const seen = new Set<string>();
            const merged: CompletionSuggestion[] = [];
            for (const result of results) {
                if (result.status !== 'fulfilled') continue;
                for (const suggestion of result.value) {
                    if (seen.has(suggestion.label)) continue;
                    seen.add(suggestion.label);
                    merged.push(suggestion);
                }
            }
            return merged;
        },
    };
}

/** Text of the line the cursor is on, up to the cursor */
export function textBeforeCursorOnLine(text: string, offset: number): string {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    return text.substring(lineStart, offset);
}
