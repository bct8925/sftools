import { describe, expect, it, vi } from 'vitest';
import { mergeCompletionSources, type CompletionSource } from '../../../src/lib/completion';

function source(triggers: string[], labels: string[] | Error): CompletionSource {
    return {
        triggerCharacters: triggers,
        provide: vi.fn(async () => {
            if (labels instanceof Error) throw labels;
            return labels.map(label => ({ label, kind: 'field' as const, insertText: label }));
        }),
    };
}

describe('mergeCompletionSources', () => {
    it('returns a lone source unchanged and nothing for none', () => {
        const only = source(['.'], ['A']);
        expect(mergeCompletionSources(only, undefined)).toBe(only);
        expect(mergeCompletionSources(undefined, undefined)).toBeUndefined();
    });

    it('keeps the first source first and drops repeated labels', async () => {
        const merged = mergeCompletionSources(
            source(['.', ' '], ['Name', 'Id']),
            source(['.', '@'], ['Id', 'Owner'])
        )!;
        expect(merged.triggerCharacters).toEqual(['.', ' ', '@']);
        const labels = (await merged.provide('x', 1)).map(s => s.label);
        expect(labels).toEqual(['Name', 'Id', 'Owner']);
    });

    it('skips a source that fails', async () => {
        const merged = mergeCompletionSources(
            source(['.'], new Error('down')),
            source(['.'], ['Id'])
        )!;
        expect((await merged.provide('x', 1)).map(s => s.label)).toEqual(['Id']);
    });

    it('asks only the sources that use the trigger character', async () => {
        const soql = source([' '], ['FROM']);
        const host = source(['@'], ['Deprecated']);
        const merged = mergeCompletionSources(soql, host)!;
        const labels = (await merged.provide('SELECT ', 7, { triggerCharacter: ' ' })).map(
            s => s.label
        );
        expect(labels).toEqual(['FROM']);
        expect(host.provide).not.toHaveBeenCalled();
    });
});
