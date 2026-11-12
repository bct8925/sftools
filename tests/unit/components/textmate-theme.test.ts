import { describe, expect, it } from 'vitest';
import {
    baseThemeFor,
    buildTokenRules,
    cssVariableFor,
    readEditorColors,
    tokenName,
    toMonacoTokens,
} from '../../../src/components/monaco-editor/textmate-theme';

/** vscode-textmate metadata: foreground index in bits 15-23, font style in bits 11-14 */
function metadata(foreground: number, fontStyle: number): number {
    return ((foreground << 15) | (fontStyle << 11)) >>> 0;
}

describe('textmate theme helpers', () => {
    it('names tokens by color index and font style', () => {
        expect(tokenName(metadata(5, 0))).toBe('t5.0');
        expect(tokenName(metadata(12, 3))).toBe('t12.3');
        const encoded = new Uint32Array([0, metadata(1, 0), 6, metadata(7, 1)]);
        expect(toMonacoTokens(encoded)).toEqual([
            { startIndex: 0, scopes: 't1.0' },
            { startIndex: 6, scopes: 't7.1' },
        ]);
    });

    it('builds one Monaco rule per color and font style', () => {
        // vscode-textmate's color map leaves index 0 empty
        const colorMap = [undefined as unknown as string, '#D4D4D4', '#569cd6cc', '#abc'];
        const rules = buildTokenRules(colorMap);
        // Index 0 gets plain rules so every token name has one
        expect(rules).toHaveLength(4 * 16);
        expect(rules).toContainEqual({ token: 't0.0' });
        expect(rules).toContainEqual({ token: 't1.0', foreground: 'D4D4D4' });
        expect(rules).toContainEqual({
            token: 't2.3',
            foreground: '569cd6',
            fontStyle: 'italic bold',
        });
        expect(rules).toContainEqual({
            token: 't3.8',
            foreground: 'aabbcc',
            fontStyle: 'strikethrough',
        });
    });

    it('reads editor colors from VS Code CSS variables, hex only', () => {
        expect(cssVariableFor('editorLineNumber.foreground')).toBe(
            '--vscode-editorLineNumber-foreground'
        );
        const vars: Record<string, string> = {
            '--vscode-editor-background': ' #1f1f1f',
            '--vscode-editor-foreground': '#cccccc',
            '--vscode-editorCursor-foreground': 'rgba(1, 2, 3, 0.5)',
        };
        expect(readEditorColors(name => vars[name] ?? '')).toEqual({
            'editor.background': '#1f1f1f',
            'editor.foreground': '#cccccc',
        });
    });

    it('picks the Monaco base from the body class VS Code sets', () => {
        const classes = (...names: string[]) => ({ contains: (n: string) => names.includes(n) });
        expect(baseThemeFor(classes('vscode-light'))).toBe('vs');
        expect(baseThemeFor(classes('vscode-dark'))).toBe('vs-dark');
        expect(baseThemeFor(classes('vscode-high-contrast'))).toBe('hc-black');
        expect(baseThemeFor(classes('vscode-high-contrast', 'vscode-high-contrast-light'))).toBe(
            'hc-light'
        );
    });
});
