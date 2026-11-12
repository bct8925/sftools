// Adapts editor-agnostic CompletionSources to Monaco completion providers (Chrome only).
import type { CompletionKind, CompletionSource, CompletionSuggestion } from '../../lib/completion';
import { monaco } from './MonacoEditor';

function toMonacoKind(kind: CompletionKind): monaco.languages.CompletionItemKind {
    const kinds = monaco.languages.CompletionItemKind;
    switch (kind) {
        case 'constant':
            return kinds.Constant;
        case 'reference':
            return kinds.Reference;
        case 'value':
            return kinds.Value;
        case 'enum':
            return kinds.Enum;
        case 'keyword':
            return kinds.Keyword;
        case 'unit':
            return kinds.Unit;
        case 'event':
            return kinds.Event;
        case 'module':
            return kinds.Module;
        case 'class':
            return kinds.Class;
        case 'function':
            return kinds.Function;
        case 'field':
        default:
            return kinds.Field;
    }
}

export function toMonacoCompletionItem(
    suggestion: CompletionSuggestion,
    range: monaco.IRange
): monaco.languages.CompletionItem {
    const item: monaco.languages.CompletionItem = {
        label: suggestion.label,
        kind: toMonacoKind(suggestion.kind),
        insertText: suggestion.insertText,
        range,
    };
    if (suggestion.detail !== undefined) item.detail = suggestion.detail;
    if (suggestion.documentation !== undefined) item.documentation = suggestion.documentation;
    if (suggestion.sortText !== undefined) item.sortText = suggestion.sortText;
    if (suggestion.snippet) {
        item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }
    return item;
}

/**
 * Build a Monaco completion provider from a CompletionSource.
 * @param source - completion logic
 * @param appliesTo - optional filter so a provider only answers for one editor's model
 */
export function createMonacoCompletionProvider(
    source: CompletionSource,
    appliesTo?: (model: monaco.editor.ITextModel) => boolean
): monaco.languages.CompletionItemProvider {
    return {
        triggerCharacters: source.triggerCharacters,
        provideCompletionItems: async (model, position) => {
            if (appliesTo && !appliesTo(model)) {
                return { suggestions: [] };
            }
            const text = model.getValue();
            const offset = model.getOffsetAt(position);
            const word = model.getWordUntilPosition(position);
            const range: monaco.IRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };
            const suggestions = await source.provide(text, offset);
            return { suggestions: suggestions.map(s => toMonacoCompletionItem(s, range)) };
        },
    };
}

/** Register a CompletionSource for a Monaco language. Returns the disposable. */
export function registerMonacoCompletionSource(
    language: string,
    source: CompletionSource,
    appliesTo?: (model: monaco.editor.ITextModel) => boolean
): monaco.IDisposable {
    return monaco.languages.registerCompletionItemProvider(
        language,
        createMonacoCompletionProvider(source, appliesTo)
    );
}
