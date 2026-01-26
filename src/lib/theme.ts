// Theme management utility
// Applies theme on page load and listens for changes

export type Theme = 'light' | 'dark' | 'system';
export type EffectiveTheme = 'light' | 'dark';

const THEME_KEY = 'theme';

// In-memory cache of current theme
let currentTheme: Theme = 'system';

export function getSystemTheme(): EffectiveTheme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
    currentTheme = theme;
    const effectiveTheme: EffectiveTheme = theme === 'system' ? getSystemTheme() : theme;

    if (effectiveTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
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
    await chrome.storage.local.set({ [THEME_KEY]: theme });
    applyTheme(theme);
}

export async function initTheme(): Promise<void> {
    // Apply theme immediately from storage
    const result = await chrome.storage.local.get([THEME_KEY]);
    const theme = (result[THEME_KEY] as Theme) || 'system';
    applyTheme(theme);

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', async () => {
        const current = await chrome.storage.local.get([THEME_KEY]);
        if (((current[THEME_KEY] as Theme) || 'system') === 'system') {
            applyTheme('system');
        }
    });

    // Listen for storage changes (theme changed in another tab/page)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes[THEME_KEY]) {
            applyTheme((changes[THEME_KEY].newValue as Theme) || 'system');
        }
    });
}
