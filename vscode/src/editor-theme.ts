// Finds the active color theme's token colors for the webview's Monaco editors.
// No vscode imports, so it is unit tested; extension.ts supplies the inputs.

import * as path from 'path';
import { parse as parseJsonc } from 'jsonc-parser';
import type { EditorThemeInfo, TokenColorRule } from '../../src/platform/protocol';

/** A theme an extension contributes (package.json contributes.themes) */
export interface ThemeContribution {
    extensionPath: string;
    id?: string;
    label?: string;
    uiTheme?: string;
    path: string;
}

/** vscode.ColorThemeKind values */
export const enum ThemeKind {
    Light = 1,
    Dark = 2,
    HighContrast = 3,
    HighContrastLight = 4,
}

export interface ThemeSettings {
    colorTheme?: string;
    autoDetectColorScheme?: boolean;
    preferredDark?: string;
    preferredLight?: string;
    preferredHighContrast?: string;
    preferredHighContrastLight?: string;
    /** editor.tokenColorCustomizations */
    customizations?: Record<string, unknown>;
}

export type ReadFile = (filePath: string) => Promise<string>;

const UI_THEME_KIND: Record<string, ThemeKind> = {
    vs: ThemeKind.Light,
    'vs-dark': ThemeKind.Dark,
    'hc-black': ThemeKind.HighContrast,
    'hc-light': ThemeKind.HighContrastLight,
};

function settingsId(theme: ThemeContribution): string | undefined {
    return theme.id ?? theme.label;
}

/** The contribution VS Code is showing, from the settings and the active theme's kind */
export function findActiveTheme(
    themes: ThemeContribution[],
    settings: ThemeSettings,
    kind: ThemeKind
): ThemeContribution | undefined {
    const byName = (name: string | undefined) =>
        name ? themes.find(t => settingsId(t) === name || t.label === name) : undefined;
    const configured = byName(settings.colorTheme);
    const configuredKind = configured ? UI_THEME_KIND[configured.uiTheme ?? ''] : undefined;

    // VS Code swaps in the preferred theme when the OS asks for high contrast or,
    // with window.autoDetectColorScheme, for light or dark
    const candidates: Array<string | undefined> = [];
    if (kind === ThemeKind.HighContrast && configuredKind !== kind) {
        candidates.push(settings.preferredHighContrast);
    }
    if (kind === ThemeKind.HighContrastLight && configuredKind !== kind) {
        candidates.push(settings.preferredHighContrastLight);
    }
    if (settings.autoDetectColorScheme) {
        if (kind === ThemeKind.Dark) candidates.push(settings.preferredDark);
        if (kind === ThemeKind.Light) candidates.push(settings.preferredLight);
    }
    candidates.push(settings.colorTheme);

    const found = candidates.map(byName).filter((t): t is ThemeContribution => !!t);
    // Prefer the candidate that matches what VS Code reports as active
    return found.find(t => UI_THEME_KIND[t.uiTheme ?? ''] === kind) ?? found[0];
}

function isRuleList(value: unknown): value is TokenColorRule[] {
    return Array.isArray(value);
}

/** tokenColors of a theme file, following `include` (included rules come first) */
export async function readTokenColors(
    filePath: string,
    readFile: ReadFile,
    seen = new Set<string>()
): Promise<TokenColorRule[]> {
    if (seen.has(filePath)) return [];
    seen.add(filePath);
    const theme = parseJsonc(await readFile(filePath)) as {
        include?: string;
        tokenColors?: unknown;
    } | null;
    if (!theme || typeof theme !== 'object') return [];

    const rules: TokenColorRule[] = [];
    if (typeof theme.include === 'string') {
        rules.push(
            ...(await readTokenColors(
                path.join(path.dirname(filePath), theme.include),
                readFile,
                seen
            ))
        );
    }
    // A string tokenColors points at a .tmTheme (plist), which is rare; those are skipped
    if (isRuleList(theme.tokenColors)) {
        rules.push(...theme.tokenColors.filter(r => r && typeof r === 'object' && r.settings));
    }
    return rules;
}

