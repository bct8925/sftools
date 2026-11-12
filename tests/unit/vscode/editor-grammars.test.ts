// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GrammarCatalog, type GrammarContribution } from '../../../vscode/src/editor-grammars';

const installed: GrammarContribution[] = [
    {
        extensionPath: '/ext/apex',
        language: 'apex',
        scopeName: 'source.apex',
        path: 'grammars/apex.tmLanguage',
    },
    {
        extensionPath: '/ext/apex',
        language: 'apex-anon',
        scopeName: 'source.apex',
        path: 'grammars/apex.tmLanguage',
    },
    {
        extensionPath: '/ext/apex',
        scopeName: 'source.soql.embedded',
        path: 'grammars/soql-in-apex.json',
        injectTo: ['source.apex'],
    },
    {
        extensionPath: '/ext/json',
        language: 'json',
        scopeName: 'source.json',
        path: 'syntaxes/JSON.tmLanguage.json',
    },
];
const fallbacks: GrammarContribution[] = [
    {
        extensionPath: '/sftools',
        language: 'soql',
        scopeName: 'source.sftools.soql',
        path: 'syntaxes/soql.tmLanguage.json',
    },
    {
        extensionPath: '/sftools',
        language: 'apex',
        scopeName: 'source.sftools.apex',
        path: 'syntaxes/apex.tmLanguage.json',
    },
];
const read = async (p: string) =>
    p.includes('missing') ? Promise.reject(new Error('ENOENT')) : `content of ${p}`;

describe('GrammarCatalog', () => {
    it('prefers installed grammars and the anonymous Apex language', async () => {
        const catalog = new GrammarCatalog(() => installed, fallbacks, read);
        expect(await catalog.forLanguage('apex')).toEqual({
            scopeName: 'source.apex',
            fileName: 'apex.tmLanguage',
            content: 'content of /ext/apex/grammars/apex.tmLanguage',
            injections: ['source.soql.embedded'],
        });
    });

    it("falls back to sftools' own grammars", async () => {
        const catalog = new GrammarCatalog(() => [], fallbacks, read);
        expect((await catalog.forLanguage('sql'))?.scopeName).toBe('source.sftools.soql');
        expect((await catalog.forLanguage('apex'))?.scopeName).toBe('source.sftools.apex');
        expect(await catalog.forLanguage('json')).toBeNull();
        expect(await catalog.forLanguage('text')).toBeNull();
    });

    it('finds grammars by scope for includes and injections', async () => {
        const catalog = new GrammarCatalog(() => installed, fallbacks, read);
        expect((await catalog.forScope('source.json'))?.fileName).toBe('JSON.tmLanguage.json');
        expect(await catalog.forScope('source.unknown')).toBeNull();
    });

    it('answers null when a grammar file cannot be read', async () => {
        const broken = [
            { extensionPath: '/missing', language: 'xml', scopeName: 'text.xml', path: 'x.json' },
        ];
        expect(await new GrammarCatalog(() => broken, [], read).forLanguage('xml')).toBeNull();
    });
});
