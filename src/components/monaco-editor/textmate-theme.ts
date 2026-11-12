// Pure helpers that turn VS Code's look into a Monaco theme (VS Code build).
// TextMate tokenization (vscode-textmate) resolves each token to a foreground color
// index and a font style. Tokens are named `t<color>.<fontStyle>` and the Monaco
// theme gets one rule per name, so Monaco paints exactly what VS Code would.

import type { editor } from 'monaco-editor';

/** Bits of vscode-textmate's encoded token metadata (EncodedTokenAttributes) */
const FONT_STYLE_MASK = 0b00000000000000000111100000000000;
const FONT_STYLE_OFFSET = 11;
const FOREGROUND_MASK = 0b00000000111111111000000000000000;
const FOREGROUND_OFFSET = 15;

/** vscode-textmate FontStyle flags */
const ITALIC = 1;
const BOLD = 2;
const UNDERLINE = 4;
const STRIKETHROUGH = 8;

export function tokenName(metadata: number): string {
    const foreground = (metadata & FOREGROUND_MASK) >>> FOREGROUND_OFFSET;
    const fontStyle = (metadata & FONT_STYLE_MASK) >>> FONT_STYLE_OFFSET;
    return `t${foreground}.${fontStyle}`;
}

/** Monaco tokens for one line from vscode-textmate's tokenizeLine2 result */
export function toMonacoTokens(
    encoded: Uint32Array
): Array<{ startIndex: number; scopes: string }> {
    const tokens: Array<{ startIndex: number; scopes: string }> = [];
    for (let i = 0; i < encoded.length; i += 2) {
        tokens.push({ startIndex: encoded[i], scopes: tokenName(encoded[i + 1]) });
    }
    return tokens;
}

function fontStyleText(fontStyle: number): string {
    const parts: string[] = [];
    if (fontStyle & ITALIC) parts.push('italic');
    if (fontStyle & BOLD) parts.push('bold');
    if (fontStyle & UNDERLINE) parts.push('underline');
    if (fontStyle & STRIKETHROUGH) parts.push('strikethrough');
    return parts.join(' ');
}

/** Monaco wants 6-digit hex without '#'; drop alpha */
function monacoHex(color: string): string | undefined {
    const match = /^#?([0-9a-f]{3,8})$/i.exec(color.trim());
    if (!match) return undefined;
    let hex = match[1];
    if (hex.length === 3 || hex.length === 4) {
        hex = hex
            .slice(0, 3)
            .split('')
            .map(c => c + c)
            .join('');
    }
    return hex.slice(0, 6);
}

/** One rule per color index and font style, from vscode-textmate's getColorMap() */
export function buildTokenRules(colorMap: string[]): editor.ITokenThemeRule[] {
    const rules: editor.ITokenThemeRule[] = [];
    colorMap.forEach((color, index) => {
        const foreground = monacoHex(color ?? '');
        for (let fontStyle = 0; fontStyle < 16; fontStyle++) {
            const rule: editor.ITokenThemeRule = { token: `t${index}.${fontStyle}` };
            if (foreground) rule.foreground = foreground;
            const style = fontStyleText(fontStyle);
            if (style) rule.fontStyle = style;
            rules.push(rule);
        }
    });
    return rules;
}

/** Monaco color ids VS Code also exposes to webviews as --vscode-* CSS variables */
export const EDITOR_COLOR_IDS = [
    'editor.background',
    'editor.foreground',
    'editorCursor.foreground',
    'editor.lineHighlightBackground',
    'editor.lineHighlightBorder',
    'editorLineNumber.foreground',
    'editorLineNumber.activeForeground',
    'editor.selectionBackground',
    'editor.inactiveSelectionBackground',
    'editor.selectionHighlightBackground',
    'editor.wordHighlightBackground',
    'editor.wordHighlightStrongBackground',
    'editor.findMatchBackground',
    'editor.findMatchHighlightBackground',
    'editorBracketMatch.background',
    'editorBracketMatch.border',
    'editorWhitespace.foreground',
    'editorIndentGuide.background1',
    'editorIndentGuide.activeBackground1',
    'editorGutter.background',
    'editorWidget.background',
    'editorWidget.foreground',
    'editorWidget.border',
    'editorSuggestWidget.background',
    'editorSuggestWidget.border',
    'editorSuggestWidget.foreground',
    'editorSuggestWidget.selectedBackground',
    'editorSuggestWidget.selectedForeground',
    'editorSuggestWidget.highlightForeground',
    'editorHoverWidget.background',
    'editorHoverWidget.border',
    'editorError.foreground',
    'editorWarning.foreground',
    'editorInfo.foreground',
    'scrollbarSlider.background',
    'scrollbarSlider.hoverBackground',
    'scrollbarSlider.activeBackground',
    'focusBorder',
    'list.hoverBackground',
    'list.activeSelectionBackground',
    'list.activeSelectionForeground',
    'list.highlightForeground',
];

export function cssVariableFor(colorId: string): string {
    return `--vscode-${colorId.replace(/\./g, '-')}`;
}

/** Editor colors from the webview's CSS variables (hex values only) */
export function readEditorColors(readVariable: (name: string) => string): Record<string, string> {
    const colors: Record<string, string> = {};
    for (const id of EDITOR_COLOR_IDS) {
        const value = readVariable(cssVariableFor(id)).trim();
        if (/^#[0-9a-f]{3,8}$/i.test(value)) colors[id] = value;
    }
    return colors;
}

/** Monaco base theme from the class VS Code puts on the webview's body */
export function baseThemeFor(bodyClasses: {
    contains(name: string): boolean;
}): editor.BuiltinTheme {
    if (bodyClasses.contains('vscode-high-contrast-light')) return 'hc-light';
    if (bodyClasses.contains('vscode-high-contrast')) return 'hc-black';
    if (bodyClasses.contains('vscode-light')) return 'vs';
    return 'vs-dark';
}
