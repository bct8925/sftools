// Theme management utility
import { storage } from '../platform';
// Applies theme on page load and listens for changes

export type Theme = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const THEME_KEY = 'theme';

// In-memory cache of current theme
let currentTheme: Theme = 'system';

/**
 * Theme of the VS Code window, read from the classes VS Code puts on a webview's body.
 * Returns null outside VS Code.
 */
export function getVsCodeTheme(): EffectiveTheme | null {
    const classes = document.body?.classList;
    if (!classes) return null;
    if (classes.contains('vscode-light') || classes.contains('vscode-high-contrast-light')) {
        return 'light';
    }
    if (classes.contains('vscode-dark') || classes.contains('vscode-high-contrast')) {
        return 'dark';
    }
    return null;
}

export function getSystemTheme(): EffectiveTheme {
    const vscodeTheme = getVsCodeTheme();
    if (vscodeTheme) return vscodeTheme;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply a theme. In VS Code, "system" also sets data-vscode-theme, which switches
 * sftools' colors to VS Code's (style.css) and the editors to the VS Code theme;
 * light and dark keep sftools' own palettes.
 */
export function applyTheme(theme: Theme): void {
    currentTheme = theme;
    const effectiveTheme: EffectiveTheme = theme === 'system' ? getSystemTheme() : theme;
    const root = document.documentElement;

    if (effectiveTheme === 'dark') {
        root.setAttribute('data-theme', 'dark');
    } else {
        root.removeAttribute('data-theme');
    }

    if (theme === 'system' && getVsCodeTheme()) {
        root.setAttribute('data-vscode-theme', '');
    } else {
        root.removeAttribute('data-vscode-theme');
    }
}

/**
 * Get the current theme setting
 */
export function getTheme(): Theme {
    return currentTheme;
}

/**
 * Set and persist the theme
 */
export async function setTheme(theme: Theme): Promise<void> {
    await storage.set({ [THEME_KEY]: theme });
    applyTheme(theme);
}

export async function initTheme(): Promise<void> {
    // Apply theme immediately from storage
    const result = await storage.get([THEME_KEY]);
    const theme = (result[THEME_KEY] as Theme) || 'system';
    applyTheme(theme);

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', async () => {
        const current = await storage.get([THEME_KEY]);
        if (((current[THEME_KEY] as Theme) || 'system') === 'system') {
            applyTheme('system');
        }
    });

    // In VS Code, "system" follows the editor theme, which VS Code reports via body classes
    if (document.body && typeof MutationObserver !== 'undefined') {
        new MutationObserver(() => {
            if (currentTheme === 'system') applyTheme('system');
        }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    // Listen for storage changes (theme changed in another tab/page)
    storage.onChanged(changes => {
        if (changes[THEME_KEY]) {
            applyTheme((changes[THEME_KEY].newValue as Theme) || 'system');
        }
    });
}
