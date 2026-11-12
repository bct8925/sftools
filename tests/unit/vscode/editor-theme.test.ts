// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
    findActiveTheme,
    readTokenColors,
    resolveEditorTheme,
    userTokenColors,
    type ThemeContribution,
} from '../../../vscode/src/editor-theme';

const themes: ThemeContribution[] = [
    {
        extensionPath: '/ext/defaults',
        id: 'Default Dark Modern',
        label: 'Dark Modern',
        uiTheme: 'vs-dark',
        path: 'themes/dark_modern.json',
    },
    {
        extensionPath: '/ext/defaults',
        id: 'Default Light Modern',
        label: 'Light Modern',
        uiTheme: 'vs',
        path: 'themes/light_modern.json',
    },
    {
        extensionPath: '/ext/defaults',
        label: 'Default High Contrast',
        uiTheme: 'hc-black',
        path: 'themes/hc_black.json',
    },
    { extensionPath: '/ext/monokai', label: 'Monokai', uiTheme: 'vs-dark', path: 'monokai.json' },
];

const files: Record<string, string> = {
    '/ext/defaults/themes/dark_modern.json': `{
        // comments and trailing commas are allowed in theme files
        "include": "./dark_plus.json",
        "tokenColors": [{ "scope": "keyword", "settings": { "foreground": "#C586C0" } },],
    }`,
    '/ext/defaults/themes/dark_plus.json': `{
        "include": "./dark_vs.json",
        "tokenColors": [{ "scope": "keyword", "settings": { "foreground": "#569cd6" } }]
    }`,
    '/ext/defaults/themes/dark_vs.json': `{ "tokenColors": [{ "settings": { "foreground": "#D4D4D4" } }] }`,
    '/ext/monokai/monokai.json': `{ "include": "./monokai.json", "tokenColors": "./monokai.tmTheme" }`,
};
const readFile = async (p: string) => {
    if (!(p in files)) throw new Error(`ENOENT ${p}`);
    return files[p];
};

describe('editor theme', () => {
    it('finds the configured theme by id or label', () => {
        expect(findActiveTheme(themes, { colorTheme: 'Default Dark Modern' }, 2)?.path).toBe(
            'themes/dark_modern.json'
        );
        expect(findActiveTheme(themes, { colorTheme: 'Monokai' }, 2)?.label).toBe('Monokai');
    });

    it('uses the preferred theme when the OS picks light or dark', () => {
        const settings = {
            colorTheme: 'Default Dark Modern',
            autoDetectColorScheme: true,
            preferredLight: 'Default Light Modern',
            preferredDark: 'Monokai',
        };
        expect(findActiveTheme(themes, settings, 1)?.id).toBe('Default Light Modern');
        expect(findActiveTheme(themes, settings, 2)?.label).toBe('Monokai');
        // Without auto-detect the configured theme stands
        expect(findActiveTheme(themes, { ...settings, autoDetectColorScheme: false }, 2)?.id).toBe(
            'Default Dark Modern'
        );
    });

    it('uses the preferred high contrast theme when VS Code is in high contrast', () => {
        const settings = {
            colorTheme: 'Default Dark Modern',
            preferredHighContrast: 'Default High Contrast',
        };
        expect(findActiveTheme(themes, settings, 3)?.label).toBe('Default High Contrast');
    });

    it('follows includes, base rules first', async () => {
        const rules = await readTokenColors('/ext/defaults/themes/dark_modern.json', readFile);
        expect(rules.map(r => r.settings.foreground)).toEqual(['#D4D4D4', '#569cd6', '#C586C0']);
        // A self-include and a .tmTheme tokenColors give nothing rather than looping
        expect(await readTokenColors('/ext/monokai/monokai.json', readFile)).toEqual([]);
    });

    it('adds the user token color customizations after the theme', async () => {
        const info = await resolveEditorTheme(
            themes,
            {
                colorTheme: 'Default Dark Modern',
                customizations: {
                    comments: '#00ff00',
                    textMateRules: [{ scope: 'string', settings: { foreground: '#ff0000' } }],
                    '[Default Dark*]': { keywords: { foreground: '#0000ff', fontStyle: 'bold' } },
                    '[Monokai]': { numbers: '#123456' },
                },
            },
            2,
            readFile
        );
        expect(info.name).toBe('Default Dark Modern');
        expect(info.tokenColors.slice(3)).toEqual([
            {
                scope: ['comment', 'punctuation.definition.comment'],
                settings: { foreground: '#00ff00' },
            },
            { scope: 'string', settings: { foreground: '#ff0000' } },
            {
                scope: ['keyword - keyword.operator', 'keyword.control', 'storage', 'storage.type'],
                settings: { foreground: '#0000ff', fontStyle: 'bold' },
            },
        ]);
    });

    it('still answers when the theme cannot be read', async () => {
        const info = await resolveEditorTheme(
            themes,
            { colorTheme: 'Default Light Modern' },
            1,
            readFile
        );
        expect(info).toEqual({ name: 'Default Light Modern', tokenColors: [] });
        expect(userTokenColors(undefined, 'x')).toEqual([]);
    });
});
