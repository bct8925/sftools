// Adapts editor-agnostic CompletionSources to Monaco completion providers.
import type { CompletionKind, CompletionSource, CompletionSuggestion } from '../../lib/completion';
import { monaco } from './MonacoEditor';

function toMonacoKind(kind: CompletionKind): monaco.languages.CompletionItemKind {
    // CompletionKind names match Monaco's enum names, lower-camel-cased
    const name = (kind.charAt(0).toUpperCase() +
        kind.slice(1)) as keyof typeof monaco.languages.CompletionItemKind;
    return monaco.languages.CompletionItemKind[name] ?? monaco.languages.CompletionItemKind.Field;
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
    if (suggestion.filterText !== undefined) item.filterText = suggestion.filterText;
    if (suggestion.snippet) {
        item.insertTextRules = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }
    return item;
}

function rangeFromOffsets(
    model: monaco.editor.ITextModel,
    range: { start: number; end: number }
): monaco.IRange {
    const start = model.getPositionAt(range.start);
    const end = model.getPositionAt(range.end);
    return {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
    };
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
        provideCompletionItems: async (model, position, context) => {
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
            const suggestions = await source.provide(text, offset, {
                triggerCharacter: context?.triggerCharacter,
            });
            return {
                suggestions: suggestions.map(s =>
                    toMonacoCompletionItem(s, s.range ? rangeFromOffsets(model, s.range) : range)
                ),
            };
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
