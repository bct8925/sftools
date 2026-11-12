/**
 * Tests for the Monaco adapter that turns editor-neutral completion sources
 * into Monaco completion providers (Chrome only).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/components/monaco-editor/MonacoEditor', () => ({
    monaco: {
        languages: {
            CompletionItemKind: {
                Field: 1,
                Class: 2,
                Module: 3,
                Function: 4,
                Keyword: 5,
                Reference: 6,
                Constant: 7,
                Value: 8,
                Enum: 9,
                Unit: 10,
                Event: 11,
            },
            CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
            registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        },
    },
}));

import {
    createMonacoCompletionProvider,
    registerMonacoCompletionSource,
} from '../../../src/components/monaco-editor/completion-provider';
import { monaco } from '../../../src/components/monaco-editor/MonacoEditor';
import type { CompletionSource } from '../../../src/lib/completion';
import { textBeforeCursorOnLine } from '../../../src/lib/completion';

function fakeModel(text: string) {
    return {
        getValue: () => text,
        getOffsetAt: () => text.length,
        getWordUntilPosition: () => ({ startColumn: 3, endColumn: 5 }),
    };
}

const source: CompletionSource = {
    triggerCharacters: ['.'],
    provide: vi.fn(async () => [
        { label: 'Name', kind: 'field' as const, insertText: 'Name', sortText: '1_Name' },
        {
            label: 'COUNT',
            kind: 'function' as const,
            insertText: 'COUNT($0)',
            snippet: true,
            detail: 'COUNT()',
        },
    ]),
};

describe('createMonacoCompletionProvider', () => {
    it('maps neutral suggestions to Monaco items with the word range', async () => {
        const provider = createMonacoCompletionProvider(source);
        expect(provider.triggerCharacters).toEqual(['.']);

        const result = await provider.provideCompletionItems(
            fakeModel('SELECT Na') as never,
            { lineNumber: 2, column: 5 } as never,
            {} as never,
            {} as never
        );

        expect(source.provide).toHaveBeenCalledWith('SELECT Na', 9);
        const range = { startLineNumber: 2, endLineNumber: 2, startColumn: 3, endColumn: 5 };
        expect(result!.suggestions).toEqual([
            { label: 'Name', kind: 1, insertText: 'Name', range, sortText: '1_Name' },
            {
                label: 'COUNT',
                kind: 4,
                insertText: 'COUNT($0)',
                range,
                detail: 'COUNT()',
                insertTextRules: 4,
            },
        ]);
    });

    it('answers only for the models it applies to', async () => {
        const model = fakeModel('x');
        const provider = createMonacoCompletionProvider(source, m => m === (model as never));
        const other = await provider.provideCompletionItems(
            fakeModel('y') as never,
            { lineNumber: 1, column: 2 } as never,
            {} as never,
            {} as never
        );
        expect(other!.suggestions).toEqual([]);
    });

    it('registers the provider for a language', () => {
        registerMonacoCompletionSource('sql', source);
        expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
            'sql',
            expect.objectContaining({ triggerCharacters: ['.'] })
        );
    });
});

describe('textBeforeCursorOnLine', () => {
    it('returns text from the start of the cursor line', () => {
        expect(textBeforeCursorOnLine('IF(\n  Owner.', 12)).toBe('  Owner.');
        expect(textBeforeCursorOnLine('Owner.Na', 6)).toBe('Owner.');
    });
});
