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
    | 'function';

export interface CompletionSuggestion {
    label: string;
    kind: CompletionKind;
    detail?: string;
    documentation?: string;
    /** Text to insert. When `snippet` is true it may contain snippet tabstops like `$0`. */
    insertText: string;
    snippet?: boolean;
    sortText?: string;
}

export interface CompletionSource {
    /** Characters that open the suggestion list automatically */
    triggerCharacters: string[];
    /**
     * Suggestions for the cursor position.
     * @param text - full editor text
     * @param offset - cursor offset into `text`
     */
    provide(text: string, offset: number): Promise<CompletionSuggestion[]>;
}

/** Text of the line the cursor is on, up to the cursor */
export function textBeforeCursorOnLine(text: string, offset: number): string {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    return text.substring(lineStart, offset);
}
