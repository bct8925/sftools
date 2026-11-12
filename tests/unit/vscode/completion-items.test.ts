// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { toCompletionKind, toSuggestion } from '../../../vscode/src/completion-items';

const KIND_NAMES: Record<number, string> = {
    0: 'Text',
    1: 'Method',
    4: 'Field',
    19: 'EnumMember',
    24: 'TypeParameter',
};
const kindName = (k: number) => KIND_NAMES[k];
// One-line documents: the offset is the character
const offsetAt = (p: { line: number; character: number }) => p.line * 100 + p.character;

describe('completion items', () => {
    it('maps VS Code kind names', () => {
        expect(toCompletionKind('Method')).toBe('method');
        expect(toCompletionKind('EnumMember')).toBe('enumMember');
        expect(toCompletionKind('Issue')).toBe('text');
        expect(toCompletionKind(undefined)).toBe('text');
    });

    it('maps a plain item', () => {
        expect(toSuggestion({ label: 'Name', kind: 4 }, kindName, offsetAt)).toEqual({
            label: 'Name',
            kind: 'field',
            insertText: 'Name',
        });
    });

    it('maps snippets, label details, documentation and the replace range', () => {
        const suggestion = toSuggestion(
            {
                label: { label: 'size', description: 'Integer' },
                kind: 1,
                insertText: { value: 'size()$0' },
                documentation: { value: 'Returns the number of elements' },
                sortText: 'a',
                filterText: 'size',
                range: {
                    inserting: { start: { line: 0, character: 5 }, end: { line: 0, character: 7 } },
                    replacing: { start: { line: 0, character: 5 }, end: { line: 0, character: 9 } },
                },
            },
            kindName,
            offsetAt
        );
        expect(suggestion).toEqual({
            label: 'size',
            kind: 'method',
            insertText: 'size()$0',
            snippet: true,
            detail: 'Integer',
            documentation: 'Returns the number of elements',
            sortText: 'a',
            filterText: 'size',
            range: { start: 5, end: 9 },
        });
    });

    it('leaves out ranges that span lines', () => {
        const suggestion = toSuggestion(
            {
                label: 'x',
                detail: 'd',
                documentation: 'doc',
                range: { start: { line: 0, character: 1 }, end: { line: 1, character: 0 } },
            },
            kindName,
            offsetAt
        );
        expect(suggestion.range).toBeUndefined();
        expect(suggestion.detail).toBe('d');
        expect(suggestion.documentation).toBe('doc');
    });
});