/** Scopes VS Code applies the simple editor.tokenColorCustomizations keys to */
const CUSTOMIZATION_SCOPES: Record<string, string[]> = {
    comments: ['comment', 'punctuation.definition.comment'],
    strings: ['string', 'meta.embedded.assembly'],
    keywords: ['keyword - keyword.operator', 'keyword.control', 'storage', 'storage.type'],
    numbers: ['constant.numeric'],
    types: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
    functions: ['entity.name.function', 'support.function'],
    variables: ['variable', 'entity.name.variable'],
};

function customizationRules(value: Record<string, unknown>): TokenColorRule[] {
    const rules: TokenColorRule[] = [];
    for (const [key, scopes] of Object.entries(CUSTOMIZATION_SCOPES)) {
        const setting = value[key];
        if (typeof setting === 'string') {
            rules.push({ scope: scopes, settings: { foreground: setting } });
        } else if (setting && typeof setting === 'object') {
            rules.push({ scope: scopes, settings: setting as TokenColorRule['settings'] });
        }
    }
    if (Array.isArray(value.textMateRules)) {
        rules.push(
            ...(value.textMateRules as TokenColorRule[]).filter(r => r && typeof r === 'object')
        );
    }
    return rules;
}

/** `[Theme A][Theme B]` keys, with `*` wildcards */
function keyMatchesTheme(key: string, themeName: string): boolean {
    const names = [...key.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]);
    return names.some(name => {
        const pattern = new RegExp(
            `^${name.replace(/[.+?^${}()|\\]/g, '\\$&').replace(/\*/g, '.*')}$`
        );
        return pattern.test(themeName);
    });
}

/** User rules from editor.tokenColorCustomizations, global first, then theme-specific */
export function userTokenColors(
    customizations: Record<string, unknown> | undefined,
    themeName: string | undefined
): TokenColorRule[] {
    if (!customizations) return [];
    const rules = customizationRules(customizations);
    if (themeName) {
        for (const [key, value] of Object.entries(customizations)) {
            if (key.startsWith('[') && value && typeof value === 'object') {
                if (keyMatchesTheme(key, themeName)) {
                    rules.push(...customizationRules(value as Record<string, unknown>));
                }
            }
        }
    }
    return rules;
}

/** VS Code's built-in themes that match Monaco's own vs and vs-dark */
const BUILT_IN_VARIANTS = {
    light: { id: 'Visual Studio Light', file: 'light_vs.json' },
    dark: { id: 'Visual Studio Dark', file: 'dark_vs.json' },
} as const;

/** sftools' own editor colors for light or dark, ignoring the active theme and customizations */
export async function resolveVariantTheme(
    themes: ThemeContribution[],
    variant: 'light' | 'dark',
    readFile: ReadFile
): Promise<EditorThemeInfo> {
    const { id, file } = BUILT_IN_VARIANTS[variant];
    const theme = themes.find(t => t.id === id) ?? themes.find(t => path.basename(t.path) === file);
    if (!theme) return { name: id, tokenColors: [] };
    try {
        return {
            name: id,
            tokenColors: await readTokenColors(
                path.join(theme.extensionPath, theme.path),
                readFile
            ),
        };
    } catch {
        return { name: id, tokenColors: [] };
    }
}

export async function resolveEditorTheme(
    themes: ThemeContribution[],
    settings: ThemeSettings,
    kind: ThemeKind,
    readFile: ReadFile
): Promise<EditorThemeInfo> {
    const theme = findActiveTheme(themes, settings, kind);
    const name = theme ? settingsId(theme) : settings.colorTheme;
    let tokenColors: TokenColorRule[] = [];
    if (theme) {
        try {
            tokenColors = await readTokenColors(
                path.join(theme.extensionPath, theme.path),
                readFile
            );
        } catch {
            // Unreadable theme: the editors keep VS Code's UI colors and default syntax
        }
    }
    return {
        name,
        tokenColors: [...tokenColors, ...userTokenColors(settings.customizations, name)],
    };
}
